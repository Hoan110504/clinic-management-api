/**
 * User Controller
 * Handles user management operations
 */
const { Op } = require('sequelize');
const { User, Patient } = require('../models');
const { asyncHandler, parsePagination, parseSort } = require('../utils/helpers');
const {
  successResponse,
  createdResponse,
  paginatedResponse,
  noContentResponse,
} = require('../utils/response');
const { NotFoundError, ConflictError, BadRequestError } = require('../utils/errors');
const { ROLES } = require('../config/constants');

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
  const existingUser = await User.findOne({ where: { username } });
  if (existingUser) {
    throw new ConflictError('Tên đăng nhập đã tồn tại');
  }

  // Check existing email
  const existingEmail = await User.findOne({ where: { email } });
  if (existingEmail) {
    throw new ConflictError('Email đã được sử dụng');
  }

  // Create user
  const user = await User.create({
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
  });

  // If creating patient, also create patient record
  if (role === ROLES.PATIENT) {
    await Patient.create({
      userId: user.id,
      fullName,
      dateOfBirth,
      gender,
      phone,
      email,
      address,
      idNumber,
    });
  }

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
    const existingEmail = await User.findOne({ where: { email: updateData.email } });
    if (existingEmail) {
      throw new ConflictError('Email đã được sử dụng');
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

  const user = await User.findByPk(id);
  if (!user) {
    throw new NotFoundError('Không tìm thấy người dùng');
  }

  // Prevent deleting own account
  if (user.id === req.user.id) {
    throw new BadRequestError('Không thể xóa tài khoản của chính bạn');
  }

  // Soft delete
  await user.destroy();

  return noContentResponse(res);
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

module.exports = {
  getAllUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
  toggleUserActive,
  resetUserPassword,
  getUsersByRole,
};
