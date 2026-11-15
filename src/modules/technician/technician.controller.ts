import { Request, Response, NextFunction } from 'express';
import { TechnicianService } from './technician.service.js';
import { createTechnicianSchema, updateTechnicianSchema } from './technician.validation.js';
import { sendSuccess } from '../../utils/response.js';

export class TechnicianController {
  static async listTechnicians(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await TechnicianService.listTechnicians(req.query);

      return sendSuccess(res, 200, {
        message: 'Technicians retrieved successfully',
        data: result.technicians,
        meta: result.meta,
      });
    } catch (error) {
      return next(error);
    }
  }

  static async getTechnicianById(req: Request, res: Response, next: NextFunction) {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const technician = await TechnicianService.getTechnicianById(id);

      return sendSuccess(res, 200, {
        message: 'Technician retrieved successfully',
        data: technician,
      });
    } catch (error) {
      return next(error);
    }
  }

  static async createTechnician(req: Request, res: Response, next: NextFunction) {
    try {
      const validated = createTechnicianSchema.parse(req.body);
      const technician = await TechnicianService.createTechnician(validated);

      return sendSuccess(res, 201, {
        message: 'Technician created successfully',
        data: technician,
      });
    } catch (error) {
      return next(error);
    }
  }

  static async updateTechnician(req: Request, res: Response, next: NextFunction) {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const validated = updateTechnicianSchema.parse(req.body);
      const updated = await TechnicianService.updateTechnician(id, validated);

      return sendSuccess(res, 200, {
        message: 'Technician updated successfully',
        data: updated,
      });
    } catch (error) {
      return next(error);
    }
  }

  static async deleteTechnician(req: Request, res: Response, next: NextFunction) {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const result = await TechnicianService.deleteTechnician(id);

      return sendSuccess(res, 200, {
        message: 'Technician deleted successfully',
        data: result,
      });
    } catch (error) {
      return next(error);
    }
  }
}
