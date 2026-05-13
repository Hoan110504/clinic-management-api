import crypto from 'crypto';
import nodemailer from 'nodemailer';
import Twilio from 'twilio';
import config from '../config/index.js';
import logger from '../utils/logger.js';

const OTP_LENGTH = 6;
const OTP_TTL_MS = 10 * 60 * 1000;
const RESET_TOKEN_TTL_MS = 10 * 60 * 1000;
const RESEND_COOLDOWN_MS = 60 * 1000;
const MAX_ATTEMPTS = 5;
const MAX_REQUESTS_PER_WINDOW = 5;
const REQUEST_WINDOW_MS = 60 * 60 * 1000;

const getPasswordResetPepper = () => process.env.PASSWORD_RESET_OTP_PEPPER || config.jwt.secret || 'password-reset-otp-pepper';

export const normalizeIdentifier = (identifier) => String(identifier || '').trim();

export const isEmailIdentifier = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim());

export const isPhoneIdentifier = (value) => /^[0-9+\-\s()]{3,15}$/.test(String(value || '').trim());

export const resolveIdentifierChannel = (identifier) => {
  const text = normalizeIdentifier(identifier);
  if (isEmailIdentifier(text)) return 'email';
  if (isPhoneIdentifier(text)) return 'sms';
  return null;
};

export const generateOtpCode = () => String(crypto.randomInt(0, 1000000)).padStart(6, '0');

export const hashResetValue = (value) => crypto
  .createHash('sha256')
  .update(`${String(value)}:${getPasswordResetPepper()}`)
  .digest('hex');

export const timingSafeEquals = (a, b) => {
  const left = Buffer.from(String(a || ''), 'hex');
  const right = Buffer.from(String(b || ''), 'hex');
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
};

const getSmtpTransport = () => {
  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT, 10) || 587;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) return null;

  return nodemailer.createTransport({
    host,
    port,
    secure: process.env.SMTP_SECURE === 'true' || port === 465,
    auth: { user, pass },
  });
};

const resolveSmtpFromAddress = () => {
  const configuredFrom = String(process.env.SMTP_FROM || '').trim();
  const smtpUser = String(process.env.SMTP_USER || '').trim();

  // If SMTP_FROM is only a display name (no address), use SMTP_USER as sender address.
  if (!configuredFrom) return smtpUser;
  if (!configuredFrom.includes('@')) return smtpUser;
  return configuredFrom;
};

const getTwilioClient = () => {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;

  if (!accountSid || !authToken) return null;
  return Twilio(accountSid, authToken);
};

const isTwilioRecipientVerified = async (client, phoneNumber) => {
  if (!client || !phoneNumber) return false;

  try {
    const verified = await client.outgoingCallerIds.list({ phoneNumber, limit: 1 });
    return Array.isArray(verified) && verified.length > 0;
  } catch (error) {
    logger.warn('Không kiểm tra được số nhận đã verify trên Twilio', {
      phoneNumber: maskPhone(phoneNumber),
      error: error?.message,
    });
    return false;
  }
};

const normalizePhoneToE164 = (phone) => {
  const raw = String(phone || '').trim();
  if (!raw) return raw;

  let digits = raw.replace(/[\s().-]/g, '');
  if (digits.startsWith('+')) {
    return `+${digits.slice(1).replace(/\D/g, '')}`;
  }

  digits = digits.replace(/\D/g, '');
  // VN local format 0xxxxxxxxx -> +84xxxxxxxxx
  if (digits.startsWith('0')) {
    return `+84${digits.slice(1)}`;
  }
  // If already starts with country code without plus
  if (digits.startsWith('84')) {
    return `+${digits}`;
  }
  return `+${digits}`;
};

const maskEmail = (email) => {
  const text = String(email || '').trim();
  if (!text.includes('@')) return text;
  const [name, domain] = text.split('@');
  if (name.length <= 2) return `${name[0] || ''}***@${domain}`;
  return `${name.slice(0, 2)}***@${domain}`;
};

const maskPhone = (phone) => {
  const text = String(phone || '').trim();
  if (text.length <= 4) return '***';
  return `${text.slice(0, 3)}***${text.slice(-2)}`;
};

export const maskDestination = (channel, destination) => (channel === 'email' ? maskEmail(destination) : maskPhone(destination));

const sendEmailOtp = async ({ to, otp, fullName }) => {
  const transport = getSmtpTransport();
  if (!transport) {
    if (config.isDevelopment) {
      logger.info('Password reset OTP (email fallback)', { to: maskEmail(to), otp });
      return { provider: 'log', delivered: true };
    }
    throw new Error('Thiếu cấu hình SMTP để gửi OTP qua email');
  }

  const from = process.env.SMTP_FROM || process.env.SMTP_USER;
  await transport.sendMail({
    from: resolveSmtpFromAddress() || from,
    to,
    subject: 'Mã xác thực đặt lại mật khẩu',
    text: `Xin chào ${fullName || ''},\n\nMã OTP đặt lại mật khẩu của bạn là: ${otp}\nMã có hiệu lực trong 10 phút. Nếu bạn không yêu cầu, hãy bỏ qua email này.`,
    html: `<p>Xin chào ${fullName || ''},</p><p>Mã OTP đặt lại mật khẩu của bạn là <strong>${otp}</strong>.</p><p>Mã có hiệu lực trong 10 phút.</p><p>Nếu bạn không yêu cầu, hãy bỏ qua email này.</p>`,
  });

  return { provider: 'smtp', delivered: true };
};

const sendSmsOtp = async ({ to, otp, fullName }) => {
  const client = getTwilioClient();
  const from = process.env.TWILIO_PHONE_NUMBER;
  const toE164 = normalizePhoneToE164(to);

  if (!client || !from) {
    if (config.isDevelopment) {
      logger.info('Password reset OTP (sms fallback)', { to: maskPhone(to), otp, fullName });
      return { provider: 'log', delivered: true };
    }
    throw new Error('Thiếu cấu hình Twilio để gửi OTP qua SMS');
  }

  const recipientVerified = await isTwilioRecipientVerified(client, toE164);
  if (!recipientVerified) {
    throw new Error('So dien thoai nhan chua duoc verify trong Twilio trial. Hay verify so nhan trong Twilio Console');
  }

  try {
    await client.messages.create({
      body: `Ma OTP dat lai mat khau cua ban la: ${otp}. Hieu luc 10 phut.`,
      from,
      to: toE164,
    });
  } catch (error) {
    const twilioCode = error?.code;
    if (twilioCode === 21606 || twilioCode === 21212 || twilioCode === 21659) {
      throw new Error('So dien thoai gui Twilio khong hop le hoac khong thuoc tai khoan Twilio');
    }
    if (twilioCode === 21608) {
      throw new Error('Twilio trial chi gui den so da verify trong Twilio Console');
    }
    if (twilioCode === 20003 || twilioCode === 20429) {
      throw new Error('Twilio authentication/permission error. Kiem tra SID, token va trial restrictions');
    }
    throw error;
  }

  return { provider: 'twilio', delivered: true };
};

export const sendPasswordResetOtp = async ({ channel, destination, otp, fullName }) => {
  if (channel === 'email') {
    return sendEmailOtp({ to: destination, otp, fullName });
  }
  if (channel === 'sms') {
    return sendSmsOtp({ to: destination, otp, fullName });
  }
  throw new Error('Kênh gửi OTP không hợp lệ');
};

export const buildPasswordResetToken = () => crypto.randomBytes(32).toString('hex');

export const createPasswordResetSnapshot = ({ otp, resetToken }) => ({
  otpHash: hashResetValue(otp),
  resetTokenHash: hashResetValue(resetToken),
  expiresAt: new Date(Date.now() + OTP_TTL_MS),
  resetTokenExpiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS),
});

export const passwordResetConfig = {
  otpLength: OTP_LENGTH,
  otpTtlMs: OTP_TTL_MS,
  resetTokenTtlMs: RESET_TOKEN_TTL_MS,
  resendCooldownMs: RESEND_COOLDOWN_MS,
  maxAttempts: MAX_ATTEMPTS,
  maxRequestsPerWindow: MAX_REQUESTS_PER_WINDOW,
  requestWindowMs: REQUEST_WINDOW_MS,
};
