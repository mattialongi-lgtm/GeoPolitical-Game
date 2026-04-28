import { randomBytes } from "crypto";
import { hostname } from "os";

export const PORT = Number(process.env.PORT || 3000);
export const IS_PRODUCTION = process.env.NODE_ENV === "production";
export const ENABLE_DEV_ENDPOINTS = process.env.ENABLE_DEV_ENDPOINTS === "true";

export const DAILY_RESOURCE_RESET_LOCK_TIMEOUT_SECONDS = 30 * 60;
export const DAILY_RESOURCE_RESET_OWNER = `${hostname()}:${PORT}:${process.pid}:${randomBytes(4).toString("hex")}`;

export function validateRuntimeConfig() {
  if (IS_PRODUCTION && (!process.env.JWT_SECRET || process.env.JWT_SECRET === "change-me-in-production")) {
    console.error("FATAL ERROR: JWT_SECRET must be set to a strong value in production");
    process.exit(1);
  }
}
