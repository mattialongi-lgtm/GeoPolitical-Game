import type { JobHandle } from './job-types';
import { startIntervalJob } from './job-runner';
import { createAutomationJob } from './automation.job';
import { createBudgetMaintenanceJob } from './budget-maintenance.job';
import { createDailyResourceResetJob } from './daily-reset.job';
import { createElectionsJob } from './elections.job';
import { createIndependentRegionsJob } from './independent-regions.job';
import { createLawsJob } from './laws.job';
import { createReadRollupsJob } from './read-rollups.job';
import { createWarsResolutionJob } from './wars.job';

export function startBackendJobs(deps: {
  budgetMaintenanceTick: () => Promise<void>;
  checkAndResolveElections: () => Promise<void>;
  checkAndAdvanceIndependentRegions: () => Promise<void>;
  checkAndResolveLaws: () => Promise<void>;
  checkAndResolveWars: () => Promise<void>;
  processAutomationTick: () => Promise<void>;
  dailyResourceReset: (logicalDate: string) => Promise<void>;
  refreshReadRollupsTick?: () => Promise<void>;
}): JobHandle[] {
  const jobs = [
    createBudgetMaintenanceJob({ budgetMaintenanceTick: deps.budgetMaintenanceTick }),
    createElectionsJob({ checkAndResolveElections: deps.checkAndResolveElections }),
    createIndependentRegionsJob({ checkAndAdvanceIndependentRegions: deps.checkAndAdvanceIndependentRegions }),
    createLawsJob({ checkAndResolveLaws: deps.checkAndResolveLaws }),
    createWarsResolutionJob({ checkAndResolveWars: deps.checkAndResolveWars }),
    createAutomationJob({ processAutomationTick: deps.processAutomationTick }),
    createDailyResourceResetJob({ dailyResourceReset: deps.dailyResourceReset }),
  ];

  if (deps.refreshReadRollupsTick) {
    jobs.push(createReadRollupsJob({ refreshReadRollupsTick: deps.refreshReadRollupsTick }));
  }

  return jobs.map((job) => startIntervalJob(job));
}
