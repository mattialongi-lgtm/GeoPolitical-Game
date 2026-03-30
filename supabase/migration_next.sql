-- ══════════════════════════════════════════════════════════════════
-- COMBINED MIGRATION: Steps 10–16
-- ══════════════════════════════════════════════════════════════════
-- Run this file ONCE in the Supabase SQL Editor if you have already
-- executed steps 1-9 (up to migration_consolidated.sql).
--
-- This file is fully IDEMPOTENT — every statement uses
-- IF NOT EXISTS / ADD COLUMN IF NOT EXISTS / CREATE OR REPLACE /
-- ON CONFLICT DO NOTHING, so re-running it is safe and will NOT
-- reset or delete any existing game data.
--
-- Contents (in dependency order):
--   PART A — Factory Economy V2        (was migration_factories_v2.sql)
--   PART B — Factory System V3         (was migration_factories_v3.sql)
--   PART C — Factory Storage Fix       (was migration_factory_storage_fix.sql)
--   PART D — Bugfixes V3               (was migration_bugfixes_v3.sql)
--   PART E — Extraction System         (was migration_extraction_system.sql)
--   PART F — Regional Autonomy         (was migration_regional_autonomy.sql)
--   PART G — Regional Indexes          (was migration_regional_indexes.sql)
-- ══════════════════════════════════════════════════════════════════

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ════════════════════════════════════════════════════════════════
-- PART A — Factory Economy V2
-- Extends factories table + adds marketplace / economy / worker logs
-- ════════════════════════════════════════════════════════════════

-- A.1 Extend factories table with economy columns
ALTER TABLE factories ADD COLUMN IF NOT EXISTS "currentStorage" BIGINT DEFAULT 0;
ALTER TABLE factories ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN DEFAULT TRUE;
ALTER TABLE factories ADD COLUMN IF NOT EXISTS "totalWorkerCount" INT DEFAULT 0;
ALTER TABLE factories ADD COLUMN IF NOT EXISTS "totalProduction" BIGINT DEFAULT 0;
ALTER TABLE factories ADD COLUMN IF NOT EXISTS "totalOwnerProfit" BIGINT DEFAULT 0;
ALTER TABLE factories ADD COLUMN IF NOT EXISTS "totalTaxesPaid" BIGINT DEFAULT 0;
ALTER TABLE factories ADD COLUMN IF NOT EXISTS "listedForSale" BOOLEAN DEFAULT FALSE;
ALTER TABLE factories ADD COLUMN IF NOT EXISTS "salePrice" BIGINT DEFAULT 0;

-- A.2 Factory market listings table
CREATE TABLE IF NOT EXISTS factory_market_listings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "factoryId" UUID NOT NULL REFERENCES factories(id) ON DELETE CASCADE,
    "sellerId" UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    "askingPrice" BIGINT NOT NULL CHECK ("askingPrice" > 0),
    "listedAt" TIMESTAMPTZ DEFAULT NOW(),
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'sold', 'cancelled')),
    "buyerId" UUID REFERENCES users(id),
    "soldAt" TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_factory_market_status ON factory_market_listings(status);
CREATE INDEX IF NOT EXISTS idx_factory_market_factory ON factory_market_listings("factoryId");

-- A.3 Factory economy logs table
CREATE TABLE IF NOT EXISTS factory_economy_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "factoryId" UUID NOT NULL REFERENCES factories(id) ON DELETE CASCADE,
    "logDate" DATE NOT NULL DEFAULT CURRENT_DATE,
    "workerCount" INT DEFAULT 0,
    "grossIncome" BIGINT DEFAULT 0,
    "taxesPaid" BIGINT DEFAULT 0,
    "ownerProfit" BIGINT DEFAULT 0,
    production BIGINT DEFAULT 0,
    UNIQUE("factoryId", "logDate")
);

CREATE INDEX IF NOT EXISTS idx_factory_econ_factory ON factory_economy_logs("factoryId");
CREATE INDEX IF NOT EXISTS idx_factory_econ_date ON factory_economy_logs("logDate");

-- A.4 Factory worker logs table
CREATE TABLE IF NOT EXISTS factory_worker_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "factoryId" UUID NOT NULL REFERENCES factories(id) ON DELETE CASCADE,
    "workerId" UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    "workedAt" TIMESTAMPTZ DEFAULT NOW(),
    "earningsMoney" BIGINT DEFAULT 0,
    "earningsGold" NUMERIC(12,2) DEFAULT 0,
    "resourceType" TEXT,
    "resourceAmount" BIGINT DEFAULT 0,
    "ownerCut" BIGINT DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_factory_worker_factory ON factory_worker_logs("factoryId");
CREATE INDEX IF NOT EXISTS idx_factory_worker_worker ON factory_worker_logs("workerId");
CREATE INDEX IF NOT EXISTS idx_factory_worker_date ON factory_worker_logs("workedAt");

-- A.5 RLS Policies
ALTER TABLE factory_market_listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE factory_economy_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE factory_worker_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "factory_market_read" ON factory_market_listings;
CREATE POLICY "factory_market_read" ON factory_market_listings FOR SELECT USING (true);

DROP POLICY IF EXISTS "factory_market_insert" ON factory_market_listings;
CREATE POLICY "factory_market_insert" ON factory_market_listings FOR INSERT WITH CHECK (auth.uid() = "sellerId");

DROP POLICY IF EXISTS "factory_market_update" ON factory_market_listings;
CREATE POLICY "factory_market_update" ON factory_market_listings FOR UPDATE USING (auth.uid() = "sellerId" OR auth.uid() = "buyerId");

DROP POLICY IF EXISTS "factory_econ_read" ON factory_economy_logs;
CREATE POLICY "factory_econ_read" ON factory_economy_logs FOR SELECT USING (true);

DROP POLICY IF EXISTS "factory_econ_write" ON factory_economy_logs;
CREATE POLICY "factory_econ_write" ON factory_economy_logs FOR ALL USING (true);

DROP POLICY IF EXISTS "factory_worker_read" ON factory_worker_logs;
CREATE POLICY "factory_worker_read" ON factory_worker_logs FOR SELECT USING (true);

DROP POLICY IF EXISTS "factory_worker_write" ON factory_worker_logs;
CREATE POLICY "factory_worker_write" ON factory_worker_logs FOR ALL USING (true);

-- A.6 Upsert helper for daily economy logs
CREATE OR REPLACE FUNCTION upsert_factory_economy_log(
    p_factory_id UUID,
    p_gross_income BIGINT,
    p_taxes_paid BIGINT,
    p_owner_profit BIGINT,
    p_production BIGINT
) RETURNS VOID AS $$
BEGIN
    INSERT INTO factory_economy_logs ("factoryId", "logDate", "workerCount", "grossIncome", "taxesPaid", "ownerProfit", production)
    VALUES (p_factory_id, CURRENT_DATE, 1, p_gross_income, p_taxes_paid, p_owner_profit, p_production)
    ON CONFLICT ("factoryId", "logDate") DO UPDATE SET
        "workerCount" = factory_economy_logs."workerCount" + 1,
        "grossIncome" = factory_economy_logs."grossIncome" + p_gross_income,
        "taxesPaid" = factory_economy_logs."taxesPaid" + p_taxes_paid,
        "ownerProfit" = factory_economy_logs."ownerProfit" + p_owner_profit,
        production = factory_economy_logs.production + p_production;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- A.7 Transfer factory ownership RPC
CREATE OR REPLACE FUNCTION transfer_factory_ownership(
    p_factory_id UUID,
    p_seller_id UUID,
    p_buyer_id UUID,
    p_price BIGINT,
    p_listing_id UUID
) RETURNS JSON AS $$
DECLARE
    v_factory RECORD;
    v_buyer RECORD;
BEGIN
    SELECT * INTO v_factory FROM factories WHERE id = p_factory_id FOR UPDATE;
    IF NOT FOUND THEN RETURN json_build_object('error', 'Fabbrica non trovata'); END IF;
    IF v_factory."ownerUserId" != p_seller_id THEN RETURN json_build_object('error', 'Venditore non è il proprietario'); END IF;

    SELECT * INTO v_buyer FROM users WHERE id = p_buyer_id FOR UPDATE;
    IF NOT FOUND THEN RETURN json_build_object('error', 'Acquirente non trovato'); END IF;
    IF v_buyer.money < p_price THEN RETURN json_build_object('error', 'Fondi insufficienti'); END IF;

    UPDATE users SET money = money - p_price WHERE id = p_buyer_id;
    UPDATE users SET money = money + p_price WHERE id = p_seller_id;

    UPDATE factories SET "ownerUserId" = p_buyer_id, "listedForSale" = FALSE, "salePrice" = 0 WHERE id = p_factory_id;

    UPDATE factory_market_listings SET status = 'sold', "buyerId" = p_buyer_id, "soldAt" = NOW() WHERE id = p_listing_id;

    RETURN json_build_object('success', true, 'newOwner', p_buyer_id, 'price', p_price);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ════════════════════════════════════════════════════════════════
-- PART B — Factory System V3
-- Missing columns, cooldowns table, budgets, RPCs
-- ════════════════════════════════════════════════════════════════

-- B.1 Missing columns on factories table
ALTER TABLE factories ADD COLUMN IF NOT EXISTS "energyCost" INT DEFAULT 10;
ALTER TABLE factories ADD COLUMN IF NOT EXISTS "payoutMoney" BIGINT DEFAULT 50;
ALTER TABLE factories ADD COLUMN IF NOT EXISTS "minLevel" INT DEFAULT 1;

-- Back-fill payoutMoney with existing wage where different
UPDATE factories SET "payoutMoney" = wage WHERE "payoutMoney" = 50 AND wage <> 50;

-- B.2 General-purpose cooldowns table
CREATE TABLE IF NOT EXISTS cooldowns (
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    action_type TEXT,
    last_used TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (user_id, action_type)
);

-- B.3 Budget tables
CREATE TABLE IF NOT EXISTS budgets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "ownerType" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "moneyEUR" BIGINT DEFAULT 0,
    resources JSONB DEFAULT '{}'::jsonb,
    "updatedAt" BIGINT DEFAULT 0,
    UNIQUE("ownerType", "ownerId")
);

CREATE TABLE IF NOT EXISTS budget_transactions (
    id TEXT PRIMARY KEY,
    "budgetId" UUID REFERENCES budgets(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    subtype TEXT NOT NULL,
    "moneyDelta" BIGINT DEFAULT 0,
    "resourcesDelta" JSONB DEFAULT '{}'::jsonb,
    "createdAt" BIGINT DEFAULT 0,
    "createdByUserId" UUID REFERENCES users(id),
    metadata JSONB DEFAULT '{}'::jsonb
);

-- B.4 add_budget_transaction() RPC
CREATE OR REPLACE FUNCTION add_budget_transaction(
  p_owner_type TEXT,
  p_owner_id TEXT,
  p_type TEXT,
  p_subtype TEXT,
  p_money_delta BIGINT,
  p_resources_delta JSONB DEFAULT '{}'::jsonb,
  p_created_by UUID DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::jsonb
) RETURNS TEXT AS $$
DECLARE
  v_budget_id UUID;
  v_current_money BIGINT;
  v_current_resources JSONB;
  v_new_resources JSONB;
  v_res_key TEXT;
  v_res_val INT;
  v_tx_id TEXT;
BEGIN
  SELECT id, "moneyEUR", resources INTO v_budget_id, v_current_money, v_current_resources
  FROM budgets
  WHERE "ownerType" = p_owner_type AND "ownerId" = p_owner_id;

  IF NOT FOUND THEN
    INSERT INTO budgets ("ownerType", "ownerId", "moneyEUR", resources, "updatedAt")
    VALUES (p_owner_type, p_owner_id, 0, '{}'::jsonb, EXTRACT(EPOCH FROM NOW()) * 1000)
    RETURNING id, "moneyEUR", resources INTO v_budget_id, v_current_money, v_current_resources;
  END IF;

  IF v_current_money + p_money_delta < 0 THEN
    RAISE EXCEPTION 'Fondi insufficienti';
  END IF;

  v_new_resources = v_current_resources;
  FOR v_res_key, v_res_val IN SELECT * FROM jsonb_each_text(p_resources_delta)
  LOOP
    v_new_resources = jsonb_set(
      v_new_resources,
      ARRAY[v_res_key],
      to_jsonb(COALESCE((v_new_resources->>v_res_key)::int, 0) + v_res_val::int)
    );
    IF (v_new_resources->>v_res_key)::int < 0 THEN
      RAISE EXCEPTION 'Risorse insufficienti: %', v_res_key;
    END IF;
  END LOOP;

  UPDATE budgets
  SET "moneyEUR" = "moneyEUR" + p_money_delta,
      resources = v_new_resources,
      "updatedAt" = EXTRACT(EPOCH FROM NOW()) * 1000
  WHERE id = v_budget_id;

  v_tx_id := substr(md5(random()::text || clock_timestamp()::text), 1, 12);
  INSERT INTO budget_transactions (
    id, "budgetId", type, subtype, "moneyDelta", "resourcesDelta", "createdAt", "createdByUserId", metadata
  ) VALUES (
    v_tx_id, v_budget_id, p_type, p_subtype, p_money_delta, p_resources_delta,
    EXTRACT(EPOCH FROM NOW()) * 1000, p_created_by, p_metadata
  );

  RETURN v_tx_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- B.5 process_work_action() RPC
CREATE OR REPLACE FUNCTION process_work_action(
  p_user_id UUID,
  p_factory_id UUID,
  p_energy_cost INT,
  p_net_earnings BIGINT,
  p_taxes BIGINT,
  p_region_id TEXT
) RETURNS VOID AS $$
BEGIN
  UPDATE users
  SET energy = energy - p_energy_cost,
      money = money + p_net_earnings
  WHERE id = p_user_id;

  INSERT INTO user_factory_cooldowns ("userId", "factoryId", "lastUsed")
  VALUES (p_user_id, p_factory_id, NOW())
  ON CONFLICT ("userId", "factoryId") DO UPDATE SET "lastUsed" = EXCLUDED."lastUsed";

  IF p_taxes > 0 THEN
    PERFORM add_budget_transaction(
      'REGION', p_region_id,
      'INCOME', 'TAX',
      p_taxes, '{}'::jsonb,
      p_user_id,
      jsonb_build_object('factoryId', p_factory_id)
    );
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- B.6 Atomic factory counter increment RPC
CREATE OR REPLACE FUNCTION increment_factory_counters(
  p_factory_id UUID,
  p_worker_count INT DEFAULT 1,
  p_production BIGINT DEFAULT 0,
  p_owner_profit BIGINT DEFAULT 0,
  p_taxes_paid BIGINT DEFAULT 0,
  p_storage_delta BIGINT DEFAULT 0
) RETURNS VOID AS $$
BEGIN
  UPDATE factories SET
    "totalWorkerCount" = COALESCE("totalWorkerCount", 0) + p_worker_count,
    "totalProduction"  = COALESCE("totalProduction", 0)  + p_production,
    "totalOwnerProfit" = COALESCE("totalOwnerProfit", 0) + p_owner_profit,
    "totalTaxesPaid"   = COALESCE("totalTaxesPaid", 0)   + p_taxes_paid,
    "currentStorage"   = COALESCE("currentStorage", 0)   + p_storage_delta
  WHERE id = p_factory_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ════════════════════════════════════════════════════════════════
-- PART C — Factory Storage Fix
-- RPCs for internal warehouse support
-- ════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION execute_factory_work(
  p_user_id TEXT,
  p_factory_id UUID,
  p_wage BIGINT,
  p_output_item TEXT,
  p_output_qty INT,
  p_energy_cost INT,
  p_owner_id TEXT
) RETURNS VOID AS $$
BEGIN
  UPDATE users
  SET energy = energy - p_energy_cost,
      money = money + p_wage
  WHERE id = p_user_id;

  UPDATE factories
  SET budget = budget - p_wage,
      "currentStorage" = COALESCE("currentStorage", 0) + p_output_qty
  WHERE id = p_factory_id;

  INSERT INTO user_factory_cooldowns ("userId", "factoryId", "lastUsed")
  VALUES (p_user_id, p_factory_id, NOW())
  ON CONFLICT ("userId", "factoryId") DO UPDATE SET "lastUsed" = EXCLUDED."lastUsed";
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION increment_factory_storage(
  p_factory_id UUID,
  p_amount INT
) RETURNS VOID AS $$
BEGIN
  UPDATE factories
  SET "currentStorage" = COALESCE("currentStorage", 0) + p_amount
  WHERE id = p_factory_id;
END;
$$ LANGUAGE plpgsql;


-- ════════════════════════════════════════════════════════════════
-- PART D — Bugfixes V3
-- Ensures all factory columns exist + activity tracking
-- ════════════════════════════════════════════════════════════════

-- D.1 Ensure user_factory_cooldowns table exists
CREATE TABLE IF NOT EXISTS user_factory_cooldowns (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "userId" UUID REFERENCES users(id),
    "factoryId" UUID REFERENCES factories(id),
    "lastUsed" TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE("userId", "factoryId")
);

-- D.2 Ensure lastLogin column exists in users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS "lastLogin" BIGINT DEFAULT 0;

-- D.3 Update lastLogin for users who have never had it set
UPDATE users SET "lastLogin" = EXTRACT(EPOCH FROM NOW()) * 1000
WHERE "lastLogin" IS NULL OR "lastLogin" = 0;

-- D.4 Ensure governance columns exist in regions table
ALTER TABLE regions ADD COLUMN IF NOT EXISTS dictatorship INT DEFAULT 0;
ALTER TABLE regions ADD COLUMN IF NOT EXISTS "governmentForm" TEXT DEFAULT 'PRESIDENTIAL_REPUBLIC';
ALTER TABLE regions ADD COLUMN IF NOT EXISTS "leaderTitle" TEXT DEFAULT 'Presidente';

-- D.5 Fix nations updatedAt for any NULL values
UPDATE nations SET "updatedAt" = EXTRACT(EPOCH FROM NOW()) * 1000
WHERE "updatedAt" IS NULL;


-- ════════════════════════════════════════════════════════════════
-- PART E — Advanced Resource Extraction System
-- Work experience, productivity formula, analytics
-- Depends on: migration_resources.sql (step 8, already applied)
-- ════════════════════════════════════════════════════════════════

-- E.1 Player Resource Work Experience
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

-- E.2 Extraction Detailed Logs
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

-- E.3 Resource Department Bonuses
CREATE TABLE IF NOT EXISTS resource_department_bonuses (
    "regionId"         TEXT    NOT NULL REFERENCES regions(id) ON DELETE CASCADE,
    "resourceType"     TEXT    NOT NULL,
    "bonusLevel"       INT     NOT NULL DEFAULT 0,
    "updatedAt"        TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY ("regionId", "resourceType")
);

-- E.4 Add deep_bonus_cap column to region_resources (if not exists)
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

-- E.5 Additional game_settings for the extraction formula
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

-- E.6 RLS Policies for extraction tables
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


-- ════════════════════════════════════════════════════════════════
-- PART F — Regional Autonomy System
-- Governors, buildings, energy, indices, taxes, extraction
-- ════════════════════════════════════════════════════════════════

-- F.1 Add autonomy columns to regions table
ALTER TABLE regions ADD COLUMN IF NOT EXISTS "isCapital" BOOLEAN DEFAULT FALSE;
ALTER TABLE regions ADD COLUMN IF NOT EXISTS "isAutonomous" BOOLEAN DEFAULT FALSE;
ALTER TABLE regions ADD COLUMN IF NOT EXISTS "isBorderRegion" BOOLEAN DEFAULT FALSE;
ALTER TABLE regions ADD COLUMN IF NOT EXISTS "governorPlayerId" UUID REFERENCES users(id);
ALTER TABLE regions ADD COLUMN IF NOT EXISTS "regionalParliamentEnabled" BOOLEAN DEFAULT FALSE;
ALTER TABLE regions ADD COLUMN IF NOT EXISTS "regionalBudget" BIGINT DEFAULT 0;
ALTER TABLE regions ADD COLUMN IF NOT EXISTS "nationalProfitSharePercent" INT DEFAULT 100;
ALTER TABLE regions ADD COLUMN IF NOT EXISTS "regionalProfitSharePercent" INT DEFAULT 0;
ALTER TABLE regions ADD COLUMN IF NOT EXISTS "workerTaxPercent" INT DEFAULT 10;
ALTER TABLE regions ADD COLUMN IF NOT EXISTS "industryTaxPercent" INT DEFAULT 10;
ALTER TABLE regions ADD COLUMN IF NOT EXISTS "healthIndex" FLOAT DEFAULT 0;
ALTER TABLE regions ADD COLUMN IF NOT EXISTS "militaryIndex" FLOAT DEFAULT 0;
ALTER TABLE regions ADD COLUMN IF NOT EXISTS "educationIndex" FLOAT DEFAULT 0;
ALTER TABLE regions ADD COLUMN IF NOT EXISTS "developmentIndex" FLOAT DEFAULT 0;
ALTER TABLE regions ADD COLUMN IF NOT EXISTS "pollution" INT DEFAULT 0;
ALTER TABLE regions ADD COLUMN IF NOT EXISTS "energyGeneration" FLOAT DEFAULT 0;
ALTER TABLE regions ADD COLUMN IF NOT EXISTS "energyConsumption" FLOAT DEFAULT 0;
ALTER TABLE regions ADD COLUMN IF NOT EXISTS "energyEfficiency" FLOAT DEFAULT 0;
ALTER TABLE regions ADD COLUMN IF NOT EXISTS "dailyExtractionLimitGold" INT DEFAULT 2500;
ALTER TABLE regions ADD COLUMN IF NOT EXISTS "dailyExtractionLimitOil" INT DEFAULT 600;
ALTER TABLE regions ADD COLUMN IF NOT EXISTS "dailyExtractionLimitMinerals" INT DEFAULT 500;
ALTER TABLE regions ADD COLUMN IF NOT EXISTS "dailyExtractionLimitUranium" INT DEFAULT 60;
ALTER TABLE regions ADD COLUMN IF NOT EXISTS "dailyExtractionLimitDiamonds" INT DEFAULT 75;
ALTER TABLE regions ADD COLUMN IF NOT EXISTS "dailyExtractedGold" INT DEFAULT 0;
ALTER TABLE regions ADD COLUMN IF NOT EXISTS "dailyExtractedOil" INT DEFAULT 0;
ALTER TABLE regions ADD COLUMN IF NOT EXISTS "dailyExtractedMinerals" INT DEFAULT 0;
ALTER TABLE regions ADD COLUMN IF NOT EXISTS "dailyExtractedUranium" INT DEFAULT 0;
ALTER TABLE regions ADD COLUMN IF NOT EXISTS "dailyExtractedDiamonds" INT DEFAULT 0;
ALTER TABLE regions ADD COLUMN IF NOT EXISTS "nextExtractionResetAt" TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '1 day');
ALTER TABLE regions ADD COLUMN IF NOT EXISTS "autonomyGrantedAt" TIMESTAMPTZ;
ALTER TABLE regions ADD COLUMN IF NOT EXISTS "autonomyRevokedAt" TIMESTAMPTZ;

-- F.2 Regional buildings table
CREATE TABLE IF NOT EXISTS regional_buildings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "regionId" TEXT NOT NULL REFERENCES regions(id) ON DELETE CASCADE,
    "buildingType" TEXT NOT NULL,
    quantity INT DEFAULT 0,
    level INT DEFAULT 1,
    "createdAt" TIMESTAMPTZ DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE("regionId", "buildingType")
);

-- F.3 Regional parliament members table
CREATE TABLE IF NOT EXISTS regional_parliament_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "regionId" TEXT NOT NULL REFERENCES regions(id) ON DELETE CASCADE,
    "userId" UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    "partyId" UUID,
    "electedAt" TIMESTAMPTZ DEFAULT NOW(),
    "termEndsAt" TIMESTAMPTZ,
    UNIQUE("regionId", "userId")
);

-- F.4 Regional laws table
CREATE TABLE IF NOT EXISTS regional_laws (
    id TEXT PRIMARY KEY,
    "regionId" TEXT NOT NULL REFERENCES regions(id) ON DELETE CASCADE,
    "proposerId" UUID NOT NULL REFERENCES users(id),
    type TEXT NOT NULL,
    params JSONB DEFAULT '{}'::jsonb,
    status TEXT DEFAULT 'pending',
    "createdAt" TIMESTAMPTZ DEFAULT NOW(),
    "expiresAt" TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS regional_law_votes (
    "lawId" TEXT NOT NULL REFERENCES regional_laws(id) ON DELETE CASCADE,
    "voterId" UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    vote TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY ("lawId", "voterId")
);

-- F.5 Regional budget transactions
CREATE TABLE IF NOT EXISTS regional_budget_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "regionId" TEXT NOT NULL REFERENCES regions(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    subtype TEXT,
    "moneyDelta" BIGINT DEFAULT 0,
    description TEXT,
    "createdAt" TIMESTAMPTZ DEFAULT NOW(),
    "createdByUserId" UUID REFERENCES users(id),
    metadata JSONB DEFAULT '{}'::jsonb
);

-- F.6 Autonomy history log
CREATE TABLE IF NOT EXISTS autonomy_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "regionId" TEXT NOT NULL REFERENCES regions(id) ON DELETE CASCADE,
    action TEXT NOT NULL,
    "performedByUserId" UUID REFERENCES users(id),
    details JSONB DEFAULT '{}'::jsonb,
    "createdAt" TIMESTAMPTZ DEFAULT NOW()
);

-- F.7 Indexes for performance
CREATE INDEX IF NOT EXISTS idx_regional_buildings_region ON regional_buildings("regionId");
CREATE INDEX IF NOT EXISTS idx_regional_parliament_region ON regional_parliament_members("regionId");
CREATE INDEX IF NOT EXISTS idx_regional_laws_region ON regional_laws("regionId");
CREATE INDEX IF NOT EXISTS idx_regional_laws_status ON regional_laws(status);
CREATE INDEX IF NOT EXISTS idx_regional_budget_tx_region ON regional_budget_transactions("regionId");
CREATE INDEX IF NOT EXISTS idx_autonomy_history_region ON autonomy_history("regionId");
CREATE INDEX IF NOT EXISTS idx_regions_autonomous ON regions("isAutonomous") WHERE "isAutonomous" = TRUE;
CREATE INDEX IF NOT EXISTS idx_regions_nation ON regions("nation_id");

-- F.8 Row Level Security for regional tables
ALTER TABLE regional_buildings ENABLE ROW LEVEL SECURITY;
ALTER TABLE regional_parliament_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE regional_laws ENABLE ROW LEVEL SECURITY;
ALTER TABLE regional_law_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE regional_budget_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE autonomy_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Regional buildings public read" ON regional_buildings;
DROP POLICY IF EXISTS "Regional buildings server manage" ON regional_buildings;
CREATE POLICY "Regional buildings public read" ON regional_buildings FOR SELECT USING (true);
CREATE POLICY "Regional buildings server manage" ON regional_buildings FOR ALL USING (true);

DROP POLICY IF EXISTS "Regional parliament public read" ON regional_parliament_members;
DROP POLICY IF EXISTS "Regional parliament server manage" ON regional_parliament_members;
CREATE POLICY "Regional parliament public read" ON regional_parliament_members FOR SELECT USING (true);
CREATE POLICY "Regional parliament server manage" ON regional_parliament_members FOR ALL USING (true);

DROP POLICY IF EXISTS "Regional laws public read" ON regional_laws;
DROP POLICY IF EXISTS "Regional laws server manage" ON regional_laws;
CREATE POLICY "Regional laws public read" ON regional_laws FOR SELECT USING (true);
CREATE POLICY "Regional laws server manage" ON regional_laws FOR ALL USING (true);

DROP POLICY IF EXISTS "Regional law votes public read" ON regional_law_votes;
DROP POLICY IF EXISTS "Regional law votes server manage" ON regional_law_votes;
CREATE POLICY "Regional law votes public read" ON regional_law_votes FOR SELECT USING (true);
CREATE POLICY "Regional law votes server manage" ON regional_law_votes FOR ALL USING (true);

DROP POLICY IF EXISTS "Regional budget tx public read" ON regional_budget_transactions;
DROP POLICY IF EXISTS "Regional budget tx server manage" ON regional_budget_transactions;
CREATE POLICY "Regional budget tx public read" ON regional_budget_transactions FOR SELECT USING (true);
CREATE POLICY "Regional budget tx server manage" ON regional_budget_transactions FOR ALL USING (true);

DROP POLICY IF EXISTS "Autonomy history public read" ON autonomy_history;
DROP POLICY IF EXISTS "Autonomy history server manage" ON autonomy_history;
CREATE POLICY "Autonomy history public read" ON autonomy_history FOR SELECT USING (true);
CREATE POLICY "Autonomy history server manage" ON autonomy_history FOR ALL USING (true);


-- ════════════════════════════════════════════════════════════════
-- PART G — Regional Indexes System
-- Progress tracking, classification, and modifier columns
-- ════════════════════════════════════════════════════════════════

-- G.1 Progress columns (0–100 float)
ALTER TABLE regions ADD COLUMN IF NOT EXISTS "healthProgress"      FLOAT DEFAULT 0;
ALTER TABLE regions ADD COLUMN IF NOT EXISTS "militaryProgress"    FLOAT DEFAULT 0;
ALTER TABLE regions ADD COLUMN IF NOT EXISTS "educationProgress"   FLOAT DEFAULT 0;
ALTER TABLE regions ADD COLUMN IF NOT EXISTS "developmentProgress" FLOAT DEFAULT 0;

-- G.2 Regional classification
ALTER TABLE regions ADD COLUMN IF NOT EXISTS "regionalClassification" TEXT DEFAULT 'underdeveloped';

-- G.3 Gameplay modifier columns
ALTER TABLE regions ADD COLUMN IF NOT EXISTS "pollutionModifier" FLOAT DEFAULT 0;
ALTER TABLE regions ADD COLUMN IF NOT EXISTS "warModifier"       FLOAT DEFAULT 0;
ALTER TABLE regions ADD COLUMN IF NOT EXISTS "crisisModifier"    FLOAT DEFAULT 0;

-- G.4 Back-fill classification for existing rows
UPDATE regions
SET "regionalClassification" = CASE
    WHEN "developmentIndex" >= 6 THEN 'developed'
    WHEN "developmentIndex" >= 2 THEN 'developing'
    ELSE 'underdeveloped'
END
WHERE "regionalClassification" = 'underdeveloped';


-- ══════════════════════════════════════════════════════════════════
-- ✅ DONE — All steps 10–16 applied. Your database is up to date.
-- ══════════════════════════════════════════════════════════════════
