/**
 * Controller Xác Thực Người Dùng
 * Xử lý đăng nhập, đăng ký, refresh token, quên mật khẩu
 */
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { Op } from 'sequelize';
import config from '../config/index.js';
import { User, Patient } from '../models/index.js';
import { asyncHandler } from '../utils/helpers.js';
import {
  successResponse,
  createdResponse,
} from '../utils/response.js';
import {
  UnauthorizedError,
  BadRequestError,
  ConflictError,
  ValidationError,
  NotFoundError,
} from '../utils/errors.js';
import { ROLES } from '../config/constants.js';

/**
 * Tạo cặp token (access + refresh)
 * Access token: chứa id + role, dùng để xác thực mỗi request
 * Refresh token: chứa id + type, dùng để lấy access token mới khi hết hạn
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
 * Đăng nhập
 * Luồng: Tìm user theo username → So sánh password (bcrypt) → Tạo tokens
 *   → Lưu refresh token vào DB → Lấy thông tin bệnh nhân (nếu có) → Trả về
 * POST /api/auth/login
 */
const login = asyncHandler(async (req, res) => {
  const { username, password } = req.body;

  // Helper to map logical attribute names to model column names
  const getAttr = (model, candidates) => {
    if (!model || !model.rawAttributes) return null;
    for (const c of candidates) {
      if (Object.prototype.hasOwnProperty.call(model.rawAttributes, c)) return c;
    }
    return null;
  };

  // Determine attribute names for username and active flag depending on model (DB schema variations)
  const usernameAttr = getAttr(User, ['username', 'TenDangNhap', 'TenDangNhap']);
  const isActiveAttr = getAttr(User, ['isActive', 'TrangThaiHoatDong', 'TrangThaiHoatDong']);

  // Build where clause using detected attributes
  const where = {};
  if (usernameAttr) where[usernameAttr] = username;
  if (isActiveAttr) where[isActiveAttr] = true;

  // Tìm user theo username và trạng thái hoạt động
  const user = await User.findOne({ where });

  if (!user) {
    throw new UnauthorizedError('Tên đăng nhập hoặc mật khẩu không đúng');
  }

  // So sánh mật khẩu với hash trong DB (bcrypt)
  let isMatch = false;
  try {
    if (typeof user.comparePassword === 'function') {
      isMatch = await user.comparePassword(password);
    }
  } catch (e) {
    // ignore compare errors
    isMatch = false;
  }

  // Fallback: some legacy records may store plaintext password in different field
  if (!isMatch) {
    const plainCandidates = [user.password, user.MatKhau, user.Matkhau, user?.get && typeof user.get === 'function' ? user.get('MatKhau') : undefined];
    const storedPlain = plainCandidates.find((v) => typeof v === 'string');
    if (storedPlain && storedPlain === password) {
      isMatch = true;
      // Hash and persist the password securely for future logins
      try {
        const bcrypt = await import('bcryptjs');
        const saltRounds = (config.bcrypt && config.bcrypt.saltRounds) || 10;
        const hashed = await bcrypt.hash(password, saltRounds);
        // Determine password field(s) to update
        const pwAttr = getAttr(User, ['password', 'MatKhau', 'Matkhau']) || null;
        if (pwAttr) user[pwAttr] = hashed;
        try { await user.save(); } catch (e) { /* non-fatal */ }
      } catch (e) {
        // ignore hashing errors
      }
    }
  }

  if (!isMatch) {
    throw new UnauthorizedError('Tên đăng nhập hoặc mật khẩu không đúng');
  }

  // Tạo cặp access + refresh token
  // If user is required to change password, do not issue tokens
  if (user.mustChangePassword) {
    // Invalidate any existing sessions
    user.refreshToken = null;
    user.lastLoginAt = new Date();
    await user.save();

    return successResponse(res, {
      user: {
        ...user.toJSON(),
        patientId: null,
      },
      mustChangePassword: true,
    }, 'Bạn cần đổi mật khẩu trước khi tiếp tục');
  }

  const { accessToken, refreshToken } = generateTokens(user);

  // Lưu refresh token vào DB để kiểm tra khi refresh
  // Try to persist refresh token + lastLogin in model-aware way; skip if model doesn't expose fields
  const refreshAttr = getAttr(User, ['refreshToken', 'refresh_token', 'RefreshToken']);
  const lastLoginAttr = getAttr(User, ['lastLoginAt', 'last_login_at', 'NgayCapNhat']);
  if (refreshAttr) user[refreshAttr] = refreshToken;
  if (lastLoginAttr) user[lastLoginAttr] = new Date();
  try {
    // Only call save if at least one mapped attr exists
    if (refreshAttr || lastLoginAttr) await user.save();
  } catch (e) {
    console.warn('Warning: unable to persist refresh/lastLogin on user model', e.message || e);
  }

  // Nếu là bệnh nhân, lấy thêm patientId để FE định danh
  let patientInfo = null;
  if ((user.role === ROLES.PATIENT) || (!user.role && user.VaiTro === 5)) {
    // Determine patient foreign key name for Patient model (userId vs MaNguoiDung)
    const patientFk = getAttr(Patient, ['userId', 'MaNguoiDung']);
    const patientWhere = {};
    if (patientFk === 'userId') patientWhere.userId = user.id;
    else if (patientFk === 'MaNguoiDung') patientWhere.MaNguoiDung = user.id;
    try {
      patientInfo = await Patient.findOne({ where: patientWhere });
    } catch (e) {
      // ignore
    }
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
 * Đăng ký tài khoản bệnh nhân mới
 * Luồng: Kiểm tra trùng username/email → Tạo User (role=patient)
 *   → Tạo Patient record liên kết → Tạo tokens → Trả về
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

  // Normalize email: convert empty string to null to avoid UNIQUE constraint violation
  const normalizedEmail = email && String(email).trim() !== '' ? String(email).trim() : null;

  // Kiểm tra username/email/phone đã tồn tại (bao gồm soft-deleted)
  const existingUser = await User.findOne({ where: { username }, paranoid: false });
  if (existingUser) {
    if (existingUser.deletedAt) {
      await existingUser.destroy({ force: true });
    } else {
      throw new ValidationError('Dữ liệu không hợp lệ', [
        { field: 'username', message: 'Tên đăng nhập đã tồn tại' },
      ]);
    }
  }

  // Kiểm tra email chỉ khi người dùng cung cấp email (non-empty)
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

  // Tạo user với role mặc định là patient
  const user = await User.create({
    username,
    email: normalizedEmail,
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
  // Nếu có idNumber (CCCD) hoặc các thông tin patient quan trọng, tạo Patient.
  // Kiểm tra xung đột idNumber trước để tránh lỗi unique của DB.
  let patient = null;
  if (idNumber && String(idNumber).trim() !== '') {
    const existingPatient = await Patient.findOne({ where: { idNumber }, paranoid: false });
    if (existingPatient) {
      if (existingPatient.deletedAt) {
        await existingPatient.destroy({ force: true });
      } else {
        // Trả lỗi field-level để frontend hiển thị đúng ô bị lỗi
        throw new ValidationError('Dữ liệu không hợp lệ', [
          { field: 'idNumber', message: 'Số CCCD/CMND đã được sử dụng' },
        ]);
      }
    }

    patient = await Patient.create({
      userId: user.id,
      fullName,
      dateOfBirth,
      gender,
      phone,
      email: normalizedEmail,
      address,
      idNumber,
      medicalHistory,
      allergies,
    });
  }

  // Generate tokens
  const { accessToken, refreshToken } = generateTokens(user);

  // Save refresh token
  user.refreshToken = refreshToken;
  await user.save();

  return createdResponse(res, {
    user: {
      ...user.toJSON(),
      patientId: patient?.id || null,
    },
    accessToken,
    refreshToken,
  }, 'Đăng ký thành công');
});

/**
 * Làm mới access token bằng refresh token
 * Luồng: Giải mã refresh token → Kiểm tra type=refresh
 *   → So sánh với token trong DB (chống token bị thu hồi)
 *   → Tạo cặp token mới → Cập nhật DB → Trả về
 * POST /api/auth/refresh
 */
const refreshAccessToken = asyncHandler(async (req, res) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    throw new BadRequestError('Refresh token không được cung cấp');
  }

  try {
    // Giải mã và kiểm tra token
    const decoded = jwt.verify(refreshToken, config.jwt.secret);

    // Đảm bảo đúng loại token (không dùng access token để refresh)
    if (decoded.type !== 'refresh') {
      throw new UnauthorizedError('Token không hợp lệ');
    }

    // Tìm user và đối chiếu refresh token trong DB
    // Nếu không khớp → token đã bị thu hồi (sau logout hoặc đổi password)
    const user = await User.findByPk(decoded.id);

    if (!user || user.refreshToken !== refreshToken) {
      throw new UnauthorizedError('Token không hợp lệ hoặc đã hết hạn');
    }

    // Tạo cặp token mới (token rotation - refresh token cũ không dùng lại được)
    const tokens = generateTokens(user);

    // Cập nhật refresh token mới vào DB
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
  // Clear forced change flag when user updates password
  user.mustChangePassword = false;
  await user.save();

  return successResponse(res, null, 'Đổi mật khẩu thành công');
});

/**
 * Complete forced password change (public)
 * POST /api/auth/complete-change-password
 */
const completeChangePassword = asyncHandler(async (req, res) => {
  const { username, currentPassword, newPassword } = req.body;

  if (!username || !currentPassword || !newPassword) {
    throw new BadRequestError('Thiếu thông tin');
  }

  const user = await User.findOne({ where: { username } });
  if (!user) throw new NotFoundError('Không tìm thấy người dùng');

  const isMatch = await user.comparePassword(currentPassword);
  if (!isMatch) throw new BadRequestError('Mật khẩu hiện tại không đúng');

  user.password = newPassword;
  user.mustChangePassword = false;
  // Invalidate old sessions
  user.refreshToken = null;
  await user.save();

  // After successful change, issue tokens so client can continue
  const tokens = generateTokens(user);
  user.refreshToken = tokens.refreshToken;
  await user.save();

  return successResponse(res, {
    user: user.toJSON(),
    ...tokens,
  }, 'Đổi mật khẩu thành công');
});

/**
 * Update profile
 * PUT /api/auth/profile
 */
const updateProfile = asyncHandler(async (req, res) => {
  const { fullName, phone, email, address, signature } = req.body;
  // Normalize email: convert empty string or whitespace-only to empty string
  const normalizedEmail = email && String(email).trim() !== '' ? String(email).trim() : '';
  const user = req.user;

  // Check email uniqueness if changed
  if (normalizedEmail !== '' && normalizedEmail !== user.email) {
    const existingEmail = await User.findOne({ where: { email: normalizedEmail } });
    if (existingEmail) {
      throw new ConflictError('Email đã được sử dụng');
    }
  }

  // Update user
  await user.update({
    fullName: fullName || user.fullName,
    phone: phone || user.phone,
    email: normalizedEmail ?? user.email,
    address: address || user.address,
    signature: signature || user.signature,
  });

  // Update patient record if exists
  if (user.role === ROLES.PATIENT) {
    await Patient.update(
      { fullName, phone, email: normalizedEmail ?? user.email, address },
      { where: { userId: user.id } }
    );
  }

  return successResponse(res, user.toJSON(), 'Cập nhật hồ sơ thành công');
});

/**
 * Quên mật khẩu - tạo reset token tạm thời
 * Trong môi trường production nên gửi qua email, ở đây trả token trực tiếp
 * POST /api/auth/forgot-password
 */

const forgotPassword = asyncHandler(async (req, res) => {
  const { identifier } = req.body;

  if (!identifier) {
    throw new BadRequestError('Vui lòng nhập tên đăng nhập hoặc email');
  }

  // Tìm user theo username hoặc email
  const user = await User.findOne({
    where: {
      [Op.or]: [
        { username: identifier },
        { email: identifier },
      ],
      isActive: true,
    },
  });

  if (!user) {
    // Không tiết lộ user có tồn tại hay không (bảo mật)
    return successResponse(res, null,
      'Nếu tài khoản tồn tại, hướng dẫn đặt lại mật khẩu sẽ được gửi'
    );
  }

  // Tạo reset token ngẫu nhiên (6 ký tự, dễ nhập thủ công)
  const resetToken = crypto.randomBytes(3).toString('hex').toUpperCase();
  const resetExpires = new Date(Date.now() + 15 * 60 * 1000); // 15 phút

  // Lưu token vào refreshToken field (tận dụng field có sẵn)
  // Format: RESET:<token>:<expires_timestamp>
  user.refreshToken = `RESET:${resetToken}:${resetExpires.getTime()}`;
  await user.save();

  // TODO: Gửi email chứa resetToken trong production
  // Ở môi trường dev, trả token trực tiếp để test
  const responseData = {
    message: 'Mã xác nhận đã được tạo',
    email: user.email ? user.email.replace(/(.{2})(.*)(@.*)/, '$1***$3') : null,
  };

  if (process.env.NODE_ENV === 'development') {
    responseData.resetToken = resetToken;
  }

  return successResponse(res, responseData,
    'Nếu tài khoản tồn tại, hướng dẫn đặt lại mật khẩu sẽ được gửi'
  );
});

/**
 * Đặt lại mật khẩu bằng reset token
 * POST /api/auth/reset-password
 */
const resetPassword = asyncHandler(async (req, res) => {
  const { token, newPassword, confirmPassword } = req.body;

  if (!token || !newPassword) {
    throw new BadRequestError('Vui lòng cung cấp mã xác nhận và mật khẩu mới');
  }

  if (newPassword.length < 6) {
    throw new BadRequestError('Mật khẩu mới phải có ít nhất 6 ký tự');
  }

  if (newPassword !== confirmPassword) {
    throw new BadRequestError('Mật khẩu xác nhận không khớp');
  }

  // Tìm user có reset token phù hợp và chưa hết hạn
  const users = await User.findAll({
    where: {
      isActive: true,
    },
  });

  const user = users.find((u) => {
    if (!u.refreshToken || !u.refreshToken.startsWith('RESET:')) return false;
    const parts = u.refreshToken.split(':');
    if (parts.length !== 3) return false;
    const [, savedToken, expires] = parts;
    return savedToken === token.toUpperCase() && parseInt(expires) > Date.now();
  });

  if (!user) {
    throw new BadRequestError('Mã xác nhận không hợp lệ hoặc đã hết hạn');
  }

  // Cập nhật mật khẩu và xóa reset token
  user.password = newPassword;
  user.refreshToken = null;
  await user.save();

  return successResponse(res, null, 'Đặt lại mật khẩu thành công. Vui lòng đăng nhập lại.');
});

export {
  login,
  register,
  refreshAccessToken,
  logout,
  getCurrentUser,
  changePassword,
  updateProfile,
  forgotPassword,
  resetPassword,
  completeChangePassword,
};
