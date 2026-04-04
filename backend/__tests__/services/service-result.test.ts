import {
  serviceSuccess,
  validationError,
  forbiddenError,
  notFoundError,
  conflictError,
  systemError,
} from '../../services/service-result';

describe('service-result helpers', () => {
  describe('serviceSuccess', () => {
    it('should create a success result with default statusCode 200', () => {
      const result = serviceSuccess({ id: '1' });
      expect(result).toEqual({
        type: 'success',
        statusCode: 200,
        payload: { id: '1' },
        details: undefined,
      });
    });

    it('should allow custom statusCode', () => {
      const result = serviceSuccess('created', 201);
      expect(result.statusCode).toBe(201);
      expect(result.type).toBe('success');
    });

    it('should include details when provided', () => {
      const result = serviceSuccess(null, 200, { note: 'test' });
      expect(result.details).toEqual({ note: 'test' });
    });

    it('should handle undefined payload', () => {
      const result = serviceSuccess(undefined);
      expect(result.payload).toBeUndefined();
      expect(result.type).toBe('success');
    });
  });

  describe('validationError', () => {
    it('should create a 400 validation_error', () => {
      const result = validationError('campo obbligatorio');
      expect(result).toEqual({
        type: 'validation_error',
        statusCode: 400,
        message: 'campo obbligatorio',
        details: undefined,
      });
    });

    it('should include details when provided', () => {
      const result = validationError('bad', { field: 'name' });
      expect(result.details).toEqual({ field: 'name' });
    });
  });

  describe('forbiddenError', () => {
    it('should create a 403 forbidden error', () => {
      const result = forbiddenError('accesso negato');
      expect(result.type).toBe('forbidden');
      expect(result.statusCode).toBe(403);
      expect(result.message).toBe('accesso negato');
    });
  });

  describe('notFoundError', () => {
    it('should create a 404 not_found error', () => {
      const result = notFoundError('risorsa non trovata');
      expect(result.type).toBe('not_found');
      expect(result.statusCode).toBe(404);
    });
  });

  describe('conflictError', () => {
    it('should create a 409 conflict error', () => {
      const result = conflictError('duplicato');
      expect(result.type).toBe('conflict');
      expect(result.statusCode).toBe(409);
    });
  });

  describe('systemError', () => {
    it('should create a 500 system_error', () => {
      const result = systemError('db timeout');
      expect(result.type).toBe('system_error');
      expect(result.statusCode).toBe(500);
      expect(result.message).toBe('db timeout');
    });

    it('should include details when provided', () => {
      const result = systemError('fail', { query: 'SELECT' });
      expect(result.details).toEqual({ query: 'SELECT' });
    });
  });
});
