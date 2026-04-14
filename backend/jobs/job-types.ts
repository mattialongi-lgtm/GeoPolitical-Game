export type OverlapPolicy = 'skip';

export type RetryPolicy = {
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
};

export type JobDefinition = {
  name: string;
  intervalMs: number;
  overlapPolicy?: OverlapPolicy;
  retry?: RetryPolicy;
  timeoutMs?: number;
  run: () => Promise<void>;
};

export type JobHandle = {
  name: string;
  stop: () => void;
};

