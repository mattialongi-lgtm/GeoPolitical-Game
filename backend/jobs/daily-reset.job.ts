import type { JobDefinition } from './job-types';

export function createDailyResourceResetJob(deps: { dailyResourceReset: (logicalDate: string) => Promise<void> }): JobDefinition {
  return {
    name: 'dailyResourceReset',
    intervalMs: 5 * 60 * 1000,
    overlapPolicy: 'skip',
    retry: { maxAttempts: 2, baseDelayMs: 250, maxDelayMs: 2000 },
    run: async () => {
      const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD (UTC)
      await deps.dailyResourceReset(today);
    },
  };
}

