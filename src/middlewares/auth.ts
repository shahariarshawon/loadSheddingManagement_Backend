import { Request, Response, NextFunction } from 'express';
import { Role } from '../generated/prisma/client.js';
import { verifyAccessToken } from '../utils/jwt.js';
import { prisma } from '../config/prisma.js';
import { AppError } from '../utils/appError.js';

export async function authenticateUser(
  req: Request,
  _res: Response,
  next: NextFunction,
) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next(AppError.unauthorized('Authentication required. Missing or malformed Bearer token.'));
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      return next(AppError.unauthorized('Authentication required. Token not provided.'));
    }

    let payload;
    try {
      payload = verifyAccessToken(token);
    } catch (err: unknown) {
      const error = err as Error;
      if (error.name === 'TokenExpiredError') {
        return next(AppError.unauthorized('Access token has expired. Please refresh your token.'));
      }
      return next(AppError.unauthorized('Invalid access token.'));
    }

    // Verify user still exists, is active, and is not soft-deleted
    const user = await prisma.user.findFirst({
      where: {
        id: payload.userId,
        deletedAt: null,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        areaId: true,
      },
    });

    if (!user) {
      return next(AppError.unauthorized('User account associated with this token no longer exists.'));
    }

    if (!user.isActive) {
      return next(new AppError('Account is disabled or suspended. Contact support.', 403));
    }

    req.user = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      areaId: user.areaId,
    };

    return next();
  } catch (error) {
    return next(error);
  }
}

export function authorizeRoles(...allowedRoles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(AppError.unauthorized('Authentication required before authorization.'));
    }

    if (!allowedRoles.includes(req.user.role)) {
      return next(
        AppError.forbidden(
          `Forbidden: Role '${req.user.role}' is not authorized to access this resource.`,
        ),
      );
    }

    return next();
  };
}
