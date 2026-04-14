import { logger } from '../utils/logger';
import type { JobDefinition, JobHandle, RetryPolicy } from './job-types';

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

const withTimeout = async <T>(promise: Promise<T>, timeoutMs: number, jobName: string): Promise<T> => {
  let timeoutHandle: NodeJS.Timeout | undefined;
  const timeoutPromise = new Promise<T>((_, reject) => {
    timeoutHandle = setTimeout(() => reject(new Error(`[jobs] ${jobName} timed out after ${timeoutMs}ms`)), timeoutMs);
  });
  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeoutHandle) clearTimeout(timeoutHandle);
  }
};

const computeBackoffDelayMs = (attemptIndex: number, policy: RetryPolicy): number => {
  const raw = policy.baseDelayMs * Math.pow(2, attemptIndex);
  return Math.min(policy.maxDelayMs, Math.max(0, Math.floor(raw)));
};

export function createJobRunner(job: JobDefinition): () => Promise<void> {
  let running = false;

  const overlapPolicy = job.overlapPolicy ?? 'skip';
  const retry = job.retry ?? { maxAttempts: 1, baseDelayMs: 0, maxDelayMs: 0 };

  return async () => {
    if (running) {
      if (overlapPolicy === 'skip') return;
      return;
    }

    running = true;
    const startedAt = Date.now();
    logger.debug(`[jobs] ${job.name} start`);

    try {
      let lastError: unknown | undefined;

      for (let attempt = 0; attempt < retry.maxAttempts; attempt++) {
        try {
          const execution = job.run();
          if (job.timeoutMs != null) {
            await withTimeout(execution, job.timeoutMs, job.name);
          } else {
            await execution;
          }
          lastError = undefined;
          break;
        } catch (err) {
          lastError = err;
          const isLastAttempt = attempt === retry.maxAttempts - 1;
          logger.error(`[jobs] ${job.name} attempt ${attempt + 1}/${retry.maxAttempts} failed`, { err });
          if (!isLastAttempt) {
            const delayMs = computeBackoffDelayMs(attempt, retry);
            if (delayMs > 0) await sleep(delayMs);
          }
        }
      }

      if (lastError) throw lastError;
    } catch (err) {
      logger.error(`[jobs] ${job.name} failed`, { err });
    } finally {
      const durationMs = Date.now() - startedAt;
      logger.debug(`[jobs] ${job.name} end`, { durationMs });
      running = false;
    }
  };
}

export function startIntervalJob(job: JobDefinition, opts?: { runOnStart?: boolean }): JobHandle {
  const run = createJobRunner(job);
  if (opts?.runOnStart) void run();

  const handle = setInterval(() => {
    void run();
  }, job.intervalMs);

  return {
    name: job.name,
    stop: () => clearInterval(handle),
  };
}

