-- ============================================================
-- FACTORY SYSTEM V3 - Fill missing columns, RPCs and tables
-- ============================================================
-- This migration ensures all objects needed by the factory v2
-- backend code actually exist in the database.  It is fully
-- idempotent and safe to run multiple times.
--
-- What it adds / ensures:
--   1. Missing columns on "factories": energyCost, payoutMoney, minLevel
--   2. General-purpose "cooldowns" table (used for propaganda, etc.)
--   3. "budgets" + "budget_transactions" tables (dependency of RPCs)
--   4. add_budget_transaction() RPC
--   5. process_work_action() RPC
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ═══════════════════════════════════════════════════════════
-- 1. Missing columns on factories table
-- ═══════════════════════════════════════════════════════════

ALTER TABLE factories ADD COLUMN IF NOT EXISTS "energyCost" INT DEFAULT 10;
ALTER TABLE factories ADD COLUMN IF NOT EXISTS "payoutMoney" BIGINT DEFAULT 50;
ALTER TABLE factories ADD COLUMN IF NOT EXISTS "minLevel" INT DEFAULT 1;

-- Back-fill: set payoutMoney = wage for any rows that already exist
-- (so existing salary-mode factories keep the wage they already have)
UPDATE factories SET "payoutMoney" = wage WHERE "payoutMoney" = 50 AND wage <> 50;

-- ═══════════════════════════════════════════════════════════
-- 2. General-purpose cooldowns table
--    (propaganda, invest, and other non-factory actions)
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS cooldowns (
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    action_type TEXT,
    last_used TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (user_id, action_type)
);

-- ═══════════════════════════════════════════════════════════
-- 3. Budget tables (dependency for add_budget_transaction)
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS budgets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "ownerType" TEXT NOT NULL,           -- 'REGION', 'STATE', etc.
    "ownerId" TEXT NOT NULL,
    "moneyEUR" BIGINT DEFAULT 0,
    resources JSONB DEFAULT '{}'::jsonb,
    "updatedAt" BIGINT DEFAULT 0,
    UNIQUE("ownerType", "ownerId")
);

CREATE TABLE IF NOT EXISTS budget_transactions (
    id TEXT PRIMARY KEY,
    "budgetId" UUID REFERENCES budgets(id) ON DELETE CASCADE,
    type TEXT NOT NULL,                  -- 'INCOME', 'EXPENSE'
    subtype TEXT NOT NULL,               -- 'TAX', 'RESOURCE_TAX', etc.
    "moneyDelta" BIGINT DEFAULT 0,
    "resourcesDelta" JSONB DEFAULT '{}'::jsonb,
    "createdAt" BIGINT DEFAULT 0,
    "createdByUserId" UUID REFERENCES users(id),
    metadata JSONB DEFAULT '{}'::jsonb
);

-- ═══════════════════════════════════════════════════════════
-- 4. add_budget_transaction() RPC
-- ═══════════════════════════════════════════════════════════

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
  -- 1. Get Budget
  SELECT id, "moneyEUR", resources INTO v_budget_id, v_current_money, v_current_resources
  FROM budgets
  WHERE "ownerType" = p_owner_type AND "ownerId" = p_owner_id;

  IF NOT FOUND THEN
    -- Auto-create budget for the owner if it does not exist yet
    INSERT INTO budgets ("ownerType", "ownerId", "moneyEUR", resources, "updatedAt")
    VALUES (p_owner_type, p_owner_id, 0, '{}'::jsonb, EXTRACT(EPOCH FROM NOW()) * 1000)
    RETURNING id, "moneyEUR", resources INTO v_budget_id, v_current_money, v_current_resources;
  END IF;

  -- 2. Check Money
  IF v_current_money + p_money_delta < 0 THEN
    RAISE EXCEPTION 'Fondi insufficienti';
  END IF;

  -- 3. Update Resources
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

  -- 4. Apply Updates
  UPDATE budgets
  SET "moneyEUR" = "moneyEUR" + p_money_delta,
      resources = v_new_resources,
      "updatedAt" = EXTRACT(EPOCH FROM NOW()) * 1000
  WHERE id = v_budget_id;

  -- 5. Log Transaction
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

-- ═══════════════════════════════════════════════════════════
-- 5. process_work_action() RPC
--    Atomically deducts energy, adds earnings, updates
--    cooldown, and logs taxes for salary-mode work.
-- ═══════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION process_work_action(
  p_user_id UUID,
  p_factory_id UUID,
  p_energy_cost INT,
  p_net_earnings BIGINT,
  p_taxes BIGINT,
  p_region_id TEXT
) RETURNS VOID AS $$
BEGIN
  -- 1. Deduct Energy and Add Money
  UPDATE users
  SET energy = energy - p_energy_cost,
      money = money + p_net_earnings
  WHERE id = p_user_id;

  -- 2. Update Cooldown
  INSERT INTO user_factory_cooldowns ("userId", "factoryId", "lastUsed")
  VALUES (p_user_id, p_factory_id, NOW())
  ON CONFLICT ("userId", "factoryId") DO UPDATE SET "lastUsed" = EXCLUDED."lastUsed";

  -- 3. Apply Taxes if any
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

-- ═══════════════════════════════════════════════════════════
-- 6. Atomic factory counter increment RPC
--    Prevents race conditions when multiple workers work
--    the same factory simultaneously.
-- ═══════════════════════════════════════════════════════════

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
