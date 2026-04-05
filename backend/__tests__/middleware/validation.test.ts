import { validateBody, validateQuery } from '../../middleware/validation.middleware';
import { createMockRequest, createMockResponse, createMockNext } from '../setup';

// Use zod/v4 as installed
import { z } from 'zod/v4';

const TestSchema = z.object({
  name: z.string().min(1, 'name è obbligatorio'),
  count: z.number().int().positive('count deve essere > 0'),
});

describe('validateBody middleware', () => {
  it('should pass valid body through and replace req.body with parsed data', () => {
    const middleware = validateBody(TestSchema);
    const req = createMockRequest({ body: { name: 'test', count: 5 } });
    const res = createMockResponse();
    const next = createMockNext();

    middleware(req, res, next);

    expect(next).toHaveBeenCalledWith();
    expect(req.body).toEqual({ name: 'test', count: 5 });
  });

  it('should call next with AppError on invalid body', () => {
    const middleware = validateBody(TestSchema);
    const req = createMockRequest({ body: { name: '', count: -1 } });
    const res = createMockResponse();
    const next = createMockNext();

    middleware(req, res, next);

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'VALIDATION_ERROR',
        statusCode: 400,
      }),
    );
  });

  it('should call next with AppError when body is empty', () => {
    const middleware = validateBody(TestSchema);
    const req = createMockRequest({ body: {} });
    const res = createMockResponse();
    const next = createMockNext();

    middleware(req, res, next);

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 400,
      }),
    );
  });

  it('should strip extra fields from body', () => {
    const middleware = validateBody(TestSchema);
    const req = createMockRequest({
      body: { name: 'valid', count: 3, extra: 'should-be-removed' },
    });
    const res = createMockResponse();
    const next = createMockNext();

    middleware(req, res, next);

    expect(next).toHaveBeenCalledWith();
    expect(req.body.extra).toBeUndefined();
  });
});

describe('validateQuery middleware', () => {
  const QuerySchema = z.object({
    page: z.coerce.number().int().positive().optional(),
  });

  it('should pass valid query through', () => {
    const middleware = validateQuery(QuerySchema);
    const req = createMockRequest({ query: { page: 1 } });
    const res = createMockResponse();
    const next = createMockNext();

    middleware(req, res, next);

    expect(next).toHaveBeenCalledWith();
  });

  it('should call next with error on invalid query', () => {
    const middleware = validateQuery(QuerySchema);
    const req = createMockRequest({ query: { page: 'abc' } });
    const res = createMockResponse();
    const next = createMockNext();

    middleware(req, res, next);

    // 'abc' cannot coerce to number — should fail
    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 400,
      }),
    );
  });
});
