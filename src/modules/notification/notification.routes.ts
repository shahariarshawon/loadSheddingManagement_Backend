import { Router } from 'express';
import { NotificationController } from './notification.controller.js';
import { authenticateUser } from '../../middlewares/auth.js';

const notificationRouter = Router();

notificationRouter.get(
  '/',
  authenticateUser,
  NotificationController.getNotifications,
);

notificationRouter.patch(
  '/read-all',
  authenticateUser,
  NotificationController.markAllAsRead,
);

notificationRouter.patch(
  '/:id/read',
  authenticateUser,
  NotificationController.markAsRead,
);

export default notificationRouter;
