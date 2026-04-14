import type { JobDefinition } from './job-types';

export function createAutomationJob(deps: { processAutomationTick: () => Promise<void> }): JobDefinition {
  return {
    name: 'automationTick',
    intervalMs: 60 * 1000,
    overlapPolicy: 'skip',
    retry: { maxAttempts: 1, baseDelayMs: 0, maxDelayMs: 0 },
    run: deps.processAutomationTick,
  };
}

