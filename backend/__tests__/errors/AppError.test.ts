import {
  AppError,
  ValidationError,
  AuthError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  ServiceError,
} from '../../errors/AppError';

describe('AppError hierarchy', () => {
  describe('AppError (base)', () => {
    it('should set code, statusCode, message', () => {
      const err = new AppError('TEST', 418, 'teapot');
      expect(err.code).toBe('TEST');
      expect(err.statusCode).toBe(418);
      expect(err.message).toBe('teapot');
      expect(err.name).toBe('AppError');
    });

    it('should be instanceof Error', () => {
      const err = new AppError('X', 500, 'msg');
      expect(err).toBeInstanceOf(Error);
      expect(err).toBeInstanceOf(AppError);
    });

    it('should include context when provided', () => {
      const ctx = { userId: 'u1' };
      const err = new AppError('X', 400, 'msg', ctx);
      expect(err.context).toEqual(ctx);
    });

    it('should have undefined context when not provided', () => {
      const err = new AppError('X', 400, 'msg');
      expect(err.context).toBeUndefined();
    });
  });

  describe('ValidationError', () => {
    it('should default to 400 VALIDATION_ERROR', () => {
      const err = new ValidationError('bad input');
      expect(err.code).toBe('VALIDATION_ERROR');
      expect(err.statusCode).toBe(400);
      expect(err.message).toBe('bad input');
      expect(err.name).toBe('ValidationError');
    });

    it('should be instanceof AppError', () => {
      const err = new ValidationError('x');
      expect(err).toBeInstanceOf(AppError);
      expect(err).toBeInstanceOf(ValidationError);
    });
  });

  describe('AuthError', () => {
    it('should default to 401 with "Unauthorized"', () => {
      const err = new AuthError();
      expect(err.code).toBe('AUTH_ERROR');
      expect(err.statusCode).toBe(401);
      expect(err.message).toBe('Unauthorized');
    });

    it('should accept custom message', () => {
      const err = new AuthError('Token scaduto');
      expect(err.message).toBe('Token scaduto');
    });
  });

  describe('ForbiddenError', () => {
    it('should default to 403 with "Forbidden"', () => {
      const err = new ForbiddenError();
      expect(err.code).toBe('FORBIDDEN');
      expect(err.statusCode).toBe(403);
      expect(err.message).toBe('Forbidden');
    });
  });

  describe('NotFoundError', () => {
    it('should create message with resource and id', () => {
      const err = new NotFoundError('Utente', 'abc-123');
      expect(err.code).toBe('NOT_FOUND');
      expect(err.statusCode).toBe(404);
      expect(err.message).toBe('Utente con id abc-123 non trovato');
    });

    it('should handle missing id', () => {
      const err = new NotFoundError('Guerra');
      expect(err.message).toBe('Guerra non trovato');
    });
  });

  describe('ConflictError', () => {
    it('should create 409 error', () => {
      const err = new ConflictError('già esistente');
      expect(err.code).toBe('CONFLICT');
      expect(err.statusCode).toBe(409);
    });

    it('should include context', () => {
      const err = new ConflictError('dup', { field: 'name' });
      expect(err.context).toEqual({ field: 'name' });
    });
  });

  describe('ServiceError', () => {
    it('should wrap original error', () => {
      const orig = new Error('connection refused');
      const err = new ServiceError('deploy_troops', orig);
      expect(err.code).toBe('SERVICE_ERROR');
      expect(err.statusCode).toBe(500);
      expect(err.message).toContain('deploy_troops');
      expect(err.message).toContain('connection refused');
    });

    it('should include operation in context', () => {
      const orig = new Error('timeout');
      const err = new ServiceError('listWars', orig, { warId: 'w1' });
      expect(err.context?.operation).toBe('listWars');
      expect(err.context?.originalError).toBe('timeout');
      expect(err.context?.warId).toBe('w1');
    });

    it('should be instanceof AppError', () => {
      const err = new ServiceError('op', new Error('x'));
      expect(err).toBeInstanceOf(AppError);
      expect(err).toBeInstanceOf(ServiceError);
    });
  });
});
