import { Request, Response, NextFunction } from 'express';
import { ZoneService } from './zone.service.js';
import { createZoneSchema, updateZoneSchema } from './zone.validation.js';
import { sendSuccess } from '../../utils/response.js';
import { AppError } from '../../utils/appError.js';

export class ZoneController {
  static async createZone(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) return next(AppError.unauthorized());
      const validatedInput = createZoneSchema.parse(req.body);
      const zone = await ZoneService.createZone(req.user.id, validatedInput, req.ip);

      return sendSuccess(res, 201, {
        message: 'Distribution zone created successfully',
        data: zone,
      });
    } catch (error) {
      return next(error);
    }
  }

  static async listZones(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await ZoneService.listZones(req.query);

      return sendSuccess(res, 200, {
        message: 'Distribution zones retrieved successfully',
        data: result.zones,
        meta: result.meta,
      });
    } catch (error) {
      return next(error);
    }
  }

  static async getZoneById(req: Request, res: Response, next: NextFunction) {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      if (!id) return next(AppError.badRequest('Zone ID is required'));

      const zone = await ZoneService.getZoneById(id);

      return sendSuccess(res, 200, {
        message: 'Distribution zone retrieved successfully',
        data: zone,
      });
    } catch (error) {
      return next(error);
    }
  }

  static async updateZone(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) return next(AppError.unauthorized());
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      if (!id) return next(AppError.badRequest('Zone ID is required'));

      const validatedInput = updateZoneSchema.parse(req.body);
      const updated = await ZoneService.updateZone(req.user.id, id, validatedInput, req.ip);

      return sendSuccess(res, 200, {
        message: 'Distribution zone updated successfully',
        data: updated,
      });
    } catch (error) {
      return next(error);
    }
  }

  static async deleteZone(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) return next(AppError.unauthorized());
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      if (!id) return next(AppError.badRequest('Zone ID is required'));

      await ZoneService.deleteZone(req.user.id, id, req.ip);

      return sendSuccess(res, 200, {
        message: 'Distribution zone deleted successfully',
        data: {},
      });
    } catch (error) {
      return next(error);
    }
  }
}
