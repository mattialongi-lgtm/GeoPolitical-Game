/**
 * Composition root for the backend.
 *
 * NOTE: The legacy monolith (bootstrapping + domain helpers + background jobs)
 * lives in `backend/legacy/app.legacy.ts` and is being progressively extracted
 * into `backend/{middleware,services,repositories,jobs,utils}`.
 */

import 'dotenv/config';

// Global fix for BigInt serialization in JSON responses
(BigInt.prototype as any).toJSON = function () {
  return this.toString();
};

import { logger } from './utils/logger';
import { startServer } from './legacy/app.legacy';

logger.info('Starting backend/app.ts (composition root)');

startServer();

export { startServer };

