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

const STAFF_PREFIX_BY_ROLE = {
  [ROLES.ADMIN]: 'AD',
  [ROLES.DOCTOR]: 'BS',
  [ROLES.RECEPTIONIST]: 'LT',
  [ROLES.PHARMACIST]: 'DS',
  [ROLES.PATIENT]: 'BN',
};

const buildNextStaffCode = async (role, transaction) => {
  if (role === ROLES.PATIENT) return null;

  const prefix = STAFF_PREFIX_BY_ROLE[role] || 'UN';
  const candidates = await User.findAll({
    attributes: ['staffCode'],
    where: {
      role,
      staffCode: {
        [Op.like]: `${prefix}%`,
      },
    },
    paranoid: false,
    raw: true,
    transaction,
  });

  let maxSeq = 0;
  for (const row of candidates || []) {
    const value = String(row?.staffCode || '').trim();
    if (!value.startsWith(prefix)) continue;
    const suffix = Number(value.slice(prefix.length));
    if (Number.isFinite(suffix) && suffix > maxSeq) maxSeq = suffix;
  }

  return `${prefix}${String(maxSeq + 1).padStart(3, '0')}`;
};

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

  // Include Patient association for patients to get patientCode
  const include = [];
  if (role === 'patient' || !role) {
    include.push({
      association: 'patient',
      model: Patient,
      attributes: ['id'],
      required: false,
    });
  }

  let count, rows;
  try {
    const result = await User.findAndCountAll({
      where,
      order,
      limit,
      offset,
      attributes: { exclude: ['password', 'refreshToken'] },
      include: include.length > 0 ? include : undefined,
    });
    count = result.count;
    rows = result.rows;
  } catch (err) {
    // Detect MSSQL conversion errors (e.g. varchar -> bigint) and retry without includes
    const parentMsg = err && err.parent && err.parent.message ? String(err.parent.message).toLowerCase() : (err && err.message ? String(err.message).toLowerCase() : '');
    if (parentMsg.includes('varchar to bigint') || parentMsg.includes('convert') || parentMsg.includes('data type varchar') || err && err.name === 'SequelizeDatabaseError') {
      try {
        logger.warn('findAndCountAll failed with type conversion error; retrying without includes', { err: err.message, query: { where, order, limit, offset } });
        const fallback = await User.findAndCountAll({
          where,
          order,
          limit,
          offset,
          attributes: { exclude: ['password', 'refreshToken'] },
          // omit includes to avoid join-related type conversion failures
        });
        count = fallback.count;
        rows = fallback.rows;
      } catch (fallbackErr) {
        // If fallback also fails, rethrow original error to preserve stack trace
        logger.error('Retry without includes also failed in getAllUsers', { err: fallbackErr.message });
        throw err;
      }
    } else {
      throw err;
    }
  }

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

  // Normalize email: convert empty string to null to avoid UNIQUE constraint violation
  const normalizedEmail = email && String(email).trim() !== '' ? String(email).trim() : null;

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

  // Check existing email only when provided
  if (normalizedEmail) {
    const existingEmail = await User.findOne({ where: { email: normalizedEmail }, paranoid: false });
    if (existingEmail) {
      if (existingEmail.deletedAt) {
        await existingEmail.destroy({ force: true });
      } else {
        throw new ValidationError('Dữ liệu không hợp lệ', [
          { field: 'email', message: 'Email đã được sử dụng' },
        ]);
      }
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
    const nextStaffCode = await buildNextStaffCode(role, t);

    // Create user within transaction
    try {
      user = await User.create({
        username,
        staffCode: nextStaffCode,
        email: normalizedEmail,
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
            staffCode: await buildNextStaffCode(role, t),
            email: normalizedEmail,
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

    // For admin "Add User" flow: role patient must always create a Patient profile.
    const shouldCreatePatient = role === ROLES.PATIENT;

    if (shouldCreatePatient) {
      const normalizedPhone = phone !== undefined && phone !== null && String(phone).trim() !== ''
        ? String(phone).trim()
        : null;
      const normalizedIdNumber = idNumber !== undefined && idNumber !== null && String(idNumber).trim() !== ''
        ? String(idNumber).trim()
        : null;

      // Reuse existing patient profile by phone when it has no linked user account yet.
      let existingPatientByPhone = null;
      if (normalizedPhone) {
        existingPatientByPhone = await Patient.findOne({
          where: { phone: normalizedPhone },
          paranoid: false,
          transaction: t,
        });
      }

      if (existingPatientByPhone && !existingPatientByPhone.deletedAt) {
        if (existingPatientByPhone.userId) {
          throw new ValidationError('Dữ liệu không hợp lệ', [
            { field: 'phone', message: 'Số điện thoại này đã có tài khoản bệnh nhân' },
          ]);
        }

        // Link the newly created user to existing patient and preserve existing patient code (BNxxx).
        await existingPatientByPhone.update({
          userId: user.id,
          fullName: fullName || existingPatientByPhone.fullName,
          dateOfBirth: dateOfBirth || existingPatientByPhone.dateOfBirth,
          gender: gender || existingPatientByPhone.gender,
          email: normalizedEmail || existingPatientByPhone.email,
          address: address || existingPatientByPhone.address,
          idNumber: normalizedIdNumber || existingPatientByPhone.idNumber,
        }, { transaction: t });

        await user.update({ staffCode: existingPatientByPhone.id }, { transaction: t });
      } else {
        if (existingPatientByPhone?.deletedAt) {
          await existingPatientByPhone.destroy({ force: true, transaction: t });
        }

        // Check idNumber uniqueness only when provided
        if (normalizedIdNumber) {
          const existingPatient = await Patient.findOne({ where: { idNumber: normalizedIdNumber }, paranoid: false, transaction: t });
          if (existingPatient) {
            if (existingPatient.deletedAt) {
              await existingPatient.destroy({ force: true, transaction: t });
            } else {
              throw new ValidationError('Dữ liệu không hợp lệ', [
                { field: 'idNumber', message: 'Số CCCD/CMND đã được sử dụng' },
              ]);
            }
          }
        }

        const createdPatient = await Patient.create({
          userId: user.id,
          fullName,
          dateOfBirth,
          gender,
          phone: normalizedPhone,
          email: normalizedEmail,
          address,
          idNumber: normalizedIdNumber,
        }, { transaction: t });

        // Patient code in users must follow Patient module code (BNxxx)
        await user.update({ staffCode: createdPatient.id }, { transaction: t });
      }
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
                  staffCode: await buildNextStaffCode(role, t2),
                  email: normalizedEmail,
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

                // Recreate or relink patient
                const normalizedPhone = phone !== undefined && phone !== null && String(phone).trim() !== ''
                  ? String(phone).trim()
                  : null;
                const normalizedIdNumber = idNumber !== undefined && idNumber !== null && String(idNumber).trim() !== ''
                  ? String(idNumber).trim()
                  : null;

                let existingPatientByPhone = null;
                if (normalizedPhone) {
                  existingPatientByPhone = await Patient.findOne({
                    where: { phone: normalizedPhone },
                    paranoid: false,
                    transaction: t2,
                  });
                }

                if (existingPatientByPhone && !existingPatientByPhone.deletedAt) {
                  if (existingPatientByPhone.userId) {
                    throw new ValidationError('Dữ liệu không hợp lệ', [
                      { field: 'phone', message: 'Số điện thoại này đã có tài khoản bệnh nhân' },
                    ]);
                  }

                  await existingPatientByPhone.update({
                    userId: user.id,
                    fullName: fullName || existingPatientByPhone.fullName,
                    dateOfBirth: dateOfBirth || existingPatientByPhone.dateOfBirth,
                    gender: gender || existingPatientByPhone.gender,
                    email: normalizedEmail || existingPatientByPhone.email,
                    address: address || existingPatientByPhone.address,
                    idNumber: normalizedIdNumber || existingPatientByPhone.idNumber,
                  }, { transaction: t2 });

                  await user.update({ staffCode: existingPatientByPhone.id }, { transaction: t2 });
                } else {
                  if (existingPatientByPhone?.deletedAt) {
                    await existingPatientByPhone.destroy({ force: true, transaction: t2 });
                  }

                  const createdPatient = await Patient.create({
                    userId: user.id,
                    fullName,
                    dateOfBirth,
                    gender,
                    phone: normalizedPhone,
                    email: normalizedEmail,
                    address,
                    idNumber: normalizedIdNumber,
                  }, { transaction: t2 });

                  await user.update({ staffCode: createdPatient.id }, { transaction: t2 });
                }

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

      // Log raw error for diagnostics
      try {
        logger.warn('Sequelize unique constraint error while creating user', {
          errMessage: err.message,
          errFields: err.fields,
          errErrors: Array.isArray(err.errors) ? err.errors.map(e => ({ path: e.path, message: e.message, value: e.value })) : undefined,
          parent: err.parent && err.parent.message ? String(err.parent.message) : undefined,
          requestBodySample: { username: req.body.username, email: req.body.email, phone: req.body.phone },
        });
      } catch (logErr) {
        // ignore logging failures
      }

      // Try to map the unique constraint to request fields using several heuristics.
      const details = [];

      // 1) Use explicit fields when provided by Sequelize
      const explicitFields = err.fields && Object.keys(err.fields).length
        ? Object.keys(err.fields)
        : (Array.isArray(err.errors) ? err.errors.map(e => e.path).filter(Boolean) : []);

      if (explicitFields.length > 0) {
        for (const f of explicitFields) {
          if (/email/i.test(f)) details.push({ field: 'email', message: 'Email đã được sử dụng' });
          else if (/phone/i.test(f)) details.push({ field: 'phone', message: 'Số điện thoại đã được sử dụng' });
          else if (/id_number|idnumber|cccd|cmnd/i.test(f)) details.push({ field: 'idNumber', message: 'Số CCCD/CMND đã được sử dụng' });
          else details.push({ field: f, message: `${f} đã tồn tại` });
        }
        throw new ValidationError('Dữ liệu không hợp lệ', details);
      }

      // 2) Parse parent message (MSSQL / dialect error text) for keywords
      const parentMsg = err.parent && err.parent.message ? String(err.parent.message).toLowerCase() : '';
      if (parentMsg) {
        if (parentMsg.includes('username')) details.push({ field: 'username', message: 'Tên đăng nhập đã tồn tại' });
        if (parentMsg.includes('email')) details.push({ field: 'email', message: 'Email đã được sử dụng' });
        if (parentMsg.includes('phone')) details.push({ field: 'phone', message: 'Số điện thoại đã được sử dụng' });
        if (parentMsg.includes('patients') || parentMsg.includes('cccd') || parentMsg.includes('cmnd') || parentMsg.includes('id_number')) {
          details.push({ field: 'idNumber', message: 'Số CCCD/CMND đã được sử dụng' });
        }
        if (details.length > 0) throw new ValidationError('Dữ liệu không hợp lệ', details);
      }

      // 3) Fall back to generic message
      details.push({ field: 'unknown', message: 'Ràng buộc duy nhất bị vi phạm hoặc dữ liệu trùng lặp' });
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
  // Normalize update email: empty -> null
  if (Object.prototype.hasOwnProperty.call(updateData, 'email')) {
    updateData.email = updateData.email && String(updateData.email).trim() !== '' ? String(updateData.email).trim() : null;
  }

  // Check email uniqueness if changed and a non-empty email provided
  if (updateData.email !== undefined && updateData.email !== null && updateData.email !== user.email) {
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
  // If admin didn't provide a new password, set default and force change
  const finalPassword = newPassword && newPassword.length >= 6 ? newPassword : 'Nk123456';

  const user = await User.findByPk(id);
  if (!user) {
    throw new NotFoundError('Không tìm thấy người dùng');
  }

  user.password = finalPassword;
  user.mustChangePassword = true; // force user to change password on next login
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
