/**
 * Authentication Controller
 * Handles user authentication operations
 */
const jwt = require('jsonwebtoken');
const config = require('../config');
const { User, Patient } = require('../models');
const { asyncHandler } = require('../utils/helpers');
const {
  successResponse,
  createdResponse,
} = require('../utils/response');
const {
  UnauthorizedError,
  BadRequestError,
  ConflictError,
} = require('../utils/errors');
const { ROLES } = require('../config/constants');

/**
 * Generate JWT tokens
 */
const generateTokens = (user) => {
  const accessToken = jwt.sign(
    { id: user.id, role: user.role },
    config.jwt.secret,
    { expiresIn: config.jwt.expiresIn }
  );

  const refreshToken = jwt.sign(
    { id: user.id, type: 'refresh' },
    config.jwt.secret,
    { expiresIn: config.jwt.refreshExpiresIn }
  );

  return { accessToken, refreshToken };
};

/**
 * Login
 * POST /api/auth/login
 */
const login = asyncHandler(async (req, res) => {
  const { username, password } = req.body;

  // Find user
  const user = await User.findOne({
    where: { username, isActive: true },
  });

  if (!user) {
    throw new UnauthorizedError('Tên đăng nhập hoặc mật khẩu không đúng');
  }

  // Verify password
  const isMatch = await user.comparePassword(password);
  if (!isMatch) {
    throw new UnauthorizedError('Tên đăng nhập hoặc mật khẩu không đúng');
  }

  // Generate tokens
  const { accessToken, refreshToken } = generateTokens(user);

  // Save refresh token
  user.refreshToken = refreshToken;
  user.lastLoginAt = new Date();
  await user.save();

  // Get patient info if user is a patient
  let patientInfo = null;
  if (user.role === ROLES.PATIENT) {
    patientInfo = await Patient.findOne({ where: { userId: user.id } });
  }

  return successResponse(res, {
    user: {
      ...user.toJSON(),
      patientId: patientInfo?.id,
    },
    accessToken,
    refreshToken,
  }, 'Đăng nhập thành công');
});

/**
 * Register
 * POST /api/auth/register
 */
const register = asyncHandler(async (req, res) => {
  const {
    username,
    email,
    password,
    fullName,
    phone,
    dateOfBirth,
    gender,
    address,
    idNumber,
    medicalHistory,
    allergies,
  } = req.body;

  // Check existing user
  const existingUser = await User.findOne({
    where: { username },
  });

  if (existingUser) {
    throw new ConflictError('Tên đăng nhập đã tồn tại');
  }

  const existingEmail = await User.findOne({
    where: { email },
  });

  if (existingEmail) {
    throw new ConflictError('Email đã được sử dụng');
  }

  // Create user (default role: patient)
  const user = await User.create({
    username,
    email,
    password,
    fullName,
    phone,
    dateOfBirth,
    gender,
    address,
    idNumber,
    medicalHistory,
    allergies,
    role: ROLES.PATIENT,
  });

  // Create patient record
  const patient = await Patient.create({
    userId: user.id,
    fullName,
    dateOfBirth,
    gender,
    phone,
    email,
    address,
    idNumber,
    medicalHistory,
    allergies,
  });

  // Generate tokens
  const { accessToken, refreshToken } = generateTokens(user);

  // Save refresh token
  user.refreshToken = refreshToken;
  await user.save();

  return createdResponse(res, {
    user: {
      ...user.toJSON(),
      patientId: patient.id,
    },
    accessToken,
    refreshToken,
  }, 'Đăng ký thành công');
});

/**
 * Refresh token
 * POST /api/auth/refresh
 */
const refreshAccessToken = asyncHandler(async (req, res) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    throw new BadRequestError('Refresh token không được cung cấp');
  }

  try {
    // Verify refresh token
    const decoded = jwt.verify(refreshToken, config.jwt.secret);

    if (decoded.type !== 'refresh') {
      throw new UnauthorizedError('Token không hợp lệ');
    }

    // Find user
    const user = await User.findByPk(decoded.id);

    if (!user || user.refreshToken !== refreshToken) {
      throw new UnauthorizedError('Token không hợp lệ hoặc đã hết hạn');
    }

    // Generate new tokens
    const tokens = generateTokens(user);

    // Update refresh token
    user.refreshToken = tokens.refreshToken;
    await user.save();

    return successResponse(res, tokens, 'Refresh token thành công');
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      throw new UnauthorizedError('Refresh token đã hết hạn');
    }
    throw error;
  }
});

/**
 * Logout
 * POST /api/auth/logout
 */
const logout = asyncHandler(async (req, res) => {
  const user = req.user;

  // Clear refresh token
  user.refreshToken = null;
  await user.save();

  return successResponse(res, null, 'Đăng xuất thành công');
});

/**
 * Get current user
 * GET /api/auth/me
 */
const getCurrentUser = asyncHandler(async (req, res) => {
  const user = req.user;

  let patientInfo = null;
  if (user.role === ROLES.PATIENT) {
    patientInfo = await Patient.findOne({ where: { userId: user.id } });
  }

  return successResponse(res, {
    ...user.toJSON(),
    patientId: patientInfo?.id,
  });
});

/**
 * Change password
 * PUT /api/auth/change-password
 */
const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const user = req.user;

  // Verify current password
  const isMatch = await user.comparePassword(currentPassword);
  if (!isMatch) {
    throw new BadRequestError('Mật khẩu hiện tại không đúng');
  }

  // Update password
  user.password = newPassword;
  await user.save();

  return successResponse(res, null, 'Đổi mật khẩu thành công');
});

/**
 * Update profile
 * PUT /api/auth/profile
 */
const updateProfile = asyncHandler(async (req, res) => {
  const { fullName, phone, email, address, signature } = req.body;
  const user = req.user;

  // Check email uniqueness if changed
  if (email && email !== user.email) {
    const existingEmail = await User.findOne({ where: { email } });
    if (existingEmail) {
      throw new ConflictError('Email đã được sử dụng');
    }
  }

  // Update user
  await user.update({
    fullName: fullName || user.fullName,
    phone: phone || user.phone,
    email: email || user.email,
    address: address || user.address,
    signature: signature || user.signature,
  });

  // Update patient record if exists
  if (user.role === ROLES.PATIENT) {
    await Patient.update(
      { fullName, phone, email, address },
      { where: { userId: user.id } }
    );
  }

  return successResponse(res, user.toJSON(), 'Cập nhật hồ sơ thành công');
});

module.exports = {
  login,
  register,
  refreshAccessToken,
  logout,
  getCurrentUser,
  changePassword,
  updateProfile,
};
