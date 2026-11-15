import { Request, Response, NextFunction } from 'express';
import { sendError } from '../utils/response.js';

export function notFoundHandler(req: Request, res: Response, _next: NextFunction) {
  return sendError(
    res,
    404,
    `Route not found: ${req.method} ${req.originalUrl}`,
    [],
  );
}
