-- Migration: Chat channel support, XP formula fix
-- Run this on your Supabase SQL Editor

-- 1. Add 'channel' column to chat_messages for global/local chat
ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS channel TEXT DEFAULT 'global';

-- Backfill existing messages as 'global'
UPDATE chat_messages SET channel = 'global' WHERE channel IS NULL;

-- 2. Fix add_user_xp RPC to match frontend formula: LEVEL_UP_BASE_XP * LEVEL_UP_FACTOR^(level-1)
-- Frontend uses: LEVEL_UP_BASE_XP = 100, LEVEL_UP_FACTOR = 1.5
-- XP resets on level up (carry-over excess)
CREATE OR REPLACE FUNCTION add_user_xp(
  p_user_id UUID,
  p_amount INT
) RETURNS VOID AS $$
DECLARE
  v_current_xp INT;
  v_current_level INT;
  v_next_level_xp INT;
BEGIN
  UPDATE users 
  SET xp = xp + p_amount
  WHERE id = p_user_id
  RETURNING xp, level INTO v_current_xp, v_current_level;

  -- Formula matches frontend: 100 * 1.5^(level-1)
  v_next_level_xp := FLOOR(100 * POWER(1.5, v_current_level - 1));
  
  -- Level up loop (handles multiple level ups from large XP gains)
  WHILE v_current_xp >= v_next_level_xp LOOP
    v_current_xp := v_current_xp - v_next_level_xp;
    v_current_level := v_current_level + 1;
    v_next_level_xp := FLOOR(100 * POWER(1.5, v_current_level - 1));
  END LOOP;
  
  UPDATE users SET xp = v_current_xp, level = v_current_level WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql;

-- 3. Also support TEXT-typed user id for compatibility (delegates to UUID version)
CREATE OR REPLACE FUNCTION add_user_xp(
  p_user_id TEXT,
  p_amount INT
) RETURNS VOID AS $$
BEGIN
  PERFORM add_user_xp(p_user_id::UUID, p_amount);
END;
$$ LANGUAGE plpgsql;
