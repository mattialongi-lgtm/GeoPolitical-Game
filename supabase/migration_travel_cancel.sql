-- Migration: store travel origin and duration for cancel/return flows

ALTER TABLE users ADD COLUMN IF NOT EXISTS "travelingFrom" TEXT DEFAULT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS "travelDurationMs" BIGINT DEFAULT NULL;
