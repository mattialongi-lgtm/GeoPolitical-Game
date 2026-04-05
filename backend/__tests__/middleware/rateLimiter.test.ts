import express from 'express';
import request from 'supertest';
import { globalLimiter, writeLimiter, strictLimiter } from '../../middleware/rateLimiter.middleware';

/**
 * Verifies that rate limiters return the project-standard error
 * envelope with HTTP 429 when the limit is exceeded.
 */

function buildApp(limiter: ReturnType<typeof import('express-rate-limit').default>) {
  const app = express();
  app.use(limiter);
  app.get('/test', (_req, res) => res.json({ ok: true }));
  app.post('/test', (_req, res) => res.json({ ok: true }));
  return app;
}

describe('rateLimiter middleware', () => {
  describe('globalLimiter', () => {
    it('should allow requests under the limit', async () => {
      const app = buildApp(globalLimiter);
      const res = await request(app).get('/test');
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ ok: true });
    });
  });

  describe('strictLimiter — 429 response format', () => {
    it('should return project-standard error envelope when limit is exceeded', async () => {
      const app = buildApp(strictLimiter);

      // Exhaust the 10-request limit
      for (let i = 0; i < 10; i++) {
        await request(app).get('/test');
      }

      // 11th request must be rejected
      const res = await request(app).get('/test');

      expect(res.status).toBe(429);
      expect(res.body).toEqual({
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'Too many requests, please try again later.',
        },
      });
    });
  });

  describe('writeLimiter — 429 response format', () => {
    it('should return project-standard error envelope when limit is exceeded', async () => {
      const app = buildApp(writeLimiter);

      // Exhaust the 30-request limit
      for (let i = 0; i < 30; i++) {
        await request(app).post('/test');
      }

      // 31st request must be rejected
      const res = await request(app).post('/test');

      expect(res.status).toBe(429);
      expect(res.body).toEqual({
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'Too many requests, please try again later.',
        },
      });
    });
  });
});
