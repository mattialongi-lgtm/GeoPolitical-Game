-- ==========================================================
-- Migration: Daily Gameplay System
-- Description: Tables for the daily tasks, auto-work farming,
--   daily damage/training, military academy, work streaks,
--   and free reward tracking system.
-- Run AFTER full_schema.sql (or after all previous migrations).
-- Fully idempotent — safe to re-run.
-- ==========================================================

-- ── 1. Daily Auto-Work Settings ──────────────────────────
-- Stores the player's auto-work farming configuration.
CREATE TABLE IF NOT EXISTS daily_auto_work (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  resource_type TEXT NOT NULL DEFAULT 'gold_ore',
  active BOOLEAN NOT NULL DEFAULT false,
  started_at BIGINT,          -- epoch ms
  duration_ms BIGINT NOT NULL DEFAULT 28800000, -- 8 hours default
  estimated_yield NUMERIC DEFAULT 0,
  energy_cost INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- ── 2. Daily Damage Log ──────────────────────────────────
-- Tracks when players send their daily damage and where.
CREATE TABLE IF NOT EXISTS daily_damage_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_type TEXT NOT NULL,   -- 'military_training', 'revolution_defense', 'coup_defense', 'active_event'
  target_id TEXT,              -- optional: event/war ID
  damage_dealt NUMERIC NOT NULL DEFAULT 0,
  xp_gained NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_daily_damage_log_user
  ON daily_damage_log(user_id, created_at DESC);

-- ── 3. Military Academy Claims ───────────────────────────
-- Tracks daily academy build/claim per player.
CREATE TABLE IF NOT EXISTS military_academy_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  region_id TEXT NOT NULL,
  claimed_date DATE NOT NULL DEFAULT CURRENT_DATE,
  rewards JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, claimed_date)
);

-- ── 4. Work Streaks ──────────────────────────────────────
-- Tracks consecutive daily work activity for streak rewards.
CREATE TABLE IF NOT EXISTS work_streaks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  current_streak INTEGER NOT NULL DEFAULT 0,
  longest_streak INTEGER NOT NULL DEFAULT 0,
  last_work_date DATE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- ── 5. Free Reward Claims ────────────────────────────────
-- Tracks all free reward claims from various sources.
CREATE TABLE IF NOT EXISTS free_reward_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source TEXT NOT NULL,        -- 'academy', 'work_medal', 'periodic', 'streak', 'event', 'other'
  source_label TEXT,
  reward_type TEXT NOT NULL,   -- 'energy_bottles', 'gold', 'money', 'xp'
  amount NUMERIC NOT NULL DEFAULT 0,
  claimed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_free_reward_claims_user
  ON free_reward_claims(user_id, claimed_at DESC);

-- ── 6. Daily Task Completions ────────────────────────────
-- Tracks which daily tasks a player has completed each day.
CREATE TABLE IF NOT EXISTS daily_task_completions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  task_id TEXT NOT NULL,
  completed_date DATE NOT NULL DEFAULT CURRENT_DATE,
  completed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, task_id, completed_date)
);

CREATE INDEX IF NOT EXISTS idx_daily_task_completions_user
  ON daily_task_completions(user_id, completed_date);

-- ── 7. Periodic Reward Progress ──────────────────────────
-- Tracks cumulative progress towards periodic rewards.
CREATE TABLE IF NOT EXISTS periodic_reward_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reward_id TEXT NOT NULL,     -- 'periodic-weekly', 'periodic-monthly', etc.
  days_completed INTEGER NOT NULL DEFAULT 0,
  total_days_required INTEGER NOT NULL,
  claimed BOOLEAN NOT NULL DEFAULT false,
  last_counted_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, reward_id)
);

-- ── 8. Streak Milestone Claims ───────────────────────────
-- Tracks which streak milestones have been claimed by each player.
CREATE TABLE IF NOT EXISTS streak_milestone_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  milestone_days INTEGER NOT NULL,
  reward_type TEXT NOT NULL,
  reward_amount NUMERIC NOT NULL DEFAULT 0,
  claimed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, milestone_days)
);

-- ── RPC: Record daily work for streak tracking ───────────
-- Atomically updates the work streak when a player works.
CREATE OR REPLACE FUNCTION record_daily_work(p_user_id UUID)
RETURNS TABLE(new_streak INTEGER, is_new_day BOOLEAN)
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_today DATE := CURRENT_DATE;
  v_row work_streaks%ROWTYPE;
BEGIN
  -- Upsert: create row if not exists
  INSERT INTO work_streaks (user_id, current_streak, longest_streak, last_work_date, updated_at)
  VALUES (p_user_id, 0, 0, NULL, now())
  ON CONFLICT (user_id) DO NOTHING;

  SELECT * INTO v_row FROM work_streaks WHERE user_id = p_user_id FOR UPDATE;

  IF v_row.last_work_date = v_today THEN
    -- Already worked today
    new_streak := v_row.current_streak;
    is_new_day := false;
    RETURN NEXT;
    RETURN;
  END IF;

  IF v_row.last_work_date = v_today - INTERVAL '1 day' THEN
    -- Consecutive day
    UPDATE work_streaks SET
      current_streak = current_streak + 1,
      longest_streak = GREATEST(longest_streak, current_streak + 1),
      last_work_date = v_today,
      updated_at = now()
    WHERE user_id = p_user_id;
  ELSE
    -- Streak broken, start fresh
    UPDATE work_streaks SET
      current_streak = 1,
      longest_streak = GREATEST(longest_streak, 1),
      last_work_date = v_today,
      updated_at = now()
    WHERE user_id = p_user_id;
  END IF;

  SELECT current_streak INTO new_streak FROM work_streaks WHERE user_id = p_user_id;
  is_new_day := true;
  RETURN NEXT;
END;
$$;

-- ── RPC: Claim academy reward ────────────────────────────
-- Atomically claims the daily academy reward if not already claimed today.
CREATE OR REPLACE FUNCTION claim_academy_reward(
  p_user_id UUID,
  p_region_id TEXT,
  p_rewards JSONB DEFAULT '[]'::jsonb
)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_today DATE := CURRENT_DATE;
BEGIN
  INSERT INTO military_academy_claims (user_id, region_id, claimed_date, rewards)
  VALUES (p_user_id, p_region_id, v_today, p_rewards)
  ON CONFLICT (user_id, claimed_date) DO NOTHING;

  -- Returns true if the row was inserted (new claim), false if already claimed
  RETURN FOUND;
END;
$$;
