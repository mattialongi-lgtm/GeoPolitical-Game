import { errorHandler } from '../../middleware/errorHandler.middleware';
import { AppError, ValidationError, NotFoundError } from '../../errors/AppError';
import { createMockRequest, createMockResponse, createMockNext } from '../setup';

// Suppress console.error during tests
beforeEach(() => {
  jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  jest.restoreAllMocks();
});

describe('errorHandler middleware', () => {
  it('should serialize AppError to consistent JSON shape', () => {
    const err = new AppError('TEST_CODE', 418, 'teapot message');
    const req = createMockRequest();
    const res = createMockResponse();
    const next = createMockNext();

    errorHandler(err, req, res, next);

    expect(res.statusCode).toBe(418);
    expect(res._body.error).toBeDefined();
    expect(res._body.error.code).toBe('TEST_CODE');
    expect(res._body.error.message).toBe('teapot message');
    expect(res._body.error.path).toBe('/test');
    expect(res._body.error.timestamp).toBeDefined();
  });

  it('should map ValidationError to 400', () => {
    const err = new ValidationError('campo obbligatorio');
    const req = createMockRequest();
    const res = createMockResponse();
    const next = createMockNext();

    errorHandler(err, req, res, next);

    expect(res.statusCode).toBe(400);
    expect(res._body.error.code).toBe('VALIDATION_ERROR');
  });

  it('should map NotFoundError to 404', () => {
    const err = new NotFoundError('Utente', 'abc');
    const req = createMockRequest();
    const res = createMockResponse();
    const next = createMockNext();

    errorHandler(err, req, res, next);

    expect(res.statusCode).toBe(404);
    expect(res._body.error.code).toBe('NOT_FOUND');
  });

  it('should wrap unknown errors as 500 INTERNAL_ERROR', () => {
    const err = new Error('something unexpected');
    const req = createMockRequest();
    const res = createMockResponse();
    const next = createMockNext();

    errorHandler(err, req, res, next);

    expect(res.statusCode).toBe(500);
    expect(res._body.error.code).toBe('INTERNAL_ERROR');
    expect(res._body.error.message).toBe('something unexpected');
  });

  it('should handle non-Error objects gracefully', () => {
    const err = 'string error';
    const req = createMockRequest();
    const res = createMockResponse();
    const next = createMockNext();

    errorHandler(err, req, res, next);

    expect(res.statusCode).toBe(500);
    expect(res._body.error.code).toBe('INTERNAL_ERROR');
  });

  it('should include context when present on AppError', () => {
    const err = new AppError('WITH_CTX', 400, 'msg', { field: 'name' });
    const req = createMockRequest();
    const res = createMockResponse();
    const next = createMockNext();

    errorHandler(err, req, res, next);

    expect(res._body.error.context).toEqual({ field: 'name' });
  });

  it('should NOT include context key when absent', () => {
    const err = new AppError('NO_CTX', 400, 'msg');
    const req = createMockRequest();
    const res = createMockResponse();
    const next = createMockNext();

    errorHandler(err, req, res, next);

    expect(res._body.error.context).toBeUndefined();
  });
});
