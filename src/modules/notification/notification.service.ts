import { prisma } from '../../config/prisma.js';
import { AppError } from '../../utils/appError.js';
import { parsePagination, buildPaginationMeta } from '../../utils/pagination.js';
import { Prisma } from '../../generated/prisma/client.js';

export class NotificationService {
  /**
   * Get user notifications with isRead filter, unread count, and pagination
   */
  static async getUserNotifications(userId: string, query: Record<string, unknown>) {
    const { page, limit, skip, sortBy, sortOrder } = parsePagination(
      query,
      ['createdAt', 'isRead'],
      'createdAt',
      'desc',
    );

    const isRead =
      query.isRead === 'true' || query.isRead === true
        ? true
        : query.isRead === 'false' || query.isRead === false
          ? false
          : undefined;

    const where: Prisma.NotificationWhereInput = {
      userId,
      ...(isRead !== undefined && { isRead }),
    };

    const [total, unreadCount, notifications] = await Promise.all([
      prisma.notification.count({ where }),
      prisma.notification.count({ where: { userId, isRead: false } }),
      prisma.notification.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
      }),
    ]);

    return {
      notifications,
      unreadCount,
      meta: buildPaginationMeta(total, page, limit),
    };
  }

  /**
   * Mark a specific notification as read
   */
  static async markAsRead(userId: string, notificationId: string) {
    const notification = await prisma.notification.findUnique({
      where: { id: notificationId },
    });

    if (!notification || notification.userId !== userId) {
      throw AppError.notFound(`Notification with ID '${notificationId}' not found.`);
    }

    const updated = await prisma.notification.update({
      where: { id: notificationId },
      data: { isRead: true },
    });

    return updated;
  }

  /**
   * Mark all unread notifications as read for current user
   */
  static async markAllAsRead(userId: string) {
    const result = await prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });

    return { updatedCount: result.count };
  }
}
