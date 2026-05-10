import { Notification } from '../models/index.js';
import { asyncHandler } from '../utils/helpers.js';
import { successResponse } from '../utils/response.js';
import { ROLES } from '../config/constants.js';
import { Op } from 'sequelize';

/**
 * Get all notifications for current user/role
 */
export const getMyNotifications = asyncHandler(async (req, res) => {
  const { role, id: userId } = req.user;
  
  const where = {
    [Op.or]: [
      { role: String(role) },
      { userId: userId }
    ]
  };

  const notifications = await Notification.findAll({
    where,
    order: [['createdAt', 'DESC']],
    limit: 50
  });

  const unreadCount = await Notification.count({
    where: {
      ...where,
      isRead: false
    }
  });

  return successResponse(res, {
    notifications,
    unreadCount
  });
});

/**
 * Mark a notification as read
 */
export const markAsRead = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { role, id: userId } = req.user;

  const notification = await Notification.findByPk(id);

  if (!notification) {
    return res.status(404).json({ message: 'Notification not found' });
  }

  // Security check: ensure user has right to mark this as read
  if (notification.userId && notification.userId !== userId) {
    return res.status(403).json({ message: 'Forbidden' });
  }
  if (notification.role && notification.role !== String(role)) {
    return res.status(403).json({ message: 'Forbidden' });
  }

  notification.isRead = true;
  await notification.save();

  return successResponse(res, notification, 'Marked as read');
});

/**
 * Mark all as read
 */
export const markAllAsRead = asyncHandler(async (req, res) => {
  const { role, id: userId } = req.user;

  const where = {
    [Op.or]: [
      { role: String(role) },
      { userId: userId }
    ],
    isRead: false
  };

  await Notification.update({ isRead: true }, { where });

  return successResponse(res, null, 'All marked as read');
});
