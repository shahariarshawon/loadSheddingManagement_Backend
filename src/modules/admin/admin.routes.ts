import { Router } from 'express';
import { AdminController } from './admin.controller.js';
import { authenticateUser, authorizeRoles } from '../../middlewares/auth.js';
import { Role } from '../../generated/prisma/client.js';

const adminRouter = Router();

// All admin routes strictly require authentication and ADMIN role
adminRouter.use(authenticateUser, authorizeRoles(Role.ADMIN));

adminRouter.get('/users', AdminController.listUsers);
adminRouter.patch('/users/:id/role', AdminController.updateUserRole);
adminRouter.patch('/users/:id/status', AdminController.updateUserStatus);
adminRouter.get('/audit-logs', AdminController.listAuditLogs);
adminRouter.get('/stats', AdminController.getSystemStats);

export default adminRouter;
