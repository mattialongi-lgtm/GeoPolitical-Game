export type ServiceResultType =
  | 'success'
  | 'validation_error'
  | 'forbidden'
  | 'not_found'
  | 'conflict'
  | 'system_error';

export type ServiceSuccess<T> = {
  type: 'success';
  statusCode: number;
  payload: T;
  details?: Record<string, any>;
};

export type ServiceFailure = {
  type: Exclude<ServiceResultType, 'success'>;
  statusCode: number;
  message: string;
  details?: Record<string, any>;
};

export type ServiceResult<T> = ServiceSuccess<T> | ServiceFailure;

export const serviceSuccess = <T>(payload: T, statusCode: number = 200, details?: Record<string, any>): ServiceSuccess<T> => ({
  type: 'success',
  statusCode,
  payload,
  details,
});

export const validationError = (message: string, details?: Record<string, any>): ServiceFailure => ({
  type: 'validation_error',
  statusCode: 400,
  message,
  details,
});

export const forbiddenError = (message: string, details?: Record<string, any>): ServiceFailure => ({
  type: 'forbidden',
  statusCode: 403,
  message,
  details,
});

export const notFoundError = (message: string, details?: Record<string, any>): ServiceFailure => ({
  type: 'not_found',
  statusCode: 404,
  message,
  details,
});

export const conflictError = (message: string, details?: Record<string, any>): ServiceFailure => ({
  type: 'conflict',
  statusCode: 409,
  message,
  details,
});

export const systemError = (message: string, details?: Record<string, any>): ServiceFailure => ({
  type: 'system_error',
  statusCode: 500,
  message,
  details,
});
