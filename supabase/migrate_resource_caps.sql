-- Migration: Two-level regional resource cap system
-- Run this once against the existing database.

ALTER TABLE region_resources
  ADD COLUMN IF NOT EXISTS "dailyMaxCap" INT NOT NULL DEFAULT 5000,
  ADD COLUMN IF NOT EXISTS "initialAvailableCap" INT NOT NULL DEFAULT 200,
  ADD COLUMN IF NOT EXISTS "currentAvailableCap" INT NOT NULL DEFAULT 200,
  ADD COLUMN IF NOT EXISTS "totalUnlockedToday" INT NOT NULL DEFAULT 0;

-- Set per-resource defaults (matching REGIONAL_EXTRACTION_CAPS in src/types.ts)
UPDATE region_resources SET
  "dailyMaxCap" = CASE "resourceType"
    WHEN 'gold_ore' THEN 1250
    WHEN 'oil'      THEN 300
    WHEN 'minerals' THEN 300
    WHEN 'uranium'  THEN 45
    WHEN 'diamonds' THEN 60
    ELSE 5000
  END,
  "initialAvailableCap" = CASE "resourceType"
    WHEN 'gold_ore' THEN 350
    WHEN 'oil'      THEN 102
    WHEN 'minerals' THEN 102
    WHEN 'uranium'  THEN 15
    WHEN 'diamonds' THEN 20
    ELSE 200
  END,
  "currentAvailableCap" = CASE "resourceType"
    WHEN 'gold_ore' THEN 350
    WHEN 'oil'      THEN 102
    WHEN 'minerals' THEN 102
    WHEN 'uranium'  THEN 15
    WHEN 'diamonds' THEN 20
    ELSE 200
  END,
  "totalUnlockedToday" = CASE "resourceType"
    WHEN 'gold_ore' THEN 350
    WHEN 'oil'      THEN 102
    WHEN 'minerals' THEN 102
    WHEN 'uranium'  THEN 15
    WHEN 'diamonds' THEN 20
    ELSE 200
  END;

-- Efficient daily reset function (uses column references, cannot be done via SDK)
CREATE OR REPLACE FUNCTION reset_daily_resource_caps()
RETURNS void
LANGUAGE sql
AS $$
  UPDATE region_resources SET
    "dailyExtracted" = 0,
    "currentAvailableCap" = "initialAvailableCap",
    "totalUnlockedToday" = "initialAvailableCap",
    "updatedAt" = NOW();
$$;

-- Grant execute to service role
GRANT EXECUTE ON FUNCTION reset_daily_resource_caps() TO service_role;
