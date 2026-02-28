/**
 * Sequelize Database Configuration
 * Supports multiple environments
 */
const config = require('./index');

module.exports = {
  development: {
    username: config.database.username,
    password: config.database.password,
    database: config.database.name,
    host: config.database.host,
    port: config.database.port,
    dialect: config.database.dialect,
    dialectOptions: config.database.dialectOptions,
    pool: config.database.pool,
    logging: console.log,
  },
  test: {
    username: config.database.username,
    password: config.database.password,
    database: `${config.database.name}_test`,
    host: config.database.host,
    port: config.database.port,
    dialect: config.database.dialect,
    dialectOptions: config.database.dialectOptions,
    pool: config.database.pool,
    logging: false,
  },
  production: {
    username: config.database.username,
    password: config.database.password,
    database: config.database.name,
    host: config.database.host,
    port: config.database.port,
    dialect: config.database.dialect,
    dialectOptions: {
      ...config.database.dialectOptions,
      options: {
        ...config.database.dialectOptions.options,
        encrypt: true,
      },
    },
    pool: config.database.pool,
    logging: false,
  },
};
