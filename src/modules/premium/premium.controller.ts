import { Request, Response, NextFunction } from 'express';
import { PremiumService } from './premium.service.js';
import { sendSuccess } from '../../utils/response.js';
import { AppError } from '../../utils/appError.js';

export class PremiumController {
  /**
   * Check current user's premium subscription access pass status
   */
  static async getSubscriptionStatus(
    req: Request,
    res: Response,
    next: NextFunction,
  ) {
    try {
      if (!req.user) {
        throw AppError.unauthorized('Authentication required.');
      }

      const status = await PremiumService.getSubscriptionStatus(req.user.id);

      return sendSuccess(res, 200, {
        message: 'Subscription status retrieved successfully',
        data: status,
      });
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Retrieve Premium Area Reliability Analytics
   * Strictly gated: customers without an active subscription pass receive 403 Forbidden.
   */
  static async getAreaReliabilityAnalytics(
    req: Request,
    res: Response,
    next: NextFunction,
  ) {
    try {
      if (!req.user) {
        throw AppError.unauthorized('Authentication required.');
      }

      const requestedAreaId = req.query.areaId as string | undefined;
      const analytics = await PremiumService.getAreaReliabilityAnalytics(
        req.user,
        requestedAreaId,
      );

      return sendSuccess(res, 200, {
        message: 'Area reliability analytics retrieved successfully',
        data: analytics,
      });
    } catch (error) {
      return next(error);
    }
  }
}
