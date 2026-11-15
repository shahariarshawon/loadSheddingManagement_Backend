import { Request, Response, NextFunction } from 'express';
import { FeederService } from './feeder.service.js';
import { createFeederSchema, updateFeederSchema } from './feeder.validation.js';
import { sendSuccess } from '../../utils/response.js';
import { AppError } from '../../utils/appError.js';

export class FeederController {
  static async createFeeder(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) return next(AppError.unauthorized());
      const validatedInput = createFeederSchema.parse(req.body);
      const feeder = await FeederService.createFeeder(req.user.id, validatedInput, req.ip);

      return sendSuccess(res, 201, {
        message: 'Feeder created successfully',
        data: feeder,
      });
    } catch (error) {
      return next(error);
    }
  }

  static async listFeeders(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await FeederService.listFeeders(req.query);

      return sendSuccess(res, 200, {
        message: 'Feeders retrieved successfully',
        data: result.feeders,
        meta: result.meta,
      });
    } catch (error) {
      return next(error);
    }
  }

  static async getFeederById(req: Request, res: Response, next: NextFunction) {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      if (!id) return next(AppError.badRequest('Feeder ID is required'));

      const feeder = await FeederService.getFeederById(id);

      return sendSuccess(res, 200, {
        message: 'Feeder retrieved successfully',
        data: feeder,
      });
    } catch (error) {
      return next(error);
    }
  }

  static async updateFeeder(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) return next(AppError.unauthorized());
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      if (!id) return next(AppError.badRequest('Feeder ID is required'));

      const validatedInput = updateFeederSchema.parse(req.body);
      const updated = await FeederService.updateFeeder(req.user.id, id, validatedInput, req.ip);

      return sendSuccess(res, 200, {
        message: 'Feeder updated successfully',
        data: updated,
      });
    } catch (error) {
      return next(error);
    }
  }

  static async deleteFeeder(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) return next(AppError.unauthorized());
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      if (!id) return next(AppError.badRequest('Feeder ID is required'));

      await FeederService.deleteFeeder(req.user.id, id, req.ip);

      return sendSuccess(res, 200, {
        message: 'Feeder deleted successfully',
        data: {},
      });
    } catch (error) {
      return next(error);
    }
  }
}
