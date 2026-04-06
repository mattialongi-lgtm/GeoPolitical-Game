import type { Request, Response, NextFunction } from 'express';
import { AppError } from '../errors/AppError';
import { logger } from '../utils/logger';

/**
 * Global Express error-handling middleware.
 *
 * **Must be registered after all routes** (`app.use(errorHandler)`).
 *
 * – AppError instances are serialised as-is.
 * – Unknown errors are wrapped with a generic 500 response.
 * – Sensitive details (stack traces, internal messages) are never
 *   leaked to the client in production.
 */
export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  const error =
    err instanceof AppError
      ? err
      : new AppError(
          'INTERNAL_ERROR',
          500,
          err instanceof Error ? err.message : 'Internal server error',
        );

  logger.error('request_error', {
    code: error.code,
    statusCode: error.statusCode,
    message: error.message,
    path: req.path,
    method: req.method,
    userId: (req as any).user?.id,
    context: error.context,
    stack: err instanceof Error ? err.stack : undefined,
    timestamp: new Date().toISOString(),
  });

  const clientMessage =
    error.statusCode >= 500
      ? 'An unexpected error occurred. Please try again.'
      : error.message;

  res.status(error.statusCode).json({
    error: {
      code: error.code,
      message: clientMessage,
      ...(error.statusCode < 500 && error.context ? { context: error.context } : {}),
      timestamp: new Date().toISOString(),
      path: req.path,
    },
  });
}
