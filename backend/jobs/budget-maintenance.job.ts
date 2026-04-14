import type { JobDefinition } from './job-types';

export function createBudgetMaintenanceJob(deps: { budgetMaintenanceTick: () => Promise<void> }): JobDefinition {
  return {
    name: 'budgetMaintenanceTick',
    intervalMs: 60 * 1000,
    overlapPolicy: 'skip',
    retry: { maxAttempts: 2, baseDelayMs: 250, maxDelayMs: 2000 },
    run: deps.budgetMaintenanceTick,
  };
}

