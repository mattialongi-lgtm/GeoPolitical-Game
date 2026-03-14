-- ============================================================
-- MIGRATION: Advanced Resource Extraction System
-- Features: work experience, productivity formula, regional consumption,
--           tax/payout distribution, extraction analytics, daily reset
-- Depends on: migration_resources.sql (region_resources, game_settings, etc.)
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ────────────────────────────────────────────────────────────
-- 1. PLAYER RESOURCE WORK EXPERIENCE
-- Tracks per-player, per-resource experience for the productivity formula.
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS player_resource_work_experience (
    "playerId"         UUID    NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    "resourceType"     TEXT    NOT NULL,
    experience         INT     NOT NULL DEFAULT 1,
    "totalExtractions" INT     NOT NULL DEFAULT 0,
    "lastWorkedAt"     TIMESTAMPTZ DEFAULT NULL,
    PRIMARY KEY ("playerId", "resourceType")
);

CREATE INDEX IF NOT EXISTS idx_prwe_player
    ON player_resource_work_experience ("playerId");

-- ────────────────────────────────────────────────────────────
-- 2. EXTRACTION DETAILED LOGS (richer than resource_extraction_logs)
-- One row per extraction action with full breakdown for analytics.
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS extraction_detailed_logs (
    id                 BIGSERIAL PRIMARY KEY,
    "playerId"         UUID    NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    "regionId"         TEXT    NOT NULL REFERENCES regions(id) ON DELETE CASCADE,
    "factoryId"        UUID    NULL,
    "resourceType"     TEXT    NOT NULL,
    "grossAmount"      NUMERIC NOT NULL DEFAULT 0,
    "playerAmount"     NUMERIC NOT NULL DEFAULT 0,
    "ownerAmount"      NUMERIC NOT NULL DEFAULT 0,
    "taxAmount"        NUMERIC NOT NULL DEFAULT 0,
    "stateAmount"      NUMERIC NOT NULL DEFAULT 0,
    "autonomyAmount"   NUMERIC NOT NULL DEFAULT 0,
    "moneyGenerated"   NUMERIC NOT NULL DEFAULT 0,
    "withdrawnPoints"  NUMERIC NOT NULL DEFAULT 0,
    "playerLevel"      INT     NOT NULL DEFAULT 1,
    "factoryLevel"     INT     NOT NULL DEFAULT 1,
    "workExperience"   INT     NOT NULL DEFAULT 1,
    "resourceCoefficient" NUMERIC NOT NULL DEFAULT 0,
    "finalProductivity" NUMERIC NOT NULL DEFAULT 0,
    "createdAt"        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_edl_player_date
    ON extraction_detailed_logs ("playerId", "createdAt");
CREATE INDEX IF NOT EXISTS idx_edl_region_date
    ON extraction_detailed_logs ("regionId", "createdAt");
CREATE INDEX IF NOT EXISTS idx_edl_factory
    ON extraction_detailed_logs ("factoryId", "createdAt");

-- ────────────────────────────────────────────────────────────
-- 3. RESOURCE DEPARTMENT BONUSES (per region)
-- Stores the active resource department bonus level for a region.
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS resource_department_bonuses (
    "regionId"         TEXT    NOT NULL REFERENCES regions(id) ON DELETE CASCADE,
    "resourceType"     TEXT    NOT NULL,
    "bonusLevel"       INT     NOT NULL DEFAULT 0,
    "updatedAt"        TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY ("regionId", "resourceType")
);

-- ────────────────────────────────────────────────────────────
-- 4. ADD deep_bonus_cap COLUMN TO region_resources (if not exists)
-- Stores the current deep exploration bonus for the region's resource cap.
-- ────────────────────────────────────────────────────────────
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'region_resources'
          AND column_name = 'deepBonusCap'
    ) THEN
        ALTER TABLE region_resources ADD COLUMN "deepBonusCap" INT NOT NULL DEFAULT 0;
    END IF;
END $$;

-- ────────────────────────────────────────────────────────────
-- 5. ADDITIONAL GAME SETTINGS for the extraction formula
-- ────────────────────────────────────────────────────────────
INSERT INTO game_settings (key, value, description) VALUES
  ('extraction_base_coefficient',       '0.2',   'Base coefficient for productivity formula'),
  ('extraction_player_level_exponent',  '0.8',   'Exponent for player level in productivity formula'),
  ('extraction_resource_coeff_exponent','0.8',   'Exponent for resource coefficient in productivity formula'),
  ('extraction_factory_level_exponent', '0.8',   'Exponent for factory level in productivity formula'),
  ('extraction_work_exp_exponent',      '0.6',   'Exponent for work experience in productivity formula'),
  ('extraction_nation_bonus',           '1.2',   'Nation/global production bonus multiplier'),
  ('extraction_gold_to_money',          '3.538975', 'Money generated per unit of gold produced'),
  ('extraction_work_exp_gain',          '1',     'Work experience gained per extraction action'),
  ('extraction_balancing_multipliers',  '{"gold_ore":4,"oil":1,"minerals":1,"uranium":1,"diamonds":0.001,"liquid_oxygen":0.2,"helium3":0.001,"rivalium":1}', 'Final balancing multipliers per resource type'),
  ('extraction_resource_coeff_multipliers', '{"gold_ore":0.4,"oil":0.65,"minerals":0.65,"uranium":0.75,"diamonds":0.75}', 'Resource coefficient multipliers based on region max cap'),
  ('extraction_consumption_gold_ore',   '{"linearCoeff":200000,"baseOffset":20000000}', 'Regional consumption formula coefficients for gold'),
  ('extraction_consumption_oil',        '{"linearCoeff":200000,"baseOffset":20000000}', 'Regional consumption formula coefficients for oil'),
  ('extraction_consumption_minerals',   '{"linearCoeff":200000,"baseOffset":20000000}', 'Regional consumption formula coefficients for minerals'),
  ('extraction_consumption_uranium',    '{"linearCoeff":200000,"baseOffset":20000000}', 'Regional consumption formula coefficients for uranium'),
  ('extraction_consumption_diamonds',   '{"linearCoeff":250,"baseOffset":25000}', 'Regional consumption formula coefficients for diamonds'),
  ('extraction_consumption_helium3',    '{"linearCoeff":250,"baseOffset":25000}', 'Regional consumption formula coefficients for helium3'),
  ('extraction_energy_resource_multiplier', '2', 'Multiplier for power plants in energy-based resource coefficient'),
  ('extraction_energy_resource_exponent',   '0.4', 'Exponent for energy-based resource coefficient')
ON CONFLICT (key) DO NOTHING;

-- ────────────────────────────────────────────────────────────
-- 6. RLS POLICIES
-- ────────────────────────────────────────────────────────────

ALTER TABLE player_resource_work_experience ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "prwe_read" ON player_resource_work_experience;
CREATE POLICY "prwe_read" ON player_resource_work_experience
    FOR SELECT USING (true);

ALTER TABLE extraction_detailed_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "edl_read" ON extraction_detailed_logs;
CREATE POLICY "edl_read" ON extraction_detailed_logs
    FOR SELECT USING (true);

ALTER TABLE resource_department_bonuses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "rdb_read" ON resource_department_bonuses;
CREATE POLICY "rdb_read" ON resource_department_bonuses
    FOR SELECT USING (true);

-- ============================================================
-- END MIGRATION
-- ============================================================
