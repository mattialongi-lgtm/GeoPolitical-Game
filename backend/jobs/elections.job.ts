import type { JobDefinition } from './job-types';

export function createElectionsJob(deps: { checkAndResolveElections: () => Promise<void> }): JobDefinition {
  return {
    name: 'checkAndResolveElections',
    intervalMs: 60 * 1000,
    overlapPolicy: 'skip',
    retry: { maxAttempts: 2, baseDelayMs: 250, maxDelayMs: 2000 },
    run: deps.checkAndResolveElections,
  };
}

