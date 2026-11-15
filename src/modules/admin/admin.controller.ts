import { Request, Response, NextFunction } from 'express';
import { AdminService } from './admin.service.js';
import {
  listUsersQuerySchema,
  updateRoleSchema,
  updateStatusSchema,
  listAuditLogsQuerySchema,
} from './admin.validation.js';
import { sendSuccess } from '../../utils/response.js';
import { AppError } from '../../utils/appError.js';

export class AdminController {
  static async listUsers(req: Request, res: Response, next: NextFunction) {
    try {
      const query = listUsersQuerySchema.parse(req.query);
      const result = await AdminService.listUsers(query);

      return sendSuccess(res, 200, {
        message: 'Users retrieved successfully',
        data: result.users,
        meta: result.meta,
      });
    } catch (error) {
      return next(error);
    }
  }

  static async updateUserRole(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        return next(AppError.unauthorized());
      }

      const idParam = req.params.id;
      const targetId = Array.isArray(idParam) ? idParam[0] : idParam;
      if (!targetId) {
        return next(AppError.badRequest('User ID is required'));
      }

      const validatedInput = updateRoleSchema.parse(req.body);
      const updatedUser = await AdminService.updateUserRole(
        req.user.id,
        targetId,
        validatedInput,
        req.ip,
      );

      return sendSuccess(res, 200, {
        message: 'User role updated successfully',
        data: updatedUser,
      });
    } catch (error) {
      return next(error);
    }
  }

  static async updateUserStatus(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        return next(AppError.unauthorized());
      }

      const idParam = req.params.id;
      const targetId = Array.isArray(idParam) ? idParam[0] : idParam;
      if (!targetId) {
        return next(AppError.badRequest('User ID is required'));
      }

      const validatedInput = updateStatusSchema.parse(req.body);
      const updatedUser = await AdminService.updateUserStatus(
        req.user.id,
        targetId,
        validatedInput,
        req.ip,
      );

      return sendSuccess(res, 200, {
        message: `User account ${validatedInput.isActive ? 'activated' : 'suspended'} successfully`,
        data: updatedUser,
      });
    } catch (error) {
      return next(error);
    }
  }

  static async listAuditLogs(req: Request, res: Response, next: NextFunction) {
    try {
      const query = listAuditLogsQuerySchema.parse(req.query);
      const result = await AdminService.listAuditLogs(query);

      return sendSuccess(res, 200, {
        message: 'Audit logs retrieved successfully',
        data: result.auditLogs,
        meta: result.meta,
      });
    } catch (error) {
      return next(error);
    }
  }

  static async getSystemStats(_req: Request, res: Response, next: NextFunction) {
    try {
      const stats = await AdminService.getSystemStats();

      return sendSuccess(res, 200, {
        message: 'System statistics retrieved successfully',
        data: stats,
      });
    } catch (error) {
      return next(error);
    }
  }
}
