import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { Prisma } from '../generated/prisma/client.js';
import { AppError } from '../utils/appError.js';
import { sendError } from '../utils/response.js';
import { env } from '../config/env.js';

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction,
) {
  // 1. Handled AppError
  if (err instanceof AppError) {
    return sendError(res, err.statusCode, err.message, err.errors || []);
  }

  // 2. Zod Validation Error
  if (err instanceof ZodError) {
    const formattedErrors = err.issues.map((issue) => ({
      field: issue.path.join('.'),
      message: issue.message,
    }));
    return sendError(res, 400, 'Validation failed', formattedErrors);
  }

  // 3. Prisma Known Request Errors
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      const target = Array.isArray(err.meta?.target) ? err.meta.target.join(', ') : 'field';
      return sendError(res, 409, `Unique constraint violation on ${target}`, [
        { code: err.code, meta: err.meta },
      ]);
    }
    if (err.code === 'P2025') {
      return sendError(res, 404, 'Requested record not found in database', [
        { code: err.code, meta: err.meta },
      ]);
    }
    return sendError(res, 400, 'Database operation error', [
      { code: err.code, meta: err.meta },
    ]);
  }

  // 4. Default / Unhandled Internal Error
  console.error('💥 Unhandled Server Error:', err);

  const message =
    env.NODE_ENV === 'production' ? 'Internal server error' : err.message;

  return sendError(
    res,
    500,
    message,
    env.NODE_ENV === 'production' ? [] : [{ stack: err.stack }],
  );
}
