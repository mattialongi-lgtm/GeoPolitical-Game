import { createJobRunner } from '../../jobs/job-runner';
import type { JobDefinition } from '../../jobs/job-types';

describe('job-runner', () => {
  test('overlapPolicy=skip prevents overlapping runs', async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });

    const job: JobDefinition = {
      name: 'overlap-skip',
      intervalMs: 1,
      overlapPolicy: 'skip',
      run: jest.fn(async () => {
        await gate;
      }),
    };

    const run = createJobRunner(job);

    const first = run();
    await Promise.resolve(); // allow job.run to start

    await run(); // should be skipped
    expect(job.run).toHaveBeenCalledTimes(1);

    release();
    await first;
  });

  test('retries up to maxAttempts', async () => {
    const job: JobDefinition = {
      name: 'retry',
      intervalMs: 1,
      overlapPolicy: 'skip',
      retry: { maxAttempts: 3, baseDelayMs: 0, maxDelayMs: 0 },
      run: jest
        .fn()
        .mockRejectedValueOnce(new Error('fail-1'))
        .mockRejectedValueOnce(new Error('fail-2'))
        .mockResolvedValueOnce(undefined),
    };

    const run = createJobRunner(job);
    await run();

    expect(job.run).toHaveBeenCalledTimes(3);
  });
});

