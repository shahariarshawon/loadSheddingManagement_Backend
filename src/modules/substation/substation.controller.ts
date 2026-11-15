import { Request, Response, NextFunction } from 'express';
import { SubstationService } from './substation.service.js';
import { createSubstationSchema, updateSubstationSchema } from './substation.validation.js';
import { sendSuccess } from '../../utils/response.js';
import { AppError } from '../../utils/appError.js';

export class SubstationController {
  static async createSubstation(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) return next(AppError.unauthorized());
      const validatedInput = createSubstationSchema.parse(req.body);
      const substation = await SubstationService.createSubstation(req.user.id, validatedInput, req.ip);

      return sendSuccess(res, 201, {
        message: 'Substation created successfully',
        data: substation,
      });
    } catch (error) {
      return next(error);
    }
  }

  static async listSubstations(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await SubstationService.listSubstations(req.query);

      return sendSuccess(res, 200, {
        message: 'Substations retrieved successfully',
        data: result.substations,
        meta: result.meta,
      });
    } catch (error) {
      return next(error);
    }
  }

  static async getSubstationById(req: Request, res: Response, next: NextFunction) {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      if (!id) return next(AppError.badRequest('Substation ID is required'));

      const substation = await SubstationService.getSubstationById(id);

      return sendSuccess(res, 200, {
        message: 'Substation retrieved successfully',
        data: substation,
      });
    } catch (error) {
      return next(error);
    }
  }

  static async updateSubstation(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) return next(AppError.unauthorized());
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      if (!id) return next(AppError.badRequest('Substation ID is required'));

      const validatedInput = updateSubstationSchema.parse(req.body);
      const updated = await SubstationService.updateSubstation(req.user.id, id, validatedInput, req.ip);

      return sendSuccess(res, 200, {
        message: 'Substation updated successfully',
        data: updated,
      });
    } catch (error) {
      return next(error);
    }
  }

  static async deleteSubstation(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) return next(AppError.unauthorized());
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      if (!id) return next(AppError.badRequest('Substation ID is required'));

      await SubstationService.deleteSubstation(req.user.id, id, req.ip);

      return sendSuccess(res, 200, {
        message: 'Substation deleted successfully',
        data: {},
      });
    } catch (error) {
      return next(error);
    }
  }
}
