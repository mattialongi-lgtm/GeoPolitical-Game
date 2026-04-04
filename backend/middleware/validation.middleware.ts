import type { Request, Response, NextFunction } from 'express';
import type { ZodSchema } from 'zod';
import { AppError } from '../errors/AppError';

/**
 * Express middleware factory that validates `req.body` against
 * a Zod schema.
 *
 * On success the parsed (and coerced / defaulted) body replaces
 * `req.body` so handlers receive clean data.
 *
 * On failure a 400 `ValidationError` is forwarded to `next()`.
 */
export function validateBody(schema: ZodSchema) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const firstIssue = result.error.issues[0];
      return next(
        new AppError('VALIDATION_ERROR', 400, firstIssue?.message ?? 'Dati non validi', {
          errors: result.error.issues,
        }),
      );
    }
    req.body = result.data;
    next();
  };
}

/**
 * Same as `validateBody` but validates `req.query`.
 */
export function validateQuery(schema: ZodSchema) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.query);
    if (!result.success) {
      const firstIssue = result.error.issues[0];
      return next(
        new AppError('VALIDATION_ERROR', 400, firstIssue?.message ?? 'Query non valida', {
          errors: result.error.issues,
        }),
      );
    }
    // Overwrite parsed query for handler convenience
    (req as any)._validatedQuery = result.data;
    next();
  };
}
