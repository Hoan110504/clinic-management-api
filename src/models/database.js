/**
 * Sequelize Database Instance
 * Central database connection management
 */
import { Sequelize } from 'sequelize';
import config from '../config/index.js';
import logger from '../utils/logger.js';

const sequelize = new Sequelize(
  config.database.name,
  config.database.username,
  config.database.password,
  {
    host: config.database.host,
    port: config.database.port,
    dialect: config.database.dialect,
    dialectOptions: config.database.dialectOptions,
    pool: config.database.pool,
    logging: config.isDevelopment ? (msg) => logger.debug(msg) : false,
    define: {
      timestamps: true,
      // Disable automatic underscoring so explicit `field` mappings in models
      // (e.g. field: 'MedicineId') are honored and Sequelize does not
      // convert attribute names to snake_case (medicine_id) unexpectedly.
      underscored: false,
      freezeTableName: true,
    },
  }
);

// Test connection
const connectDatabase = async () => {
  try {
    await sequelize.authenticate();
    logger.info('✅ Kết nối đến cơ sở dữ liệu thành công');
    return true;
  } catch (error) {
    logger.error('❌ Không thể kết nối tới cơ sở dữ liệu:', error);
    throw error;
  }
};

// Sync database (development only)
const syncDatabase = async (force = false) => {
  try {
    if (config.isDevelopment) {
      await sequelize.sync({ force, alter: !force });
      logger.info('✅ Đồng bộ hóa cơ sở dữ liệu thành công');
    }
    return true;
  } catch (error) {
    logger.error('❌ Đồng bộ cơ sở dữ liệu thất bại:', error);
    throw error;
  }
};

export { sequelize, connectDatabase, syncDatabase, Sequelize };
