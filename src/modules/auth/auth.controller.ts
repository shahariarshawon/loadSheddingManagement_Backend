import { Request, Response, NextFunction } from 'express';
import { AuthService } from './auth.service.js';
import {
  registerSchema,
  loginSchema,
  googleAuthSchema,
  refreshTokenSchema,
  logoutSchema,
} from './auth.validation.js';
import { sendSuccess } from '../../utils/response.js';

export class AuthController {
  static async register(req: Request, res: Response, next: NextFunction) {
    try {
      const validatedInput = registerSchema.parse(req.body);
      const result = await AuthService.register(validatedInput);

      return sendSuccess(res, 201, {
        message: 'Customer registered successfully',
        data: result,
      });
    } catch (error) {
      return next(error);
    }
  }

  static async login(req: Request, res: Response, next: NextFunction) {
    try {
      const validatedInput = loginSchema.parse(req.body);
      const result = await AuthService.login(validatedInput);

      return sendSuccess(res, 200, {
        message: 'Login successful',
        data: result,
      });
    } catch (error) {
      return next(error);
    }
  }

  static async googleLogin(req: Request, res: Response, next: NextFunction) {
    try {
      const validatedInput = googleAuthSchema.parse(req.body);
      const result = await AuthService.googleLogin(validatedInput.idToken);

      return sendSuccess(res, 200, {
        message: 'Google authentication successful',
        data: result,
      });
    } catch (error) {
      return next(error);
    }
  }

  static async refreshToken(req: Request, res: Response, next: NextFunction) {
    try {
      const validatedInput = refreshTokenSchema.parse(req.body);
      const result = await AuthService.refresh(validatedInput.refreshToken);

      return sendSuccess(res, 200, {
        message: 'Token refreshed successfully',
        data: result,
      });
    } catch (error) {
      return next(error);
    }
  }

  static async logout(req: Request, res: Response, next: NextFunction) {
    try {
      const validatedInput = logoutSchema.parse(req.body);
      await AuthService.logout(validatedInput.refreshToken);

      return sendSuccess(res, 200, {
        message: 'Logged out successfully',
        data: {},
      });
    } catch (error) {
      return next(error);
    }
  }
}
