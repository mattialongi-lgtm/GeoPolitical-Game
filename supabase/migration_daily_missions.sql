-- =====================================================================
-- Daily Missions System – Supabase Migration
-- NON-DESTRUCTIVE: Uses IF NOT EXISTS / CREATE OR REPLACE throughout
-- =====================================================================

-- 1. daily_missions table
--    Stores each player's assigned missions per day.
CREATE TABLE IF NOT EXISTS daily_missions (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id       UUID NOT NULL,
  mission_key   TEXT NOT NULL,
  title         TEXT NOT NULL,
  description   TEXT NOT NULL,
  category      TEXT NOT NULL CHECK (category IN ('work','military','politics','construction','engagement')),
  icon          TEXT NOT NULL DEFAULT '📋',
  target        INTEGER NOT NULL DEFAULT 1,
  progress      INTEGER NOT NULL DEFAULT 0,
  status        TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','completed','claimed')),
  reward        JSONB NOT NULL DEFAULT '{}',
  route         TEXT,
  reset_date    DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Unique constraint: one mission_key per user per day
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'uq_daily_missions_user_key_date'
  ) THEN
    ALTER TABLE daily_missions ADD CONSTRAINT uq_daily_missions_user_key_date
      UNIQUE (user_id, mission_key, reset_date);
  END IF;
END $$;

-- Index for fast lookups by user + date
CREATE INDEX IF NOT EXISTS idx_daily_missions_user_date
  ON daily_missions (user_id, reset_date);

-- 2. daily_mission_bonus_claims table
--    Tracks per-day bonus claims for completing all missions.
CREATE TABLE IF NOT EXISTS daily_mission_bonus_claims (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID NOT NULL,
  claim_date  DATE NOT NULL DEFAULT CURRENT_DATE,
  reward      JSONB NOT NULL DEFAULT '{}',
  claimed_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'uq_daily_bonus_user_date'
  ) THEN
    ALTER TABLE daily_mission_bonus_claims ADD CONSTRAINT uq_daily_bonus_user_date
      UNIQUE (user_id, claim_date);
  END IF;
END $$;

-- 3. RPC: Update mission progress atomically
--    Returns the updated row (or null if not found).
CREATE OR REPLACE FUNCTION update_mission_progress(
  p_user_id     UUID,
  p_mission_key TEXT,
  p_reset_date  DATE,
  p_increment   INTEGER DEFAULT 1
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_row daily_missions%ROWTYPE;
  v_new_progress INTEGER;
  v_new_status TEXT;
BEGIN
  -- Lock the specific row
  SELECT * INTO v_row
  FROM daily_missions
  WHERE user_id = p_user_id
    AND mission_key = p_mission_key
    AND reset_date = p_reset_date
    AND status = 'active'
  FOR UPDATE;

  IF v_row IS NULL THEN
    RETURN NULL;
  END IF;

  v_new_progress := LEAST(v_row.progress + p_increment, v_row.target);
  v_new_status := CASE WHEN v_new_progress >= v_row.target THEN 'completed' ELSE 'active' END;

  UPDATE daily_missions
  SET progress   = v_new_progress,
      status     = v_new_status,
      updated_at = now()
  WHERE id = v_row.id;

  RETURN jsonb_build_object(
    'id', v_row.id,
    'mission_key', v_row.mission_key,
    'progress', v_new_progress,
    'target', v_row.target,
    'status', v_new_status,
    'reward', v_row.reward
  );
END;
$$;

-- 4. RPC: Claim a completed mission reward atomically
CREATE OR REPLACE FUNCTION claim_mission_reward(
  p_user_id    UUID,
  p_mission_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_row daily_missions%ROWTYPE;
  v_reward JSONB;
  v_money NUMERIC;
  v_gold  NUMERIC;
  v_xp    NUMERIC;
BEGIN
  SELECT * INTO v_row
  FROM daily_missions
  WHERE id = p_mission_id
    AND user_id = p_user_id
    AND status = 'completed'
  FOR UPDATE;

  IF v_row IS NULL THEN
    RETURN jsonb_build_object('error', 'Missione non trovata o non completata');
  END IF;

  v_reward := v_row.reward;
  v_money := COALESCE((v_reward->>'money')::NUMERIC, 0);
  v_gold  := COALESCE((v_reward->>'gold')::NUMERIC, 0);
  v_xp    := COALESCE((v_reward->>'xp')::NUMERIC, 0);

  -- Mark as claimed
  UPDATE daily_missions
  SET status = 'claimed', updated_at = now()
  WHERE id = v_row.id;

  -- Grant rewards
  UPDATE users
  SET money = money + v_money,
      gold  = gold  + v_gold,
      xp    = xp    + v_xp
  WHERE id = p_user_id;

  RETURN jsonb_build_object(
    'success', true,
    'mission_key', v_row.mission_key,
    'reward', v_reward
  );
END;
$$;

-- 5. RLS Policies (safe idempotent pattern)
ALTER TABLE daily_missions ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_mission_bonus_claims ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'daily_missions' AND policyname = 'daily_missions_select_own') THEN
    CREATE POLICY daily_missions_select_own ON daily_missions FOR SELECT USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'daily_missions' AND policyname = 'daily_missions_insert_own') THEN
    CREATE POLICY daily_missions_insert_own ON daily_missions FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'daily_missions' AND policyname = 'daily_missions_update_own') THEN
    CREATE POLICY daily_missions_update_own ON daily_missions FOR UPDATE USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'daily_mission_bonus_claims' AND policyname = 'daily_bonus_select_own') THEN
    CREATE POLICY daily_bonus_select_own ON daily_mission_bonus_claims FOR SELECT USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'daily_mission_bonus_claims' AND policyname = 'daily_bonus_insert_own') THEN
    CREATE POLICY daily_bonus_insert_own ON daily_mission_bonus_claims FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;
