/**
 * Server Entry Point
 * Starts the Express server and database connection
 */
import 'dotenv/config';

import http from 'http';
import { Server } from 'socket.io';
import app from './app.js';
import config from './config/index.js';
import { sequelize } from './models/database.js';
import logger from './utils/logger.js';
import { setupSocketIO } from './socket/index.js';
import { startTelegramPolling } from './services/telegram.service.js';

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

    
    // Create HTTP server for Socket.IO
    const server = http.createServer(app);
    
    // Setup Socket.IO
    const io = new Server(server, {
      cors: {
        origin: config.cors.origin,
        credentials: config.cors.credentials,
        methods: ['GET', 'POST', 'PUT', 'DELETE'],
      },
      transports: ['websocket', 'polling'],
      path: '/socket.io',
      pingInterval: 25000,
      pingTimeout: 60000,
    });

    // Setup Socket.IO event handlers
    setupSocketIO(io);
    
    // Make io accessible to routes via app.set
    app.set('io', io);
    
    // Start Express server with HTTP
    server.listen(config.port, () => {
      logger.info(`Máy chủ đang chạy trên cổng ${config.port} (chế độ ${config.env})`);
      logger.info(`API truy cập tại http://localhost:${config.port}/api`);
      logger.info(`Socket.IO đã khởi động trên ws://localhost:${config.port}/socket.io`);
      
      // Start Telegram bot polling (development mode)
      if (process.env.TELEGRAM_BOT_TOKEN) {
        startTelegramPolling();
        logger.info('🤖 Telegram bot polling đã khởi động');
      }
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
