import { Request, Response, NextFunction } from 'express';
import { UserService } from './user.service.js';
import { updateProfileSchema } from './user.validation.js';
import { sendSuccess } from '../../utils/response.js';
import { AppError } from '../../utils/appError.js';

export class UserController {
  static async getMyProfile(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        return next(AppError.unauthorized());
      }

      const profile = await UserService.getProfile(req.user.id);

      return sendSuccess(res, 200, {
        message: 'Profile retrieved successfully',
        data: profile,
      });
    } catch (error) {
      return next(error);
    }
  }

  static async updateMyProfile(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        return next(AppError.unauthorized());
      }

      const validatedInput = updateProfileSchema.parse(req.body);
      const updatedProfile = await UserService.updateProfile(req.user.id, validatedInput);

      return sendSuccess(res, 200, {
        message: 'Profile updated successfully',
        data: updatedProfile,
      });
    } catch (error) {
      return next(error);
    }
  }
}
