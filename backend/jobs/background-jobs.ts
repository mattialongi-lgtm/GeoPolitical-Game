import { logger } from '../utils/logger';

export function createNoOverlapBackgroundJob(jobName: string, job: () => Promise<void>) {
  let running = false;
  return async () => {
    if (running) return;
    running = true;
    try {
      await job();
    } catch (err) {
      logger.error(`[jobs] ${jobName} failed`, { err });
    } finally {
      running = false;
    }
  };
}

export function startBackgroundJobs(deps: {
  budgetMaintenanceTick: () => Promise<void>;
  checkAndResolveElections: () => Promise<void>;
  checkAndAdvanceIndependentRegions: () => Promise<void>;
  checkAndResolveLaws: () => Promise<void>;
  checkAndResolveWars: () => Promise<void>;
  processAutomationTick: () => Promise<void>;
  dailyResourceReset: (logicalDate: string) => Promise<void>;
}) {
  const runBudgetMaintenanceTick = createNoOverlapBackgroundJob(
    'budgetMaintenanceTick',
    deps.budgetMaintenanceTick,
  );
  const runCheckAndResolveElections = createNoOverlapBackgroundJob(
    'checkAndResolveElections',
    deps.checkAndResolveElections,
  );
  const runCheckAndAdvanceIndependentRegions = createNoOverlapBackgroundJob(
    'checkAndAdvanceIndependentRegions',
    deps.checkAndAdvanceIndependentRegions,
  );
  const runCheckAndResolveLaws = createNoOverlapBackgroundJob(
    'checkAndResolveLaws',
    deps.checkAndResolveLaws,
  );
  const runCheckAndResolveWars = createNoOverlapBackgroundJob(
    'checkAndResolveWars',
    deps.checkAndResolveWars,
  );
  const runDailyResourceReset = createNoOverlapBackgroundJob('dailyResourceReset', async () => {
    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD (UTC)
    await deps.dailyResourceReset(today);
  });

  // Global Budget Tick (every 60 seconds)
  setInterval(() => {
    void runBudgetMaintenanceTick();
  }, 60 * 1000);

  // Game Cronjobs (Laws and Elections)
  setInterval(() => {
    void runCheckAndResolveElections();
    void runCheckAndAdvanceIndependentRegions();
    void runCheckAndResolveLaws();
    void runCheckAndResolveWars();
    void deps.processAutomationTick();
  }, 60 * 1000); // Check every minute

  // Daily Resource Reset (check every 5 minutes, DB-backed single execution per UTC day)
  setInterval(() => {
    void runDailyResourceReset();
  }, 5 * 60 * 1000);
}

