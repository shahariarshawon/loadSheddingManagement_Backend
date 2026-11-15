import { Request, Response, NextFunction } from 'express';
import { OutageService } from './outage.service.js';
import {
  createOutageSchema,
  updateOutageSchema,
  cancelOutageSchema,
} from './outage.validation.js';
import { sendSuccess } from '../../utils/response.js';
import { AppError } from '../../utils/appError.js';

export class OutageController {
  static async createOutage(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) return next(AppError.unauthorized());
      const validatedInput = createOutageSchema.parse(req.body);
      const outage = await OutageService.createOutage(req.user.id, validatedInput, req.ip);

      return sendSuccess(res, 201, {
        message: 'Outage schedule created successfully',
        data: outage,
      });
    } catch (error) {
      return next(error);
    }
  }

  static async listOutages(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await OutageService.listOutages(req.query, req.user?.role);

      return sendSuccess(res, 200, {
        message: 'Outages retrieved successfully',
        data: result.outages,
        meta: result.meta,
      });
    } catch (error) {
      return next(error);
    }
  }

  static async getOutageById(req: Request, res: Response, next: NextFunction) {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      if (!id) return next(AppError.badRequest('Outage ID is required'));

      const outage = await OutageService.getOutageById(id, req.user?.role);

      return sendSuccess(res, 200, {
        message: 'Outage details retrieved successfully',
        data: outage,
      });
    } catch (error) {
      return next(error);
    }
  }

  static async updateOutage(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) return next(AppError.unauthorized());
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      if (!id) return next(AppError.badRequest('Outage ID is required'));

      const validatedInput = updateOutageSchema.parse(req.body);
      const updated = await OutageService.updateOutage(req.user.id, id, validatedInput, req.ip);

      return sendSuccess(res, 200, {
        message: 'Outage schedule updated successfully',
        data: updated,
      });
    } catch (error) {
      return next(error);
    }
  }

  static async cancelOutage(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) return next(AppError.unauthorized());
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      if (!id) return next(AppError.badRequest('Outage ID is required'));

      const validatedInput = cancelOutageSchema.parse(req.body);
      const cancelled = await OutageService.cancelOutage(
        req.user.id,
        id,
        validatedInput.reason,
        req.ip,
      );

      return sendSuccess(res, 200, {
        message: 'Outage schedule cancelled successfully',
        data: cancelled,
      });
    } catch (error) {
      return next(error);
    }
  }

  static async deleteOutage(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) return next(AppError.unauthorized());
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      if (!id) return next(AppError.badRequest('Outage ID is required'));

      await OutageService.deleteOutage(req.user.id, id, req.ip);

      return sendSuccess(res, 200, {
        message: 'Outage schedule deleted successfully',
        data: {},
      });
    } catch (error) {
      return next(error);
    }
  }
}
