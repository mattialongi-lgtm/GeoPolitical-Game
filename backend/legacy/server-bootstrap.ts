import compression from "compression";
import cookieParser from "cookie-parser";
import express from "express";
import type { Express } from "express";
import { startBackendJobs } from "../jobs/scheduler";
import { errorHandler } from "../middleware/errorHandler.middleware";
import { globalLimiter } from "../middleware/rateLimiter.middleware";
import { logger } from "../utils/logger";

export function createLegacyExpressApp() {
  const app = express();
  app.use(compression());
  app.use(express.json());
  app.use(cookieParser());
  app.use("/api", globalLimiter);
  return app;
}

export function finalizeLegacyExpressApp(app: Express) {
  app.use(errorHandler);

  if (process.env.NODE_ENV === "production") {
    app.use(express.static("dist"));
  }
}

export function listenAndStartLegacyJobs(
  app: Express,
  port: number,
  jobs: Parameters<typeof startBackendJobs>[0]
) {
  app.listen(port, "0.0.0.0", () => {
    logger.info(`Server running on http://localhost:${port}`);
    startBackendJobs(jobs);
  }).on("error", (err: any) => {
    if (err.code === "EADDRINUSE") {
      logger.error(`FATAL ERROR: Port ${port} is already in use.`, { err });
    } else {
      logger.error("FATAL ERROR: Server failed to start.", { err });
    }
    process.exit(1);
  });
}
