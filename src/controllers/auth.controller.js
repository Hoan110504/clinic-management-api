/**
 * Controller Xác Thực Người Dùng
 * Xử lý đăng nhập, đăng ký, refresh token, quên mật khẩu
 */
import jwt from 'jsonwebtoken';
import { Op } from 'sequelize';
import config from '../config/index.js';
import { User, Patient, PasswordResetOtp, TelegramLinkSession } from '../models/index.js';
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
import {
  buildPasswordResetToken,
  generateOtpCode,
  hashResetValue,
  maskDestination,
  passwordResetConfig,
  resolvePasswordResetDestination,
  resolveIdentifierChannel,
  sendPasswordResetOtp,
} from '../services/passwordReset.service.js';

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
 * Luồng: Tìm user theo số điện thoại hoặc email → So sánh password (bcrypt) → Tạo tokens
 *   → Lưu refresh token vào DB → Lấy thông tin bệnh nhân (nếu có) → Trả về
 * POST /api/auth/login
 */
const login = asyncHandler(async (req, res) => {
  const { identifier, password } = req.body;

  // Helper to map logical attribute names to model column names
  const getAttr = (model, candidates) => {
    if (!model || !model.rawAttributes) return null;
    for (const c of candidates) {
      if (Object.prototype.hasOwnProperty.call(model.rawAttributes, c)) return c;
    }
    return null;
  };

  if (!identifier || !password) {
    throw new BadRequestError('Vui lòng cung cấp số điện thoại/email và mật khẩu');
  }

  const normalizedIdentifier = String(identifier).trim();
  const emailIdentifier = normalizedIdentifier.toLowerCase();

  // Find user by phone or email
  const user = await User.findOne({
    where: {
      isActive: true,
      [Op.or]: [
        { phone: normalizedIdentifier },
        { email: emailIdentifier },
      ],
    },
  });

  if (!user) {
    throw new UnauthorizedError('Tài khoản hoặc mật khẩu không đúng');
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
    throw new UnauthorizedError('Tài khoản hoặc mật khẩu không đúng');
  }

  const roleId = Number(user.role);

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

  // If user is required to link Telegram (for patients created by admin)
  // Issue tokens but flag that linking is required
  if (user.mustLinkTelegram) {
    const { accessToken, refreshToken } = generateTokens(user);
    
    user.refreshToken = refreshToken;
    user.lastLoginAt = new Date();
    await user.save();

    return successResponse(res, {
      user: {
        ...user.toJSON(),
        patientId: null,
      },
      accessToken,
      refreshToken,
      mustLinkTelegram: true,
    }, 'Đăng nhập thành công. Vui lòng liên kết Telegram để tiếp tục.');
  }

  // Check for missing required profile fields on first login (for patients)
if (roleId === ROLES.PATIENT) {
  const missing = [];

  // Use model attribute names (camelCase) to read values returned by Sequelize
  if (!user.dateOfBirth) missing.push('date_of_birth');
  if (!user.gender) missing.push('gender');
  if (!user.address) missing.push('address');
  if (!user.idNumber) missing.push('id_number');

  if (missing.length > 0) {
    // cập nhật lastLoginAt (model attr)
    user.lastLoginAt = new Date();
    try { await user.save(); } catch (e) {}

    return successResponse(
      res,
      {
        user: user.toJSON(),
        mustCompleteProfile: true,
        missingFields: missing,
      },
      'Vui lòng hoàn thiện hồ sơ trước khi tiếp tục'
    );
  }
}

  const { accessToken, refreshToken } = generateTokens(user);

  // Lưu refresh token vào DB để kiểm tra khi refresh
  // Try to persist refresh token + lastLogin in model-aware way; skip if model doesn't expose fields
 const refreshAttr = 'refresh_token';
const lastLoginAttr = 'last_login_at';
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

  if (roleId === ROLES.PATIENT) {
    try {
      // Resolve Patient using the canonical linkage: Patient.userId == User.id
      patientInfo = await Patient.findOne({ where: { userId: user.id } });
    } catch (e) {
      // ignore lookup errors
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
 * Luồng: Kiểm tra trùng phone/email → Tạo User (role=patient)
 *   → Tạo Patient record liên kết → Tạo tokens → Trả về
 * POST /api/auth/register
 */
const register = asyncHandler(async (req, res) => {
  const {
    email,
    password,
    fullName,
    phone,
    telegramChatId,
    dateOfBirth,
    gender,
    address,
    idNumber,
    medicalHistory,
    allergies,
  } = req.body;

  // Phone is required as account identifier
  if (!phone || String(phone).trim() === '') {
    throw new ValidationError('Dữ liệu không hợp lệ', [
      { field: 'phone', message: 'Số điện thoại là bắt buộc' },
    ]);
  }

  // Normalize email: convert empty string to null to avoid UNIQUE constraint violation
  const normalizedEmail = email && String(email).trim() !== '' ? String(email).trim() : null;

  // Kiểm tra phone chưa tồn tại (bao gồm soft-deleted)
  const existingPhone = phone ? await User.findOne({ where: { phone }, paranoid: false }) : null;
  if (existingPhone) {
    if (existingPhone.deletedAt) {
      await existingPhone.destroy({ force: true });
    } else {
      throw new ValidationError('Dữ liệu không hợp lệ', [
        { field: 'phone', message: 'Số điện thoại đã được sử dụng' },
      ]);
    }
  }

  // Tạo user với role mặc định là patient
  const linkedSession = await TelegramLinkSession.findOne({
    where: {
      phone,
      consumedAt: null,
    },
    order: [['CreatedAt', 'DESC']],
  });

  if (!linkedSession || !linkedSession.telegramChatId) {
    throw new ValidationError('Dữ liệu không hợp lệ', [
      { field: 'telegramChatId', message: 'Vui lòng liên kết Telegram trước khi đăng ký' },
    ]);
  }

  const user = await User.create({
    email: normalizedEmail,
    password,
    fullName,
    phone,
    telegramChatId: linkedSession.telegramChatId,
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

  linkedSession.consumedAt = new Date();
  await linkedSession.save();

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
    // Resolve Patient using User.id -> Patient.userId
    try {
      patientInfo = await Patient.findOne({ where: { userId: user.id } });
    } catch (e) {
      // ignore
    }
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
  const { identifier, currentPassword, newPassword } = req.body;

  if (!identifier || !currentPassword || !newPassword) {
    throw new BadRequestError('Thiếu thông tin');
  }

  const normalizedIdentifier = String(identifier).trim();
  const emailIdentifier = normalizedIdentifier.toLowerCase();
  const user = await User.findOne({
    where: {
      [Op.or]: [
        { phone: normalizedIdentifier },
        { email: emailIdentifier },
      ],
    },
  });
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
  const {
    fullName,
    phone,
    email,
    telegramChatId,
    address,
    signature,
    dateOfBirth,
    gender,
    medicalHistory,
    medical_history,
    allergies,
    emergencyContact,
    emergency_contact,
    emergencyPhone,
    emergency_phone,
  } = req.body;
  // Normalize email: convert empty string or whitespace-only to null
  const normalizedEmail = email && String(email).trim() !== '' ? String(email).trim() : null;
  const normalizedTelegramChatId = telegramChatId && String(telegramChatId).trim() !== ''
    ? String(telegramChatId).trim()
    : null;
  const user = req.user;

  // Check email uniqueness if changed (only when a non-null email is provided)
  if (normalizedEmail !== null && normalizedEmail !== user.email) {
    const existingEmail = await User.findOne({ where: { email: normalizedEmail } });
    if (existingEmail) {
      throw new ConflictError('Email đã được sử dụng');
    }
  }

  // Update user
 await user.update({
  fullName: fullName || user.fullName,
  phone: phone || user.phone,
  // If normalizedEmail is null, keep existing email; if it's a string, set it (allows clearing to null only via explicit null)
  email: normalizedEmail ?? user.email,
  telegramChatId: normalizedTelegramChatId ?? user.telegramChatId,
  address: address || user.address,
  signature: signature || user.signature,
  dateOfBirth: dateOfBirth || user.dateOfBirth,
  gender: gender || user.gender,
});

  // Update patient record if exists (include medical history and allergies)
 const patientUpdate = {
  fullName: fullName || undefined,
  phone: phone || undefined,
  email: normalizedEmail ?? undefined,
  address: address || undefined,
  dateOfBirth: dateOfBirth || undefined,
  gender: gender || undefined,
  medicalHistory: medicalHistory || medical_history || undefined,
  allergies: allergies || undefined,
  emergencyContact: emergencyContact || emergency_contact || undefined,
  emergencyPhone: emergencyPhone || emergency_phone || undefined,
};
      // Remove undefined keys to avoid overwriting with null
      Object.keys(patientUpdate).forEach((k) => patientUpdate[k] === undefined && delete patientUpdate[k]);

      // Update Patient by linked userId (canonical linkage Patient.userId == User.id)
      let updatedPatient = null;
      try {
        await Patient.update(patientUpdate, { where: { userId: user.id } });
        updatedPatient = await Patient.findOne({ where: { userId: user.id } });
      } catch (e) {
        console.warn('patient update failed', e.message || e);
      }

  // Return merged user + patient info when available so frontend can update UI
  if (updatedPatient) {
    return successResponse(res, { ...user.toJSON(), ...updatedPatient.toJSON() }, 'Cập nhật hồ sơ thành công');
  }

  return successResponse(res, user.toJSON(), 'Cập nhật hồ sơ thành công');
});

const findUserByIdentifier = async (identifier) => {
  const normalizedIdentifier = String(identifier || '').trim();
  const emailIdentifier = normalizedIdentifier.toLowerCase();

  const normalizePhoneCandidates = (value) => {
    const raw = String(value || '').trim();
    if (!raw) return [];

    const variants = new Set();
    const compact = raw.replace(/[\s().-]/g, '');
    const digitsOnly = compact.replace(/[^0-9+]/g, '');

    variants.add(raw);
    variants.add(compact);
    variants.add(digitsOnly);

    if (digitsOnly.startsWith('0') && digitsOnly.length > 1) {
      variants.add(`+84${digitsOnly.slice(1)}`);
      variants.add(`84${digitsOnly.slice(1)}`);
    }

    if (digitsOnly.startsWith('84') && !digitsOnly.startsWith('+84')) {
      variants.add(`+${digitsOnly}`);
    }

    if (digitsOnly.startsWith('+84')) {
      variants.add(digitsOnly);
      variants.add(digitsOnly.replace(/^\+/, ''));
      variants.add(`0${digitsOnly.slice(3)}`);
    }

    return [...variants].filter(Boolean);
  };

  const phoneCandidates = normalizePhoneCandidates(normalizedIdentifier);

  return User.findOne({
    where: {
      isActive: true,
      [Op.or]: [
        { phone: { [Op.in]: phoneCandidates } },
        { email: emailIdentifier },
      ],
    },
  });
};

const requestPasswordResetOtp = asyncHandler(async (req, res) => {
  const { phone, email } = req.body;
  const identifier = phone || email;
  const normalizedIdentifier = String(identifier || '').trim();

  if (!normalizedIdentifier) {
    throw new BadRequestError('Vui lòng nhập số điện thoại hoặc email');
  }

  const channel = resolveIdentifierChannel(normalizedIdentifier);
  if (!channel) {
    throw new BadRequestError('Số điện thoại hoặc email không hợp lệ');
  }

  const user = await findUserByIdentifier(normalizedIdentifier);
  if (!user) {
    return successResponse(res, {
      message: channel === 'email' 
        ? 'Nếu tài khoản tồn tại, OTP sẽ được gửi qua email'
        : 'Nếu tài khoản tồn tại, OTP sẽ được gửi qua Telegram',
      channel,
      destinationMasked: null,
    }, 'Nếu tài khoản tồn tại, OTP sẽ được gửi');
  }

  const now = Date.now();
  const recentRequests = await PasswordResetOtp.count({
    where: {
      userId: user.id,
      createdAt: {
        [Op.gte]: new Date(now - passwordResetConfig.requestWindowMs),
      },
    },
  });

  if (recentRequests >= passwordResetConfig.maxRequestsPerWindow) {
    throw new BadRequestError('Vui lòng thử lại sau 1 giờ');
  }

  const latestActiveRequest = await PasswordResetOtp.findOne({
    where: {
      userId: user.id,
      channel,
      consumedAt: null,
    },
    order: [['createdAt', 'DESC']],
  });

  if (latestActiveRequest?.lastSentAt) {
    const lastSentAt = new Date(latestActiveRequest.lastSentAt).getTime();
    if (now - lastSentAt < passwordResetConfig.resendCooldownMs) {
      return successResponse(res, {
        message: 'OTP đã được gửi gần đây. Vui lòng kiểm tra lại.',
        channel,
        destinationMasked: maskDestination(channel, latestActiveRequest.destination),
      }, 'Nếu tài khoản tồn tại, OTP sẽ được gửi');
    }
  }

  const otp = generateOtpCode();
  const destination = resolvePasswordResetDestination({ channel, user });

  if (!destination) {
    const errorMsg = channel === 'email' 
      ? 'Tài khoản này chưa có email để nhận OTP'
      : 'Tài khoản này chưa được liên kết Telegram để nhận OTP';
    throw new BadRequestError(errorMsg);
  }

  if (latestActiveRequest) {
    latestActiveRequest.identifier = normalizedIdentifier;
    latestActiveRequest.destination = destination;
    latestActiveRequest.otpHash = hashResetValue(otp);
    latestActiveRequest.resetTokenHash = null;
    latestActiveRequest.resetTokenExpiresAt = null;
    latestActiveRequest.expiresAt = new Date(Date.now() + passwordResetConfig.otpTtlMs);
    latestActiveRequest.verifiedAt = null;
    latestActiveRequest.consumedAt = null;
    latestActiveRequest.attemptCount = 0;
    latestActiveRequest.sendCount = (latestActiveRequest.sendCount || 0) + 1;
    latestActiveRequest.lastSentAt = new Date();
    latestActiveRequest.ipAddress = req.ip || null;
    latestActiveRequest.userAgent = req.get('user-agent') || null;
    await latestActiveRequest.save();
  } else {
    await PasswordResetOtp.create({
      userId: user.id,
      identifier: normalizedIdentifier,
      channel,
      destination,
      // Store a verifiable OTP so the reset flow can continue without external auth providers.
      otpHash: hashResetValue(otp),
      expiresAt: new Date(Date.now() + passwordResetConfig.otpTtlMs),
      verifiedAt: null,
      consumedAt: null,
      attemptCount: 0,
      sendCount: 1,
      lastSentAt: new Date(),
      ipAddress: req.ip || null,
      userAgent: req.get('user-agent') || null,
    });
  }

  await sendPasswordResetOtp({ channel, destination, otp, fullName: user.fullName });

  const responseData = {
    message: 'OTP đã được gửi',
    channel,
    destinationMasked: maskDestination(channel, destination),
    expiresInSeconds: Math.floor(passwordResetConfig.otpTtlMs / 1000),
  };

  if (config.isDevelopment) {
    responseData.debugOtp = otp;
  }

  return successResponse(res, responseData, 'Nếu tài khoản tồn tại, OTP sẽ được gửi');
});

const telegramLinkStatus = asyncHandler(async (req, res) => {
  const { phone } = req.query;
  const normalizedPhone = String(phone || '').trim();

  if (!normalizedPhone) {
    throw new BadRequestError('Vui lòng nhập số điện thoại');
  }

  const user = await findUserByIdentifier(normalizedPhone);
  const userTelegramChatId = user?.telegramChatId || null;

  const pendingLink = await TelegramLinkSession.findOne({
    where: {
      phone: normalizedPhone,
      consumedAt: null,
    },
    order: [['CreatedAt', 'DESC']],
  });

  const linked = Boolean(userTelegramChatId || pendingLink?.telegramChatId);

  return successResponse(res, {
    linked,
    phone: normalizedPhone,
    telegramChatId: userTelegramChatId || pendingLink?.telegramChatId || null,
    hasPendingLink: Boolean(pendingLink),
  }, linked ? 'Telegram đã được liên kết' : 'Telegram chưa được liên kết');
});

const telegramLinkWebhook = asyncHandler(async (req, res) => {
  const secret = String(req.get('x-telegram-webhook-secret') || '').trim();
  const expectedSecret = String(process.env.TELEGRAM_WEBHOOK_SECRET || '').trim();

  if (!expectedSecret || secret !== expectedSecret) {
    throw new UnauthorizedError('Webhook secret không hợp lệ');
  }

  const { phone, telegramChatId, startParam } = req.body;
  const normalizedPhone = String(phone || '').trim();
  const normalizedTelegramChatId = String(telegramChatId || '').trim();
  const normalizedStartParam = String(startParam || '').trim() || null;

  if (!normalizedPhone || !normalizedTelegramChatId) {
    throw new BadRequestError('Thiếu thông tin liên kết Telegram');
  }

  const [linkSession] = await TelegramLinkSession.upsert({
    phone: normalizedPhone,
    telegramChatId: normalizedTelegramChatId,
    startParam: normalizedStartParam,
    linkedAt: new Date(),
    consumedAt: null,
  }, { returning: true });

  const existingUser = await User.findOne({ where: { phone: normalizedPhone }, paranoid: false });
  if (existingUser) {
    existingUser.telegramChatId = normalizedTelegramChatId;
    await existingUser.save();
  }

  return successResponse(res, {
    linked: true,
    phone: normalizedPhone,
    telegramChatId: normalizedTelegramChatId,
    startParam: normalizedStartParam,
  }, 'Telegram đã được liên kết');
});

const verifyPasswordResetOtp = asyncHandler(async (req, res) => {
  const { phone, identifier, otp } = req.body;
  const normalizedPhone = String(phone || identifier || '').trim();

  if (!normalizedPhone || !otp) {
    throw new BadRequestError('Thiếu thông tin');
  }

  const channel = resolveIdentifierChannel(normalizedPhone);
  const user = await findUserByIdentifier(normalizedPhone);
  if (!user || !channel) {
    throw new BadRequestError('Mã OTP không hợp lệ hoặc đã hết hạn');
  }

  const record = await PasswordResetOtp.findOne({
    where: {
      userId: user.id,
      identifier: normalizedPhone,
      channel,
      consumedAt: null,
    },
    order: [['createdAt', 'DESC']],
  });

  if (!record || !record.otpHash || !record.expiresAt || new Date(record.expiresAt).getTime() < Date.now()) {
    throw new BadRequestError('Mã OTP không hợp lệ hoặc đã hết hạn');
  }

  const submittedHash = hashResetValue(String(otp).trim());
  if (submittedHash !== record.otpHash) {
    record.attemptCount = (record.attemptCount || 0) + 1;
    if (record.attemptCount >= passwordResetConfig.maxAttempts) {
      record.consumedAt = new Date();
    }
    await record.save();
    throw new BadRequestError('Mã OTP không hợp lệ hoặc đã hết hạn');
  }

  const resetToken = buildPasswordResetToken();
  record.verifiedAt = new Date();
  record.resetTokenHash = hashResetValue(resetToken);
  record.resetTokenExpiresAt = new Date(Date.now() + passwordResetConfig.resetTokenTtlMs);
  await record.save();

  return successResponse(res, {
    resetToken,
    expiresInSeconds: Math.floor(passwordResetConfig.resetTokenTtlMs / 1000),
    channel,
    destinationMasked: maskDestination(channel, record.destination),
  }, 'OTP hợp lệ');
});

const resetPasswordWithOtp = asyncHandler(async (req, res) => {
  const { phone, identifier, resetToken, newPassword, confirmPassword } = req.body;
  const normalizedPhone = String(phone || identifier || '').trim();

  if (!normalizedPhone || !resetToken || !newPassword) {
    throw new BadRequestError('Vui lòng cung cấp mã xác thực và mật khẩu mới');
  }

  if (newPassword.length < 6) {
    throw new BadRequestError('Mật khẩu mới phải có ít nhất 6 ký tự');
  }

  if (newPassword !== confirmPassword) {
    throw new BadRequestError('Mật khẩu xác nhận không khớp');
  }

  const channel = resolveIdentifierChannel(normalizedPhone);
  const user = await findUserByIdentifier(normalizedPhone);
  if (!user || !channel) {
    throw new BadRequestError('Mã xác thực không hợp lệ hoặc đã hết hạn');
  }

  const tokenHash = hashResetValue(String(resetToken).trim());
  const record = await PasswordResetOtp.findOne({
    where: {
      userId: user.id,
      identifier: normalizedPhone,
      channel,
      resetTokenHash: tokenHash,
      consumedAt: null,
    },
    order: [['createdAt', 'DESC']],
  });

  if (!record || !record.verifiedAt || !record.resetTokenExpiresAt || new Date(record.resetTokenExpiresAt).getTime() < Date.now()) {
    throw new BadRequestError('Mã xác thực không hợp lệ hoặc đã hết hạn');
  }

  user.password = newPassword;
  user.refreshToken = null;
  user.mustChangePassword = false;
  await user.save();

  record.consumedAt = new Date();
  await record.save();

  return successResponse(res, null, 'Đặt lại mật khẩu thành công. Vui lòng đăng nhập lại.');
});

/**
 * Complete profile on first login
 * POST /api/auth/complete-profile
 * Public endpoint - allows completing profile without full auth token
 */
const completeProfile = asyncHandler(async (req, res) => {
  const { userId, dateOfBirth, gender, address, idNumber } = req.body;

  if (!userId) {
    throw new BadRequestError('userId không được cung cấp');
  }

  // Find user without auth requirement (public endpoint but needs userId validation)
  const user = await User.findByPk(userId);

  if (!user) {
    throw new NotFoundError('Người dùng không tồn tại');
  }

  // Update user with provided fields
  const updateData = {};
  if (dateOfBirth) updateData.dateOfBirth = dateOfBirth;
  if (gender) updateData.gender = gender;
  if (address) updateData.address = address;
  if (idNumber) updateData.idNumber = idNumber;

  await user.update(updateData);

  // Update patient record if user is patient
  if (user.role === ROLES.PATIENT) {
    await Patient.update(
      {
        dateOfBirth: dateOfBirth || undefined,
        gender: gender || undefined,
        address: address || undefined,
        idNumber: idNumber || undefined,
      },
      { where: { userId: user.id } }
    ).catch(() => {
      // Ignore patient update errors
    });
  }

  // Generate tokens to allow login to proceed
  const { accessToken, refreshToken } = generateTokens(user);

  // Save refresh token
  user.refreshToken = refreshToken;
  await user.save();

  // Get patient info if patient
  let patientInfo = null;
  if (user.role === ROLES.PATIENT) {
    const patientWhere = { userId: user.id };
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
  }, 'Hồ sơ đã được hoàn thiện');
});

/**
 * Clear all password reset requests (DEVELOPMENT ONLY)
 * DELETE /api/auth/dev/clear-reset-requests
 */
const clearPasswordResetRequests = asyncHandler(async (req, res) => {
  if (config.env !== 'development') {
    throw new UnauthorizedError('Endpoint này chỉ khả dụng trong môi trường development');
  }

  const count = await PasswordResetOtp.destroy({ where: {}, force: true });

  return successResponse(res, { deletedCount: count }, `Đã xóa ${count} yêu cầu reset password`);
});

/**
 * Complete Telegram linking (public)
 * POST /api/auth/complete-telegram-link
 */
const completeTelegramLink = asyncHandler(async (req, res) => {
  const { phone } = req.body;
  const normalizedPhone = String(phone || '').trim();

  if (!normalizedPhone) {
    throw new BadRequestError('Số điện thoại không được cung cấp');
  }

  // Find user by phone
  const user = await findUserByIdentifier(normalizedPhone);
  if (!user) {
    throw new NotFoundError('Không tìm thấy người dùng');
  }

  // Check if Telegram is linked
  const linkedSession = await TelegramLinkSession.findOne({
    where: {
      phone: normalizedPhone,
      consumedAt: null,
    },
    order: [['CreatedAt', 'DESC']],
  });

  if (!linkedSession || !linkedSession.telegramChatId) {
    throw new BadRequestError('Chưa tìm thấy liên kết Telegram. Vui lòng liên kết Telegram trước.');
  }

  // Update user
  user.telegramChatId = linkedSession.telegramChatId;
  user.mustLinkTelegram = false;
  await user.save();

  // Mark session as consumed
  linkedSession.consumedAt = new Date();
  await linkedSession.save();

  // Get patient info if patient
  let patientInfo = null;
  if (user.role === ROLES.PATIENT) {
    try {
      patientInfo = await Patient.findOne({ where: { userId: user.id } });
    } catch (e) {
      // ignore
    }
  }

  return successResponse(res, {
    user: {
      ...user.toJSON(),
      patientId: patientInfo?.id,
    },
  }, 'Liên kết Telegram thành công');
});

export {
  login,
  register,
  refreshAccessToken,
  logout,
  getCurrentUser,
  changePassword,
  updateProfile,
  requestPasswordResetOtp,
  verifyPasswordResetOtp,
  resetPasswordWithOtp,
  telegramLinkStatus,
  telegramLinkWebhook,
  completeChangePassword,
  completeProfile,
  clearPasswordResetRequests,
  completeTelegramLink,
};
