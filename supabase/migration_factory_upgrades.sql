-- ============================================================
-- Migration: Factory Upgrade Costs System
-- Tables: factory_upgrade_costs, factory_upgrade_log
-- RPC: upgrade_factory(p_factory_id, p_target_level, p_user_id)
-- ============================================================

-- 1. Factory Upgrade Costs lookup table
CREATE TABLE IF NOT EXISTS factory_upgrade_costs (
  level_to INT PRIMARY KEY,
  upgrade_cost INT NOT NULL,
  aggregate_cost INT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'GOLD',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Seed data for levels 1..800
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

CREATE TABLE IF NOT EXISTS factory_upgrade_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  factory_id UUID NOT NULL REFERENCES factories(id),
  user_id UUID NOT NULL REFERENCES users(id),
  level_before INT NOT NULL,
  level_after INT NOT NULL,
  gold_cost INT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Align legacy column type (text -> uuid) when upgrading existing databases
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'factory_upgrade_log'
      AND column_name = 'factory_id'
      AND data_type <> 'uuid'
  ) THEN
    ALTER TABLE factory_upgrade_log
      ALTER COLUMN factory_id TYPE UUID USING factory_id::uuid;
  END IF;
END $$;

-- 4. Indexes
CREATE INDEX IF NOT EXISTS idx_factory_upgrade_log_factory ON factory_upgrade_log(factory_id);
CREATE INDEX IF NOT EXISTS idx_factory_upgrade_log_user ON factory_upgrade_log(user_id);
CREATE INDEX IF NOT EXISTS idx_factory_upgrade_costs_currency ON factory_upgrade_costs(currency);

-- 5. RLS Policies
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

-- Atomically validates ownership, checks cost, deducts gold, upgrades level, logs event
CREATE OR REPLACE FUNCTION upgrade_factory(
  p_factory_id UUID,
  p_target_level INT,
  p_user_id UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_factory RECORD;
  v_current_level INT;
  v_current_agg INT;
  v_target_agg INT;
  v_gold_cost INT;
  v_user_gold NUMERIC;
BEGIN
  -- Lock factory row to prevent concurrent upgrades
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

  -- Get aggregate costs from lookup table
  SELECT aggregate_cost INTO v_current_agg
  FROM factory_upgrade_costs
  WHERE level_to = v_current_level;

  -- If current level not in table (e.g. level 0), treat as 0 cost
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

  -- Lock user row and check gold
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

  -- Deduct gold atomically
  UPDATE users SET gold = gold - v_gold_cost WHERE id = p_user_id;

  -- Upgrade factory level
  UPDATE factories SET level = p_target_level WHERE id = p_factory_id;

  -- Log the upgrade event
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
