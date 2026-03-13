-- ============================================================
-- Migration: Security fixes - CHECK constraints and safe deduction RPC
-- Prevents currency going negative via race conditions
-- ============================================================

-- 1. Add CHECK constraints to prevent negative balances
-- These will cause any UPDATE that would make gold/money negative to fail,
-- effectively preventing double-spend race conditions.
DO $$
BEGIN
  -- Add CHECK constraint for gold >= 0 (if not exists)
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'users_gold_non_negative'
  ) THEN
    ALTER TABLE users ADD CONSTRAINT users_gold_non_negative CHECK (gold >= 0);
  END IF;

  -- Add CHECK constraint for money >= 0 (if not exists)
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'users_money_non_negative'
  ) THEN
    ALTER TABLE users ADD CONSTRAINT users_money_non_negative CHECK (money >= 0);
  END IF;

  -- Add CHECK constraint for energy >= 0 (if not exists)
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'users_energy_non_negative'
  ) THEN
    ALTER TABLE users ADD CONSTRAINT users_energy_non_negative CHECK (energy >= 0);
  END IF;
END $$;

-- 2. Safe deduction RPC: atomically deducts currency, returns error if insufficient
-- This prevents all race conditions by using a single atomic UPDATE with WHERE clause
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
  -- Atomic update: only succeeds if user has enough of each currency
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
    -- Check which resource is insufficient
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

  -- Return updated balances
  SELECT money, gold, energy INTO v_user FROM users WHERE id = p_user_id;

  RETURN json_build_object(
    'success', true,
    'money', v_user.money,
    'gold', v_user.gold,
    'energy', v_user.energy
  );
END;
$$;

-- 3. Add CHECK constraint on user_inventory quantity >= 0
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'user_inventory_quantity_non_negative'
  ) THEN
    BEGIN
      ALTER TABLE user_inventory ADD CONSTRAINT user_inventory_quantity_non_negative CHECK (quantity >= 0);
    EXCEPTION WHEN OTHERS THEN
      -- Table might not exist yet or constraint might already exist under different name
      NULL;
    END;
  END IF;
END $$;

-- 4. Add CHECK constraint on factory budget >= 0
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'factories_budget_non_negative'
  ) THEN
    BEGIN
      ALTER TABLE factories ADD CONSTRAINT factories_budget_non_negative CHECK (budget >= 0);
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END IF;
END $$;
