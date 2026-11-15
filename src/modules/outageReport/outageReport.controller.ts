import { Request, Response, NextFunction } from 'express';
import { OutageReportService } from './outageReport.service.js';
import {
  createOutageReportSchema,
  updateOutageReportSchema,
  verifyOutageReportSchema,
  rejectOutageReportSchema,
} from './outageReport.validation.js';
import { sendSuccess } from '../../utils/response.js';
import { AppError } from '../../utils/appError.js';

export class OutageReportController {
  static async createReport(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        throw AppError.unauthorized('Authentication required to submit outage reports.');
      }

      const validated = createOutageReportSchema.parse(req.body);
      const report = await OutageReportService.createReport(
        req.user.id,
        validated,
        req.ip,
      );

      return sendSuccess(res, 201, {
        message: 'Outage report submitted successfully',
        data: report,
      });
    } catch (error) {
      return next(error);
    }
  }

  static async getMyReports(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        throw AppError.unauthorized('Authentication required.');
      }

      const result = await OutageReportService.getMyReports(req.user.id, req.query);

      return sendSuccess(res, 200, {
        message: 'My outage reports retrieved successfully',
        data: result.reports,
        meta: result.meta,
      });
    } catch (error) {
      return next(error);
    }
  }

  static async getReportById(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        throw AppError.unauthorized('Authentication required.');
      }

      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const report = await OutageReportService.getReportById(id, {
        userId: req.user.id,
        role: req.user.role,
      });

      return sendSuccess(res, 200, {
        message: 'Outage report retrieved successfully',
        data: report,
      });
    } catch (error) {
      return next(error);
    }
  }

  static async updateReport(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        throw AppError.unauthorized('Authentication required.');
      }

      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const validated = updateOutageReportSchema.parse(req.body);
      const updated = await OutageReportService.updateReport(id, req.user.id, validated);

      return sendSuccess(res, 200, {
        message: 'Outage report updated successfully',
        data: updated,
      });
    } catch (error) {
      return next(error);
    }
  }

  static async withdrawReport(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        throw AppError.unauthorized('Authentication required.');
      }

      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const result = await OutageReportService.withdrawReport(
        id,
        req.user.id,
        req.user.role,
      );

      return sendSuccess(res, 200, {
        message: 'Outage report withdrawn successfully',
        data: result,
      });
    } catch (error) {
      return next(error);
    }
  }

  static async listReports(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await OutageReportService.listReports(req.query);

      return sendSuccess(res, 200, {
        message: 'Outage reports retrieved successfully',
        data: result.reports,
        meta: result.meta,
      });
    } catch (error) {
      return next(error);
    }
  }

  static async verifyReport(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        throw AppError.unauthorized('Authentication required.');
      }

      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const validated = verifyOutageReportSchema.parse(req.body);
      const verified = await OutageReportService.verifyReport(
        req.user.id,
        id,
        validated,
        req.ip,
      );

      return sendSuccess(res, 200, {
        message: 'Outage report verified successfully',
        data: verified,
      });
    } catch (error) {
      return next(error);
    }
  }

  static async rejectReport(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        throw AppError.unauthorized('Authentication required.');
      }

      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const validated = rejectOutageReportSchema.parse(req.body);
      const rejected = await OutageReportService.rejectReport(
        req.user.id,
        id,
        validated,
        req.ip,
      );

      return sendSuccess(res, 200, {
        message: 'Outage report rejected',
        data: rejected,
      });
    } catch (error) {
      return next(error);
    }
  }
}
