import type { JobDefinition } from './job-types';

export function createLawsJob(deps: { checkAndResolveLaws: () => Promise<void> }): JobDefinition {
  return {
    name: 'checkAndResolveLaws',
    intervalMs: 60 * 1000,
    overlapPolicy: 'skip',
    retry: { maxAttempts: 2, baseDelayMs: 250, maxDelayMs: 2000 },
    run: deps.checkAndResolveLaws,
  };
}

