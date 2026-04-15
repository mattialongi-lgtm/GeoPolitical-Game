import rateLimit from 'express-rate-limit';

/**
 * Centralised rate-limiting middleware.
 *
 * Three pre-configured instances:
 *  - `globalLimiter`  — 200 req / 15 min per IP  (all `/api/*`)
 *  - `writeLimiter`   — 30 req / 1 min per IP   (sensitive write domains)
 *  - `strictLimiter`  — 10 req / 1 min per IP   (most abuse-prone endpoints)
 *
 * When a limit is exceeded the response uses the project's standard error
 * envelope:  `{ error: { code, message } }`  with HTTP 429.
 *
 * In development (NODE_ENV !== 'production'), localhost is exempt so that
 * the 10-second polling loop doesn't exhaust the quota during local work.
 */

const rateLimitResponse = {
  error: {
    code: 'RATE_LIMIT_EXCEEDED',
    message: 'Too many requests, please try again later.',
  },
};

const isLocalhost = (req: any): boolean => {
  const ip = req.ip || req.connection?.remoteAddress || '';
  return ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1';
};

const skipInDev = process.env.NODE_ENV === 'development'
  ? (req: any) => isLocalhost(req)
  : () => false;

/**
 * 200 requests per 15-minute window, per IP.
 * Applied globally to all `/api/*` routes.
 */
export const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: rateLimitResponse,
  skip: skipInDev,
});

/**
 * 30 requests per 1-minute window, per IP.
 * Applied to POST/PUT/PATCH on sensitive domains:
 *   /api/resources, /api/actions, /api/war, /api/factories, /api/market
 */
export const writeLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: rateLimitResponse,
  skip: skipInDev,
});

/**
 * 10 requests per 1-minute window, per IP.
 * Applied to the most abuse-prone single endpoints:
 *   POST /api/resources/work-extract
 *   POST /api/resources/deep-exploration/activate
 *   POST /api/actions/apply
 */
export const strictLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: rateLimitResponse,
  skip: skipInDev,
});
