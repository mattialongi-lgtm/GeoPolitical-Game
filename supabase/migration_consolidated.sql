-- ============================================================
-- CONSOLIDATED MIGRATION: Factory Upgrade System + Security Fixes
-- Run this file on Supabase to apply all changes at once.
-- ============================================================

-- ============================================================
-- PART 1: Factory Upgrade Costs System
-- ============================================================

-- 1.1 Factory Upgrade Costs lookup table
CREATE TABLE IF NOT EXISTS factory_upgrade_costs (
  level_to INT PRIMARY KEY,
  upgrade_cost INT NOT NULL,
  aggregate_cost INT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'GOLD',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 1.2 Seed data for levels 1..800
-- Level 1: upgrade_cost = 500 (initial build cost)
-- Levels 2-800: upgrade_cost = 5 * level
-- aggregate_cost = cumulative sum
INSERT INTO factory_upgrade_costs (level_to, upgrade_cost, aggregate_cost, currency)
SELECT
  level,
  CASE WHEN level = 1 THEN 500 ELSE 5 * level END,
  CASE WHEN level = 1 THEN 500 ELSE 495 + (5 * level * (level + 1)) / 2 END,
  'GOLD'
FROM generate_series(1, 800) AS level
ON CONFLICT (level_to) DO NOTHING;

-- 1.3 Factory Upgrade Log table
CREATE TABLE IF NOT EXISTS factory_upgrade_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  factory_id TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES users(id),
  level_before INT NOT NULL,
  level_after INT NOT NULL,
  gold_cost INT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 1.4 Indexes
CREATE INDEX IF NOT EXISTS idx_factory_upgrade_log_factory ON factory_upgrade_log(factory_id);
CREATE INDEX IF NOT EXISTS idx_factory_upgrade_log_user ON factory_upgrade_log(user_id);
CREATE INDEX IF NOT EXISTS idx_factory_upgrade_costs_currency ON factory_upgrade_costs(currency);

-- 1.5 RLS Policies
ALTER TABLE factory_upgrade_costs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read factory upgrade costs" ON factory_upgrade_costs;
CREATE POLICY "Anyone can read factory upgrade costs"
  ON factory_upgrade_costs FOR SELECT USING (true);

ALTER TABLE factory_upgrade_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own upgrade logs" ON factory_upgrade_log;
CREATE POLICY "Users can read own upgrade logs"
  ON factory_upgrade_log FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service role can insert upgrade logs" ON factory_upgrade_log;
CREATE POLICY "Service role can insert upgrade logs"
  ON factory_upgrade_log FOR INSERT WITH CHECK (true);

-- 1.6 Transactional RPC: upgrade_factory
CREATE OR REPLACE FUNCTION upgrade_factory(
  p_factory_id TEXT,
  p_target_level INT,
  p_user_id UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_factory RECORD;
  v_current_level INT;
  v_current_agg INT;
  v_target_agg INT;
  v_gold_cost INT;
  v_user_gold NUMERIC;
BEGIN
  SELECT * INTO v_factory
  FROM factories
  WHERE id = p_factory_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('error', 'Fabbrica non trovata.');
  END IF;

  IF v_factory."ownerUserId" != p_user_id THEN
    RETURN json_build_object('error', 'Non sei il proprietario di questa fabbrica.');
  END IF;

  v_current_level := COALESCE(v_factory.level, 1);

  IF p_target_level <= v_current_level THEN
    RETURN json_build_object('error', 'Il livello target deve essere maggiore di quello attuale.');
  END IF;

  IF p_target_level > 800 THEN
    RETURN json_build_object('error', 'Il livello massimo è 800.');
  END IF;

  SELECT aggregate_cost INTO v_current_agg
  FROM factory_upgrade_costs
  WHERE level_to = v_current_level;

  IF v_current_agg IS NULL THEN
    v_current_agg := 0;
  END IF;

  SELECT aggregate_cost INTO v_target_agg
  FROM factory_upgrade_costs
  WHERE level_to = p_target_level;

  IF v_target_agg IS NULL THEN
    RETURN json_build_object('error', 'Livello target non presente nella tabella costi.');
  END IF;

  v_gold_cost := v_target_agg - v_current_agg;

  IF v_gold_cost <= 0 THEN
    RETURN json_build_object('error', 'Costo calcolato non valido.');
  END IF;

  SELECT gold INTO v_user_gold
  FROM users
  WHERE id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('error', 'Utente non trovato.');
  END IF;

  IF v_user_gold < v_gold_cost THEN
    RETURN json_build_object('error',
      format('Gold insufficiente. Servono %s Gold, hai %s.', v_gold_cost, FLOOR(v_user_gold)));
  END IF;

  UPDATE users SET gold = gold - v_gold_cost WHERE id = p_user_id;
  UPDATE factories SET level = p_target_level WHERE id = p_factory_id;

  INSERT INTO factory_upgrade_log (factory_id, user_id, level_before, level_after, gold_cost)
  VALUES (p_factory_id, p_user_id, v_current_level, p_target_level, v_gold_cost);

  RETURN json_build_object(
    'success', true,
    'levelBefore', v_current_level,
    'levelAfter', p_target_level,
    'goldCost', v_gold_cost
  );
END;
$$;

-- ============================================================
-- PART 2: Security Fixes
-- ============================================================

-- 2.1 CHECK constraints to prevent negative balances
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_gold_non_negative'
  ) THEN
    ALTER TABLE users ADD CONSTRAINT users_gold_non_negative CHECK (gold >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_money_non_negative'
  ) THEN
    ALTER TABLE users ADD CONSTRAINT users_money_non_negative CHECK (money >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_energy_non_negative'
  ) THEN
    ALTER TABLE users ADD CONSTRAINT users_energy_non_negative CHECK (energy >= 0);
  END IF;
END $$;

-- 2.2 Atomic safe deduction RPC
CREATE OR REPLACE FUNCTION safe_deduct_currency(
  p_user_id UUID,
  p_money_cost NUMERIC DEFAULT 0,
  p_gold_cost NUMERIC DEFAULT 0,
  p_energy_cost NUMERIC DEFAULT 0
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_rows_affected INT;
  v_user RECORD;
BEGIN
  UPDATE users
  SET
    money = money - p_money_cost,
    gold = gold - p_gold_cost,
    energy = energy - p_energy_cost
  WHERE id = p_user_id
    AND money >= p_money_cost
    AND gold >= p_gold_cost
    AND energy >= p_energy_cost;

  GET DIAGNOSTICS v_rows_affected = ROW_COUNT;

  IF v_rows_affected = 0 THEN
    SELECT money, gold, energy INTO v_user FROM users WHERE id = p_user_id;
    IF v_user IS NULL THEN
      RETURN json_build_object('error', 'Utente non trovato.');
    END IF;
    IF v_user.money < p_money_cost THEN
      RETURN json_build_object('error', format('Fondi insufficienti. Servono $%s, hai $%s.', p_money_cost, v_user.money));
    END IF;
    IF v_user.gold < p_gold_cost THEN
      RETURN json_build_object('error', format('Gold insufficiente. Servono %s Gold, hai %s.', p_gold_cost, v_user.gold));
    END IF;
    IF v_user.energy < p_energy_cost THEN
      RETURN json_build_object('error', format('Energia insufficiente. Servono %s, hai %s.', p_energy_cost, v_user.energy));
    END IF;
    RETURN json_build_object('error', 'Fondi insufficienti.');
  END IF;

  SELECT money, gold, energy INTO v_user FROM users WHERE id = p_user_id;

  RETURN json_build_object(
    'success', true,
    'money', v_user.money,
    'gold', v_user.gold,
    'energy', v_user.energy
  );
END;
$$;

-- 2.3 Inventory and factory budget constraints
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'user_inventory_quantity_non_negative'
  ) THEN
    BEGIN
      ALTER TABLE user_inventory ADD CONSTRAINT user_inventory_quantity_non_negative CHECK (quantity >= 0);
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'factories_budget_non_negative'
  ) THEN
    BEGIN
      ALTER TABLE factories ADD CONSTRAINT factories_budget_non_negative CHECK (budget >= 0);
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END IF;
END $$;
