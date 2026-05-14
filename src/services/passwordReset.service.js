import crypto from 'crypto';
import nodemailer from 'nodemailer';
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
  if (isPhoneIdentifier(text)) return 'telegram';
  return null;
};

export const normalizeTelegramChatId = (value) => {
  const text = String(value || '').trim();
  return text ? text : null;
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

const maskTelegram = (chatId) => {
  const text = String(chatId || '').trim();
  if (!text) return 'Telegram';

  if (text.startsWith('@')) {
    const handle = text.slice(1);
    if (handle.length <= 2) return `@${handle}`;
    return `@${handle.slice(0, 2)}***${handle.slice(-1)}`;
  }

  const digits = text.replace(/\D/g, '');
  if (digits.length <= 4) return 'Telegram';
  return `Telegram ...${digits.slice(-4)}`;
};

export const maskDestination = (channel, destination) => {
  if (channel === 'email') return maskEmail(destination);
  if (channel === 'telegram') return maskTelegram(destination);
  return maskPhone(destination);
};

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

const getTelegramBotToken = () => String(process.env.TELEGRAM_BOT_TOKEN || '').trim();

const getTelegramChatId = (destination) => normalizeTelegramChatId(destination);

const sendTelegramOtp = async ({ to, otp, fullName }) => {
  const chatId = getTelegramChatId(to);
  const botToken = getTelegramBotToken();

  if (!chatId || !botToken) {
    if (config.isDevelopment) {
      logger.info('Password reset OTP (telegram fallback)', {
        chatId: chatId || 'not-configured',
        otp,
      });
      return { provider: 'log', delivered: true };
    }

    throw new Error('Thiếu cấu hình Telegram để gửi OTP');
  }

  const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      chat_id: chatId,
      text: `Xin chào ${fullName || ''},\n\nMã OTP đặt lại mật khẩu của bạn là: ${otp}\nMã có hiệu lực trong 10 phút. Nếu bạn không yêu cầu, hãy bỏ qua tin nhắn này.`,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    throw new Error(`Telegram API lỗi ${response.status}: ${errorText.slice(0, 200)}`);
  }

  return { provider: 'telegram', delivered: true };
};

export const sendPasswordResetOtp = async ({ channel, destination, otp, fullName }) => {
  if (channel === 'email') {
    return sendEmailOtp({ to: destination, otp, fullName });
  }
  if (channel === 'telegram') {
    return sendTelegramOtp({ to: destination, otp, fullName });
  }
  throw new Error('Kênh gửi OTP không hợp lệ');
};

export const resolvePasswordResetDestination = ({ channel, user }) => {
  if (channel === 'email') {
    return user?.email ? String(user.email).trim() : null;
  }
  if (channel === 'telegram') {
    return normalizeTelegramChatId(user?.telegramChatId);
  }

  return null;
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
