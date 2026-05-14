/**
 * Test Telegram Bot Token
 * Kiểm tra xem bot token có hợp lệ không
 */
import 'dotenv/config';

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

async function testTelegramBot() {
  console.log('🔍 Kiểm tra Telegram Bot Token...\n');

  if (!TELEGRAM_BOT_TOKEN) {
    console.error('❌ TELEGRAM_BOT_TOKEN không được cấu hình trong .env');
    process.exit(1);
  }

  console.log(`✅ Token tìm thấy: ${TELEGRAM_BOT_TOKEN.slice(0, 10)}...${TELEGRAM_BOT_TOKEN.slice(-10)}\n`);

  try {
    // Test getMe API
    console.log('📡 Đang gọi Telegram API getMe...');
    const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getMe`);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ Telegram API trả về lỗi ${response.status}:`);
      console.error(errorText);
      process.exit(1);
    }

    const data = await response.json();
    
    if (data.ok) {
      console.log('✅ Bot token hợp lệ!\n');
      console.log('📋 Thông tin bot:');
      console.log(`   - ID: ${data.result.id}`);
      console.log(`   - Username: @${data.result.username}`);
      console.log(`   - First Name: ${data.result.first_name}`);
      console.log(`   - Can Join Groups: ${data.result.can_join_groups}`);
      console.log(`   - Can Read All Group Messages: ${data.result.can_read_all_group_messages}`);
      console.log(`   - Supports Inline Queries: ${data.result.supports_inline_queries}`);
      
      console.log('\n✅ Telegram bot đã sẵn sàng sử dụng!');
      console.log(`\n🔗 Link để start bot: https://t.me/${data.result.username}`);
    } else {
      console.error('❌ Telegram API trả về ok=false');
      console.error(JSON.stringify(data, null, 2));
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Lỗi khi kiểm tra bot token:');
    console.error(error.message);
    process.exit(1);
  }
}

testTelegramBot();
