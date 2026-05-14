/**
 * Telegram Bot Service
 * Xử lý webhook và polling từ Telegram bot
 */
import logger from '../utils/logger.js';
import { TelegramLinkSession } from '../models/index.js';

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_API_URL = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`;

/**
 * Gửi tin nhắn qua Telegram
 */
export const sendTelegramMessage = async (chatId, text) => {
  if (!TELEGRAM_BOT_TOKEN) {
    throw new Error('TELEGRAM_BOT_TOKEN chưa được cấu hình');
  }

  const response = await fetch(`${TELEGRAM_API_URL}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: 'HTML',
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Telegram API error: ${error}`);
  }

  return response.json();
};

/**
 * Xử lý tin nhắn /start từ user
 */
export const handleStartCommand = async (message) => {
  const chatId = message.chat.id;
  const text = message.text || '';
  const username = message.from.username || '';
  const firstName = message.from.first_name || '';

  logger.info('Telegram /start command received', { chatId, text, username, firstName });

  // Parse start parameter: /start PHONE_0866816201
  const match = text.match(/\/start\s+PHONE_(.+)/);
  
  if (!match) {
    await sendTelegramMessage(
      chatId,
      '❌ Liên kết không hợp lệ.\n\nVui lòng sử dụng nút "Liên kết Telegram" từ trang đăng ký để lấy link đúng.'
    );
    return;
  }

  const phone = match[1].trim();

  try {
    // Lưu hoặc cập nhật session
    const [session, created] = await TelegramLinkSession.upsert({
      phone,
      telegramChatId: String(chatId),
      startParam: text,
      linkedAt: new Date(),
      consumedAt: null,
    }, {
      returning: true,
    });

    logger.info('Telegram link session created/updated', { 
      phone, 
      chatId, 
      created,
      sessionId: session.id 
    });

    await sendTelegramMessage(
      chatId,
      `✅ <b>Liên kết thành công!</b>\n\n` +
      `Số điện thoại: <code>${phone}</code>\n` +
      `Telegram Chat ID: <code>${chatId}</code>\n\n` +
      `Bạn có thể quay lại trang đăng ký và bấm "Kiểm tra liên kết" để tiếp tục.\n\n` +
      `Bot này sẽ gửi mã OTP khi bạn quên mật khẩu.`
    );
  } catch (error) {
    logger.error('Error creating telegram link session', { error: error.message, phone, chatId });
    
    await sendTelegramMessage(
      chatId,
      '❌ Có lỗi xảy ra khi liên kết. Vui lòng thử lại sau.'
    );
  }
};

/**
 * Xử lý update từ Telegram (webhook hoặc polling)
 */
export const handleTelegramUpdate = async (update) => {
  try {
    if (update.message) {
      const message = update.message;
      
      // Xử lý lệnh /start
      if (message.text && message.text.startsWith('/start')) {
        await handleStartCommand(message);
        return;
      }

      // Các lệnh khác có thể thêm sau
      if (message.text === '/help') {
        await sendTelegramMessage(
          message.chat.id,
          '📋 <b>Hướng dẫn sử dụng bot</b>\n\n' +
          '1. Sử dụng nút "Liên kết Telegram" từ trang đăng ký\n' +
          '2. Bot sẽ lưu số điện thoại của bạn\n' +
          '3. Khi quên mật khẩu, bot sẽ gửi mã OTP cho bạn'
        );
      }
    }
  } catch (error) {
    logger.error('Error handling telegram update', { error: error.message, update });
  }
};

/**
 * Bắt đầu polling (cho development)
 */
export const startTelegramPolling = () => {
  if (!TELEGRAM_BOT_TOKEN) {
    logger.warn('TELEGRAM_BOT_TOKEN not configured, skipping polling');
    return;
  }

  let offset = 0;
  let isPolling = false;

  const poll = async () => {
    if (isPolling) return;
    isPolling = true;

    try {
      const response = await fetch(`${TELEGRAM_API_URL}/getUpdates?offset=${offset}&timeout=30`);
      
      if (!response.ok) {
        throw new Error(`Telegram API error: ${response.status}`);
      }

      const data = await response.json();

      if (data.ok && data.result.length > 0) {
        for (const update of data.result) {
          await handleTelegramUpdate(update);
          offset = update.update_id + 1;
        }
      }
    } catch (error) {
      logger.error('Telegram polling error', { error: error.message });
    } finally {
      isPolling = false;
    }
  };

  // Poll mỗi 2 giây
  setInterval(poll, 2000);
  logger.info('Telegram bot polling started');
};

/**
 * Cấu hình webhook (cho production)
 */
export const setTelegramWebhook = async (webhookUrl) => {
  if (!TELEGRAM_BOT_TOKEN) {
    throw new Error('TELEGRAM_BOT_TOKEN chưa được cấu hình');
  }

  const response = await fetch(`${TELEGRAM_API_URL}/setWebhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: webhookUrl }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to set webhook: ${error}`);
  }

  const data = await response.json();
  logger.info('Telegram webhook set', { webhookUrl, data });
  return data;
};

/**
 * Xóa webhook (chuyển về polling)
 */
export const deleteTelegramWebhook = async () => {
  if (!TELEGRAM_BOT_TOKEN) {
    throw new Error('TELEGRAM_BOT_TOKEN chưa được cấu hình');
  }

  const response = await fetch(`${TELEGRAM_API_URL}/deleteWebhook`);
  const data = await response.json();
  logger.info('Telegram webhook deleted', data);
  return data;
};
