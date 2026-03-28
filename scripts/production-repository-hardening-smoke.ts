import * as assert from 'node:assert/strict';
import { ProductionRepository } from '../backend/repositories/production.repository';

async function run() {
  const supabaseMock = {
    from(table: string) {
      return {
        delete() {
          return {
            eq() {
              return {
                eq() {
                  return Promise.resolve({ error: { message: `${table} delete failed` } });
                },
                lte() {
                  return Promise.resolve({ error: { message: `${table} cleanup failed` } });
                },
              };
            },
          };
        },
      };
    },
  } as any;

  const repo = new ProductionRepository(supabaseMock);

  await assert.rejects(() => repo.deleteQueueItem('p1', 'u1'), /deleteQueueItem/);
  await assert.rejects(() => repo.cleanupZeroInventory('u1'), /cleanupZeroInventory/);

  console.log('production-repository-hardening-smoke: OK');
}

run().catch((err) => {
  console.error('production-repository-hardening-smoke: FAILED');
  console.error(err);
  process.exit(1);
});
