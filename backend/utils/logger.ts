/**
 * Lightweight structured logger.
 *
 * Drop-in replacement for console.log/warn/error with an
 * object-context parameter.  Ready to be swapped for Winston /
 * Pino / etc. in the future without touching call-sites.
 */
export const logger = {
  info(message: string, context?: Record<string, unknown>): void {
    console.log(`[INFO] ${message}`, context ? JSON.stringify(context) : '');
  },
  warn(message: string, context?: Record<string, unknown>): void {
    console.warn(`[WARN] ${message}`, context ? JSON.stringify(context) : '');
  },
  error(message: string, context?: Record<string, unknown>): void {
    console.error(`[ERROR] ${message}`, context ? JSON.stringify(context) : '');
  },
  debug(message: string, context?: Record<string, unknown>): void {
    if (process.env.DEBUG) {
      console.debug(`[DEBUG] ${message}`, context ? JSON.stringify(context) : '');
    }
  },
};
