import type { JobDefinition } from './job-types';

export function createWarsResolutionJob(deps: { checkAndResolveWars: () => Promise<void> }): JobDefinition {
  return {
    name: 'checkAndResolveWars',
    intervalMs: 60 * 1000,
    overlapPolicy: 'skip',
    retry: { maxAttempts: 2, baseDelayMs: 250, maxDelayMs: 2000 },
    run: deps.checkAndResolveWars,
  };
}

