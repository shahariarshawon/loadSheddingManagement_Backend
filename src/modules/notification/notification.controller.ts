import { Request, Response, NextFunction } from 'express';
import { NotificationService } from './notification.service.js';
import { sendSuccess } from '../../utils/response.js';
import { AppError } from '../../utils/appError.js';

export class NotificationController {
  static async getNotifications(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        throw AppError.unauthorized('Authentication required.');
      }

      const result = await NotificationService.getUserNotifications(
        req.user.id,
        req.query,
      );

      return sendSuccess(res, 200, {
        message: 'Notifications retrieved successfully',
        data: {
          notifications: result.notifications,
          unreadCount: result.unreadCount,
        },
        meta: result.meta,
      });
    } catch (error) {
      return next(error);
    }
  }

  static async markAsRead(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        throw AppError.unauthorized('Authentication required.');
      }

      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const notification = await NotificationService.markAsRead(req.user.id, id);

      return sendSuccess(res, 200, {
        message: 'Notification marked as read',
        data: notification,
      });
    } catch (error) {
      return next(error);
    }
  }

  static async markAllAsRead(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        throw AppError.unauthorized('Authentication required.');
      }

      const result = await NotificationService.markAllAsRead(req.user.id);

      return sendSuccess(res, 200, {
        message: 'All notifications marked as read',
        data: result,
      });
    } catch (error) {
      return next(error);
    }
  }
}
