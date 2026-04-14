import type { JobDefinition } from './job-types';

export function createIndependentRegionsJob(deps: { checkAndAdvanceIndependentRegions: () => Promise<void> }): JobDefinition {
  return {
    name: 'checkAndAdvanceIndependentRegions',
    intervalMs: 60 * 1000,
    overlapPolicy: 'skip',
    retry: { maxAttempts: 2, baseDelayMs: 250, maxDelayMs: 2000 },
    run: deps.checkAndAdvanceIndependentRegions,
  };
}

