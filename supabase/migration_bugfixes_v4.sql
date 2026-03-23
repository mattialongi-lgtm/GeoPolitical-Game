-- ══════════════════════════════════════════════════════════════════
-- Migration: Bugfixes V4
-- Non-destructive, idempotent migration
-- Adds: revolution_lobbies table for lobby-based revolution/coup system
-- ══════════════════════════════════════════════════════════════════

-- 1. Revolution Lobbies Table
CREATE TABLE IF NOT EXISTS revolution_lobbies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "regionId" TEXT NOT NULL,
  "lobbyType" TEXT NOT NULL CHECK ("lobbyType" IN ('revolution', 'coup')),
  "creatorId" UUID NOT NULL REFERENCES users(id),
  "participantIds" UUID[] NOT NULL DEFAULT '{}',
  "requiredPlayers" INT NOT NULL DEFAULT 3,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'started', 'expired', 'cancelled')),
  "goldCostPerPlayer" INT NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMPTZ DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ DEFAULT NOW(),
  "expiresAt" TIMESTAMPTZ
);

-- 2. Index for fast lookups by region + status
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_revolution_lobbies_region_status') THEN
    CREATE INDEX idx_revolution_lobbies_region_status ON revolution_lobbies ("regionId", status);
  END IF;
END $$;

-- 3. RLS Policies (using IF NOT EXISTS pattern)
ALTER TABLE revolution_lobbies ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'revolution_lobbies' AND policyname = 'revolution_lobbies_select') THEN
    CREATE POLICY revolution_lobbies_select ON revolution_lobbies FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'revolution_lobbies' AND policyname = 'revolution_lobbies_insert') THEN
    CREATE POLICY revolution_lobbies_insert ON revolution_lobbies FOR INSERT WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'revolution_lobbies' AND policyname = 'revolution_lobbies_update') THEN
    CREATE POLICY revolution_lobbies_update ON revolution_lobbies FOR UPDATE USING (true);
  END IF;
END $$;

-- 4. Ensure factory_upgrade_costs table exists and is populated
CREATE TABLE IF NOT EXISTS factory_upgrade_costs (
  level_to INT PRIMARY KEY,
  upgrade_cost INT NOT NULL,
  aggregate_cost INT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'GOLD',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO factory_upgrade_costs (level_to, upgrade_cost, aggregate_cost, currency)
SELECT
  level,
  CASE WHEN level = 1 THEN 500 ELSE 5 * level END,
  CASE WHEN level = 1 THEN 500
       ELSE 500 + (5 * (level * (level + 1) / 2 - 1))
  END,
  'GOLD'
FROM generate_series(1, 800) AS level
ON CONFLICT (level_to) DO NOTHING;

-- 5. Ensure factory_upgrade_log table exists
CREATE TABLE IF NOT EXISTS factory_upgrade_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  factory_id UUID,
  user_id UUID,
  level_before INT,
  level_after INT,
  gold_cost INT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Ensure upgrade_factory RPC function exists
CREATE OR REPLACE FUNCTION upgrade_factory(
  p_factory_id UUID,
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
  SELECT * INTO v_factory FROM factories WHERE id = p_factory_id FOR UPDATE;
  
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
  FROM factory_upgrade_costs WHERE level_to = v_current_level;
  IF v_current_agg IS NULL THEN v_current_agg := 0; END IF;

  SELECT aggregate_cost INTO v_target_agg
  FROM factory_upgrade_costs WHERE level_to = p_target_level;
  
  IF v_target_agg IS NULL THEN
    RETURN json_build_object('error', 'Livello target non presente nella tabella costi.');
  END IF;

  v_gold_cost := v_target_agg - v_current_agg;

  IF v_gold_cost <= 0 THEN
    RETURN json_build_object('error', 'Costo calcolato non valido.');
  END IF;

  SELECT gold INTO v_user_gold FROM users WHERE id = p_user_id FOR UPDATE;
  
  IF NOT FOUND THEN
    RETURN json_build_object('error', 'Utente non trovato.');
  END IF;

  IF v_user_gold < v_gold_cost THEN
    RETURN json_build_object('error', format('Gold insufficiente. Servono %s Gold, hai %s.', v_gold_cost, FLOOR(v_user_gold)));
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

-- 7. Ensure player_resource_work_experience table exists
CREATE TABLE IF NOT EXISTS player_resource_work_experience (
    "playerId"         UUID    NOT NULL REFERENCES users(id),
    "resourceType"     TEXT    NOT NULL,
    experience       INT     NOT NULL DEFAULT 1,
    "totalExtractions" INT     NOT NULL DEFAULT 0,
    "lastWorkedAt"     TIMESTAMPTZ DEFAULT NULL,
    PRIMARY KEY ("playerId", "resourceType")
);

DO $$ BEGIN
  ALTER TABLE player_resource_work_experience ENABLE ROW LEVEL SECURITY;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'player_resource_work_experience' AND policyname = 'prwe_select') THEN
    CREATE POLICY prwe_select ON player_resource_work_experience FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'player_resource_work_experience' AND policyname = 'prwe_insert') THEN
    CREATE POLICY prwe_insert ON player_resource_work_experience FOR INSERT WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'player_resource_work_experience' AND policyname = 'prwe_update') THEN
    CREATE POLICY prwe_update ON player_resource_work_experience FOR UPDATE USING (true);
  END IF;
END $$;
