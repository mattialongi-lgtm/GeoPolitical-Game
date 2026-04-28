import type { JobDefinition } from './job-types';

export function createReadRollupsJob(deps: { refreshReadRollupsTick: () => Promise<void> }): JobDefinition {
  return {
    name: 'refreshReadRollupsTick',
    intervalMs: 60 * 1000,
    overlapPolicy: 'skip',
    retry: { maxAttempts: 2, baseDelayMs: 500, maxDelayMs: 5000 },
    run: deps.refreshReadRollupsTick,
  };
}

