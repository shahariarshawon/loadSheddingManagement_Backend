import { Request, Response, NextFunction } from 'express';
import { AreaService } from './area.service.js';
import { createAreaSchema, updateAreaSchema } from './area.validation.js';
import { sendSuccess } from '../../utils/response.js';
import { AppError } from '../../utils/appError.js';

export class AreaController {
  static async createArea(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) return next(AppError.unauthorized());
      const validatedInput = createAreaSchema.parse(req.body);
      const area = await AreaService.createArea(req.user.id, validatedInput, req.ip);

      return sendSuccess(res, 201, {
        message: 'Area created successfully',
        data: area,
      });
    } catch (error) {
      return next(error);
    }
  }

  static async listAreas(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await AreaService.listAreas(req.query);

      return sendSuccess(res, 200, {
        message: 'Areas retrieved successfully',
        data: result.areas,
        meta: result.meta,
      });
    } catch (error) {
      return next(error);
    }
  }

  static async getAreaById(req: Request, res: Response, next: NextFunction) {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      if (!id) return next(AppError.badRequest('Area ID is required'));

      const area = await AreaService.getAreaById(id);

      return sendSuccess(res, 200, {
        message: 'Area retrieved successfully',
        data: area,
      });
    } catch (error) {
      return next(error);
    }
  }

  static async updateArea(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) return next(AppError.unauthorized());
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      if (!id) return next(AppError.badRequest('Area ID is required'));

      const validatedInput = updateAreaSchema.parse(req.body);
      const updated = await AreaService.updateArea(req.user.id, id, validatedInput, req.ip);

      return sendSuccess(res, 200, {
        message: 'Area updated successfully',
        data: updated,
      });
    } catch (error) {
      return next(error);
    }
  }

  static async deleteArea(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) return next(AppError.unauthorized());
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      if (!id) return next(AppError.badRequest('Area ID is required'));

      await AreaService.deleteArea(req.user.id, id, req.ip);

      return sendSuccess(res, 200, {
        message: 'Area deleted successfully',
        data: {},
      });
    } catch (error) {
      return next(error);
    }
  }
}
