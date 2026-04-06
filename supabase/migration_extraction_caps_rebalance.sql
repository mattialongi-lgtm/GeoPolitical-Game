-- ============================================================
-- Migration: Rebalance regional extraction caps
-- Applies the new per-resource caps to existing data and defaults.
-- ============================================================

BEGIN;

INSERT INTO game_settings (key, value, description)
VALUES
  ('daily_available_base', '{"oil":300,"minerals":300,"uranium":45,"diamonds":60,"gold_ore":1250}', 'Base daily available per resource type'),
  ('base_cap_defaults', '{"oil":300,"minerals":300,"uranium":45,"diamonds":60,"gold_ore":1250}', 'Default base cap per recharge per resource type')
ON CONFLICT (key) DO UPDATE
SET value = EXCLUDED.value,
    description = EXCLUDED.description,
    "updatedAt" = NOW();

UPDATE region_resources
SET
  "dailyAvailable" = CASE "resourceType"
    WHEN 'gold_ore' THEN 1250
    WHEN 'oil' THEN 300
    WHEN 'minerals' THEN 300
    WHEN 'uranium' THEN 45
    WHEN 'diamonds' THEN 60
    ELSE "dailyAvailable"
  END,
  "baseCapPerRecharge" = CASE "resourceType"
    WHEN 'gold_ore' THEN 1250
    WHEN 'oil' THEN 300
    WHEN 'minerals' THEN 300
    WHEN 'uranium' THEN 45
    WHEN 'diamonds' THEN 60
    ELSE "baseCapPerRecharge"
  END,
  "updatedAt" = NOW()
WHERE "resourceType" IN ('gold_ore', 'oil', 'minerals', 'uranium', 'diamonds');

ALTER TABLE regions ALTER COLUMN "dailyExtractionLimitGold" SET DEFAULT 1250;
ALTER TABLE regions ALTER COLUMN "dailyExtractionLimitOil" SET DEFAULT 300;
ALTER TABLE regions ALTER COLUMN "dailyExtractionLimitMinerals" SET DEFAULT 300;
ALTER TABLE regions ALTER COLUMN "dailyExtractionLimitUranium" SET DEFAULT 45;
ALTER TABLE regions ALTER COLUMN "dailyExtractionLimitDiamonds" SET DEFAULT 60;

UPDATE regions
SET
  "dailyExtractionLimitGold" = 1250,
  "dailyExtractionLimitOil" = 300,
  "dailyExtractionLimitMinerals" = 300,
  "dailyExtractionLimitUranium" = 45,
  "dailyExtractionLimitDiamonds" = 60;

COMMIT;
