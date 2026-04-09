import { useCallback, useEffect, useRef } from "react";

interface UsePollingTaskOptions {
  enabled?: boolean;
  intervalMs?: number | null;
  runImmediately?: boolean;
  refreshOnVisible?: boolean;
  refreshOnFocus?: boolean;
  pauseWhenHidden?: boolean;
}

export function usePollingTask(
  task: () => void | Promise<void>,
  {
    enabled = true,
    intervalMs = null,
    runImmediately = true,
    refreshOnVisible = false,
    refreshOnFocus = false,
    pauseWhenHidden = true,
  }: UsePollingTaskOptions = {},
) {
  const taskRef = useRef(task);
  const inFlightRef = useRef(false);

  useEffect(() => {
    taskRef.current = task;
  }, [task]);

  const runTask = useCallback(async () => {
    if (!enabled) return;
    if (pauseWhenHidden && typeof document !== "undefined" && document.hidden) return;
    if (inFlightRef.current) return;

    inFlightRef.current = true;
    try {
      await taskRef.current();
    } finally {
      inFlightRef.current = false;
    }
  }, [enabled, pauseWhenHidden]);

  useEffect(() => {
    if (!enabled || !runImmediately) return;
    void runTask();
  }, [enabled, runImmediately, runTask, task]);

  useEffect(() => {
    if (!enabled || !intervalMs) return;

    const intervalId = window.setInterval(() => {
      void runTask();
    }, intervalMs);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [enabled, intervalMs, runTask]);

  useEffect(() => {
    if (!enabled || !refreshOnVisible) return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void runTask();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [enabled, refreshOnVisible, runTask]);

  useEffect(() => {
    if (!enabled || !refreshOnFocus) return;

    const handleFocus = () => {
      void runTask();
    };

    window.addEventListener("focus", handleFocus);
    return () => {
      window.removeEventListener("focus", handleFocus);
    };
  }, [enabled, refreshOnFocus, runTask]);

  return runTask;
}
