/**
 * Sequelize Database Instance
 * Central database connection management
 */
const { Sequelize } = require('sequelize');
const config = require('../config');
const logger = require('../utils/logger');

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
      underscored: true,
      freezeTableName: true,
    },
  }
);

// Test connection
const connectDatabase = async () => {
  try {
    await sequelize.authenticate();
    logger.info('✅ Database connection established successfully');
    return true;
  } catch (error) {
    logger.error('❌ Unable to connect to the database:', error);
    throw error;
  }
};

// Sync database (development only)
const syncDatabase = async (force = false) => {
  try {
    if (config.isDevelopment) {
      await sequelize.sync({ force, alter: !force });
      logger.info('✅ Database synchronized successfully');
    }
    return true;
  } catch (error) {
    logger.error('❌ Database sync failed:', error);
    throw error;
  }
};

module.exports = {
  sequelize,
  connectDatabase,
  syncDatabase,
  Sequelize,
};
