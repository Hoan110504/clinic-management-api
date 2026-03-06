/**
 * User Controller
 * Handles user management operations
 */
import { Op } from 'sequelize';
import { User, Patient, sequelize } from '../models/index.js';
import logger from '../utils/logger.js';
import { asyncHandler, parsePagination, parseSort } from '../utils/helpers.js';
import {
  successResponse,
  createdResponse,
  paginatedResponse,
  noContentResponse,
} from '../utils/response.js';
import { NotFoundError, ConflictError, BadRequestError, ValidationError } from '../utils/errors.js';
import { ROLES } from '../config/constants.js';

/**
 * Get all users (with pagination and filters)
 * GET /api/users
 */
const getAllUsers = asyncHandler(async (req, res) => {
  const { page, limit, offset } = parsePagination(req.query);
  const { role, search, isActive, sort } = req.query;

  // Build where clause
  const where = {};

  if (role) {
    where.role = role;
  }

  if (isActive !== undefined) {
    where.isActive = isActive === 'true';
  }

  if (search) {
    where[Op.or] = [
      { fullName: { [Op.like]: `%${search}%` } },
      { username: { [Op.like]: `%${search}%` } },
      { email: { [Op.like]: `%${search}%` } },
      { phone: { [Op.like]: `%${search}%` } },
    ];
  }

  // Parse sort
  const order = parseSort(sort, ['createdAt', 'fullName', 'username', 'role']);

  const { count, rows } = await User.findAndCountAll({
    where,
    order,
    limit,
    offset,
    attributes: { exclude: ['password', 'refreshToken'] },
  });

  return paginatedResponse(res, {
    data: rows,
    page,
    limit,
    total: count,
  });
});

/**
 * Get user by ID
 * GET /api/users/:id
 */
const getUserById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const user = await User.findByPk(id, {
    attributes: { exclude: ['password', 'refreshToken'] },
    include: [
      {
        model: Patient,
        as: 'patientProfile',
        required: false,
      },
    ],
  });

  if (!user) {
    throw new NotFoundError('Không tìm thấy người dùng');
  }

  return successResponse(res, user);
});

/**
 * Create new user
 * POST /api/users
 */
const createUser = asyncHandler(async (req, res) => {
  const {
    username,
    email,
    password,
    fullName,
    role,
    phone,
    dateOfBirth,
    gender,
    address,
    idNumber,
    signature,
  } = req.body;

  // Check existing username
  // Check existing username/email including soft-deleted records so we can
  // either fail fast or clean up soft-deleted duplicates before creating.
  const existingUser = await User.findOne({ where: { username }, paranoid: false });
  if (existingUser) {
    if (existingUser.deletedAt) {
      // Remove soft-deleted conflicting record so we can recreate
      await existingUser.destroy({ force: true });
    } else {
      // Return field-level validation error for username
      throw new ValidationError('Dữ liệu không hợp lệ', [
        { field: 'username', message: 'Tên đăng nhập đã tồn tại' },
      ]);
    }
  }

  // Check existing email
  const existingEmail = await User.findOne({ where: { email }, paranoid: false });
  if (existingEmail) {
    if (existingEmail.deletedAt) {
      await existingEmail.destroy({ force: true });
    } else {
      throw new ValidationError('Dữ liệu không hợp lệ', [
        { field: 'email', message: 'Email đã được sử dụng' },
      ]);
    }
  }

  // Check phone uniqueness
  if (phone) {
    const existingPhone = await User.findOne({ where: { phone }, paranoid: false });
    if (existingPhone) {
      if (existingPhone.deletedAt) {
        await existingPhone.destroy({ force: true });
      } else {
        throw new ValidationError('Dữ liệu không hợp lệ', [
          { field: 'phone', message: 'Số điện thoại đã được sử dụng' },
        ]);
      }
    }
  }

  // Use a transaction to ensure User + Patient are created atomically
  let user;
  const t = await sequelize.transaction();
  try {
    // Create user within transaction
    try {
      user = await User.create({
        username,
        email,
        password,
        fullName,
        role,
        phone,
        dateOfBirth,
        gender,
        address,
        idNumber,
        signature,
      }, { transaction: t });
    } catch (err) {
      // Handle DB unique constraint errors caused by soft-deleted rows (MSSQL UQ__...)
      if (err && err.name === 'SequelizeUniqueConstraintError') {
        const fields = err.fields && Object.keys(err.fields).length ? Object.keys(err.fields) : (Array.isArray(err.errors) ? err.errors.map(e => e.path).filter(Boolean) : []);
        if (fields.length > 0) {
          for (const f of fields) {
            try {
              const conflict = await User.findOne({ where: { [f]: req.body[f] || (f === 'id_number' ? idNumber : undefined) }, paranoid: false, transaction: t });
              if (conflict && conflict.deletedAt) {
                await conflict.destroy({ force: true, transaction: t });
              }
            } catch (inner) {
              // ignore and continue
            }
          }

          // Retry create once within same transaction
          user = await User.create({
            username,
            email,
            password,
            fullName,
            role,
            phone,
            dateOfBirth,
            gender,
            address,
            idNumber,
            signature,
          }, { transaction: t });
        } else {
          throw err;
        }
      } else {
        throw err;
      }
    }

    // Only create Patient when admin provided an idNumber (CCCD).
    // Admin users typically don't have CCCD; patients fill that later in patient flow.
    const shouldCreatePatient = role === ROLES.PATIENT && idNumber !== undefined && idNumber !== null && String(idNumber).trim() !== '';

    if (shouldCreatePatient) {
      // Check idNumber uniqueness (including soft-deleted)
      const existingPatient = await Patient.findOne({ where: { idNumber }, paranoid: false, transaction: t });
      if (existingPatient) {
        if (existingPatient.deletedAt) {
          await existingPatient.destroy({ force: true, transaction: t });
        } else {
          throw new ValidationError('Dữ liệu không hợp lệ', [
            { field: 'idNumber', message: 'Số CCCD/CMND đã được sử dụng' },
          ]);
        }
      }

      await Patient.create({
        userId: user.id,
        fullName,
        dateOfBirth,
        gender,
        phone,
        email,
        address,
        idNumber,
      }, { transaction: t });
    }

    await t.commit();
  } catch (err) {
    await t.rollback();
    // If constraint error occurred (e.g., patient unique index), try a one-time cleanup and retry
    if (err && err.name === 'SequelizeUniqueConstraintError') {
      const errPaths = Array.isArray(err.errors) ? err.errors.map(e => e.path).filter(Boolean) : [];
      const hasPatientUq = errPaths.some(p => /^UQ__patients__/i.test(p));

      if (hasPatientUq && role === ROLES.PATIENT && idNumber) {
        // Log diagnostic info to help trace unexpected conflicts
        try {
          const conflicts = await Patient.findAll({ where: { idNumber }, paranoid: false });
          logger.warn('Patient unique constraint encountered when creating user', {
            idNumber,
            conflictCount: conflicts.length,
            conflicts: conflicts.map((c) => ({ id: c.id, userId: c.userId, deletedAt: c.deletedAt })),
            requestBodySample: {
              username: req.body.username,
              email: req.body.email,
              phone: req.body.phone,
            },
            err: err?.message,
            errFields: err?.fields,
          });
        } catch (logErr) {
          logger.error('Failed to log patient conflict diagnostic', { err: logErr.message });
        }
        // Attempt to permanently remove any soft-deleted patient record outside the rolled-back transaction,
        // then perform a single retry in a fresh transaction. This handles cases where a prior soft-delete
        // left a row that still blocks the unique index.
        try {
          const existingPatient = await Patient.findOne({ where: { idNumber }, paranoid: false });
          if (existingPatient) {
            if (existingPatient.deletedAt) {
              await existingPatient.destroy({ force: true });
              // Now retry create in a fresh transaction
              const t2 = await sequelize.transaction();
              try {
                // Recreate user
                user = await User.create({
                  username,
                  email,
                  password,
                  fullName,
                  role,
                  phone,
                  dateOfBirth,
                  gender,
                  address,
                  idNumber,
                  signature,
                }, { transaction: t2 });

                // Recreate patient
                await Patient.create({
                  userId: user.id,
                  fullName,
                  dateOfBirth,
                  gender,
                  phone,
                  email,
                  address,
                  idNumber,
                }, { transaction: t2 });

                await t2.commit();
                return createdResponse(res, user.toJSON(), 'Tạo người dùng thành công');
              } catch (retryErr) {
                await t2.rollback();
                // fall through to mapping below
              }
            } else {
              // Active patient exists: return field-level validation
              throw new ValidationError('Dữ liệu không hợp lệ', [
                { field: 'idNumber', message: 'Số CCCD/CMND đã được sử dụng' },
              ]);
            }
          }
        } catch (inner) {
          if (inner instanceof ValidationError) throw inner;
        }
      }

      const fields = err.fields && Object.keys(err.fields).length ? Object.keys(err.fields) : (Array.isArray(err.errors) ? err.errors.map(e => e.path).filter(Boolean) : []);
      const details = [];
      for (const f of fields) {
        // try to map to request body fields
        let key = f;
        try {
          if (req && req.body && typeof req.body === 'object') {
            const bodyKeys = Object.keys(req.body);
            const matchKey = bodyKeys.find((k) => String(req.body[k]) === String(err.fields?.[f] ?? err.errors?.find(e => e.path === f)?.value));
            if (matchKey) key = matchKey;
          }
        } catch (inner) {}

        // normalize common patient fields
        if (/email/i.test(key)) {
          details.push({ field: 'email', message: 'Email đã được sử dụng' });
        } else if (/phone/i.test(key)) {
          details.push({ field: 'phone', message: 'Số điện thoại đã được sử dụng' });
        } else if (/id_number|idnumber|cccd|cmnd/i.test(key) || /^UQ__patients__/i.test(String(f))) {
          details.push({ field: 'idNumber', message: 'Số CCCD/CMND đã được sử dụng' });
        } else {
          details.push({ field: key, message: `${key} đã tồn tại` });
        }
      }

      throw new ValidationError('Dữ liệu không hợp lệ', details);
    }

    throw err;
  }

  // Patient record creation is handled inside the transaction above when needed

  return createdResponse(res, user.toJSON(), 'Tạo người dùng thành công');
});

/**
 * Update user
 * PUT /api/users/:id
 */
const updateUser = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const updateData = req.body;

  const user = await User.findByPk(id);
  if (!user) {
    throw new NotFoundError('Không tìm thấy người dùng');
  }

  // Check email uniqueness if changed
  if (updateData.email && updateData.email !== user.email) {
    const existingEmail = await User.findOne({ where: { email: updateData.email, id: { [Op.ne]: id } }, paranoid: false });
    if (existingEmail) {
      if (existingEmail.deletedAt) {
        // remove soft-deleted conflicting record to allow update
        await existingEmail.destroy({ force: true });
      } else {
        throw new ValidationError('Dữ liệu không hợp lệ', [
          { field: 'email', message: 'Email đã được sử dụng' },
        ]);
      }
    }
  }

  // Check phone uniqueness if changed
  if (updateData.phone && updateData.phone !== user.phone) {
    const existingPhone = await User.findOne({ where: { phone: updateData.phone, id: { [Op.ne]: id } }, paranoid: false });
    if (existingPhone) {
      if (existingPhone.deletedAt) {
        await existingPhone.destroy({ force: true });
      } else {
        throw new ValidationError('Dữ liệu không hợp lệ', [
          { field: 'phone', message: 'Số điện thoại đã được sử dụng' },
        ]);
      }
    }
  }

  // Don't allow changing username
  delete updateData.username;
  // Don't allow changing password through this endpoint
  delete updateData.password;

  await user.update(updateData);

  // Update patient record if exists
  if (user.role === ROLES.PATIENT) {
    const { fullName, phone, email, address, dateOfBirth, gender } = updateData;
    await Patient.update(
      { fullName, phone, email, address, dateOfBirth, gender },
      { where: { userId: user.id } }
    );
  }

  return successResponse(res, user.toJSON(), 'Cập nhật người dùng thành công');
});

/**
 * Delete user (soft delete)
 * DELETE /api/users/:id
 */
const deleteUser = asyncHandler(async (req, res) => {
  const { id } = req.params;

  // Include soft-deleted records so delete is idempotent
  const user = await User.findByPk(id, { paranoid: false });
  if (!user) {
    throw new NotFoundError('Không tìm thấy người dùng');
  }

  // Prevent deleting own account
  if (user.id === req.user.id) {
    throw new BadRequestError('Không thể xóa tài khoản của chính bạn');
  }

  // Use transaction: permanently remove related patient records (if any)
  const t = await sequelize.transaction();
  try {
    // Remove any Patient records tied to this user (including soft-deleted)
    const patients = await Patient.findAll({ where: { userId: user.id }, paranoid: false, transaction: t });
    for (const p of patients) {
      await p.destroy({ force: true, transaction: t });
    }

    // Permanently remove the user record (force) so old deleted accounts don't remain
    if (!user.deletedAt) {
      await user.destroy({ force: true, transaction: t });
    } else {
      // If already soft-deleted, ensure it's removed permanently
      await user.destroy({ force: true, transaction: t });
    }

    await t.commit();
    return noContentResponse(res);
  } catch (err) {
    await t.rollback();
    throw err;
  }
});

/**
 * Toggle user active status
 * PATCH /api/users/:id/toggle-active
 */
const toggleUserActive = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const user = await User.findByPk(id);
  if (!user) {
    throw new NotFoundError('Không tìm thấy người dùng');
  }

  if (user.id === req.user.id) {
    throw new BadRequestError('Không thể thay đổi trạng thái tài khoản của chính bạn');
  }

  user.isActive = !user.isActive;
  await user.save();

  return successResponse(
    res,
    user.toJSON(),
    `${user.isActive ? 'Kích hoạt' : 'Vô hiệu hóa'} tài khoản thành công`
  );
});

/**
 * Reset user password (admin only)
 * POST /api/users/:id/reset-password
 */
const resetUserPassword = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { newPassword } = req.body;

  if (!newPassword || newPassword.length < 6) {
    throw new BadRequestError('Mật khẩu mới phải có ít nhất 6 ký tự');
  }

  const user = await User.findByPk(id);
  if (!user) {
    throw new NotFoundError('Không tìm thấy người dùng');
  }

  user.password = newPassword;
  user.refreshToken = null; // Invalidate current sessions
  await user.save();

  return successResponse(res, null, 'Đặt lại mật khẩu thành công');
});

/**
 * Get users by role
 * GET /api/users/role/:role
 */
const getUsersByRole = asyncHandler(async (req, res) => {
  const { role } = req.params;

  if (!Object.values(ROLES).includes(role)) {
    throw new BadRequestError('Vai trò không hợp lệ');
  }

  const users = await User.findAll({
    where: { role, isActive: true },
    attributes: ['id', 'fullName', 'email', 'phone', 'signature'],
    order: [['fullName', 'ASC']],
  });

  return successResponse(res, users);
});

export {
  getAllUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
  toggleUserActive,
  resetUserPassword,
  getUsersByRole,
};
