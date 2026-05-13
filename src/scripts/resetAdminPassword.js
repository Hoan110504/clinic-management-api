#!/usr/bin/env node
import 'dotenv/config';
import logger from '../utils/logger.js';
import { connectDatabase } from '../models/database.js';
import models from '../models/index.js';
import { ROLES } from '../config/constants.js';

async function run() {
  try {
    await connectDatabase();

    const { User } = models;
    if (!User) {
      logger.error('User model not found');
      process.exit(1);
    }

    const phone = '0901234567';
    const newPassword = 'admin123';

    let user = await User.findOne({ where: { phone } });
    if (!user) {
      logger.info('Admin user not found, creating new admin...');
      user = await User.create({
        phone,
        email: 'admin@phongkham.com',
        password: newPassword,
        fullName: 'Quản Trị Viên',
        role: ROLES.ADMIN,
        isActive: true,
      });
      logger.info('Created admin user.');
    } else {
      user.password = newPassword;
      await user.save();
      logger.info('Updated admin password.');
    }

    logger.info(`Admin credentials: ${phone} / ${newPassword}`);
    process.exit(0);
  } catch (err) {
    logger.error('Failed to reset admin password:', err);
    process.exit(1);
  }
}

run();
