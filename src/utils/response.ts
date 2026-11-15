import { Response } from 'express';

interface SuccessResponseOptions<T> {
  message?: string;
  data?: T;
  meta?: Record<string, unknown>;
}

export function sendSuccess<T>(
  res: Response,
  statusCode: number = 200,
  options: SuccessResponseOptions<T> = {},
) {
  const { message = 'Operation successful', data = {} as T, meta } = options;

  const responseBody: Record<string, unknown> = {
    success: true,
    message,
    data,
  };

  if (meta) {
    responseBody.meta = meta;
  }

  return res.status(statusCode).json(responseBody);
}

export function sendError(
  res: Response,
  statusCode: number = 500,
  message: string = 'Something went wrong',
  errors: unknown[] = [],
) {
  return res.status(statusCode).json({
    success: false,
    message,
    errors,
  });
}
