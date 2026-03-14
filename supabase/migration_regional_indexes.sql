-- ══════════════════════════════════════════════════════════════════
-- Migration: Regional Indexes System
-- Adds progress tracking, regional classification, and modifier
-- columns to the regions table to support the full Regional Indexes
-- gameplay system (Health / Military / Education / Development).
-- ══════════════════════════════════════════════════════════════════

-- Progress columns (0–100 float): how far the region has progressed
-- toward the next level for each index.
ALTER TABLE regions ADD COLUMN IF NOT EXISTS "healthProgress"      FLOAT DEFAULT 0;
ALTER TABLE regions ADD COLUMN IF NOT EXISTS "militaryProgress"    FLOAT DEFAULT 0;
ALTER TABLE regions ADD COLUMN IF NOT EXISTS "educationProgress"   FLOAT DEFAULT 0;
ALTER TABLE regions ADD COLUMN IF NOT EXISTS "developmentProgress" FLOAT DEFAULT 0;

-- Regional classification derived automatically from developmentIndex.
-- Values: 'developed' | 'developing' | 'underdeveloped'
ALTER TABLE regions ADD COLUMN IF NOT EXISTS "regionalClassification" TEXT DEFAULT 'underdeveloped';

-- Optional gameplay modifier columns.
-- These allow external systems (pollution, wars, crises) to apply
-- temporary adjustments to region effectiveness without touching
-- the core index values.  All default to 0 (no effect).
ALTER TABLE regions ADD COLUMN IF NOT EXISTS "pollutionModifier" FLOAT DEFAULT 0;
ALTER TABLE regions ADD COLUMN IF NOT EXISTS "warModifier"       FLOAT DEFAULT 0;
ALTER TABLE regions ADD COLUMN IF NOT EXISTS "crisisModifier"    FLOAT DEFAULT 0;

-- ── Back-fill classification for existing rows ───────────────────
-- Regions with no developmentIndex data default to 'underdeveloped'.
UPDATE regions
SET "regionalClassification" = CASE
    WHEN "developmentIndex" >= 6 THEN 'developed'
    WHEN "developmentIndex" >= 2 THEN 'developing'
    ELSE 'underdeveloped'
END
WHERE "regionalClassification" = 'underdeveloped';
