/**
 * Server Entry Point
 * Starts the Express server and database connection
 */
import 'dotenv/config';

import app from './app.js';
import config from './config/index.js';
import { sequelize } from './models/database.js';
import logger from './utils/logger.js';

// Graceful shutdown handlers
const gracefulShutdown = async (signal) => {
  logger.info(`${signal} received. Bắt đầu tắt máy chủ...`);
  
  try {
    // Close database connection
    await sequelize.close();
    logger.info('✅ Đã đóng kết nối tới cơ sở dữ liệu');
    
    process.exit(0);
  } catch (error) {
    logger.error('❌ Lỗi khi tắt máy chủ:', error);
    process.exit(1);
  }
};

// Handle process signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('❌ Ngoại lệ chưa được bắt:', error);
  process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error('❌ Promise bị từ chối chưa xử lý tại:', promise, 'lý do:', reason);
});

// Start server
const startServer = async () => {
  try {
    // Test database connection
    await sequelize.authenticate();
    logger.info('✅ Kết nối tới cơ sở dữ liệu thành công');

    // NOTE: Tắt sync tự động - sử dụng SQL script hoặc migrations để tạo bảng
    // Các bảng đã được tạo sẵn trong database bằng file database/schema.sql
    // Nếu muốn tạo bảng mới từ models, chạy: npm run seed:vn
    
    // Start Express server
    const server = app.listen(config.port, () => {
      logger.info(`Máy chủ đang chạy trên cổng ${config.port} (chế độ ${config.env})`);
      logger.info(`API truy cập tại http://localhost:${config.port}/api`);
    });

    // Handle server errors
    server.on('error', (error) => {
      if (error.code === 'EADDRINUSE') {
        logger.error(`❌ Cổng ${config.port} đang được sử dụng`);
      } else {
        logger.error('❌ Lỗi máy chủ:', error);
      }
      process.exit(1);
    });

  } catch (error) {
    logger.error('❌ Không thể khởi động máy chủ:', error);
    process.exit(1);
  }
};

// Start the server
startServer();
