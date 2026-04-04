/**
 * Application error hierarchy.
 *
 * Every error thrown inside handlers / services should be an AppError (or
 * subclass).  The centralized `errorHandler` middleware maps these to a
 * consistent JSON response shape.
 */

export class AppError extends Error {
  constructor(
    public readonly code: string,
    public readonly statusCode: number,
    message: string,
    public readonly context?: Record<string, unknown>,
  ) {
    super(message);
    Object.setPrototypeOf(this, AppError.prototype);
    this.name = 'AppError';
  }
}

export class ValidationError extends AppError {
  constructor(message: string, context?: Record<string, unknown>) {
    super('VALIDATION_ERROR', 400, message, context);
    Object.setPrototypeOf(this, ValidationError.prototype);
    this.name = 'ValidationError';
  }
}

export class AuthError extends AppError {
  constructor(message = 'Unauthorized') {
    super('AUTH_ERROR', 401, message);
    Object.setPrototypeOf(this, AuthError.prototype);
    this.name = 'AuthError';
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Forbidden') {
    super('FORBIDDEN', 403, message);
    Object.setPrototypeOf(this, ForbiddenError.prototype);
    this.name = 'ForbiddenError';
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string, id?: string) {
    const msg = id
      ? `${resource} con id ${id} non trovato`
      : `${resource} non trovato`;
    super('NOT_FOUND', 404, msg);
    Object.setPrototypeOf(this, NotFoundError.prototype);
    this.name = 'NotFoundError';
  }
}

export class ConflictError extends AppError {
  constructor(message: string, context?: Record<string, unknown>) {
    super('CONFLICT', 409, message, context);
    Object.setPrototypeOf(this, ConflictError.prototype);
    this.name = 'ConflictError';
  }
}

export class ServiceError extends AppError {
  constructor(
    operation: string,
    originalError: Error,
    context?: Record<string, unknown>,
  ) {
    super(
      'SERVICE_ERROR',
      500,
      `Failed to ${operation}: ${originalError.message}`,
      { operation, originalError: originalError.message, ...context },
    );
    Object.setPrototypeOf(this, ServiceError.prototype);
    this.name = 'ServiceError';
  }
}
