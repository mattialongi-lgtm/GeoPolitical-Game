-- Migration: Fix State Donation Bug
-- Ver: 1.1 (Auto-creation of budgets and atomic donation RPC)

-- 1. Update add_budget_transaction to auto-create budgets if missing
CREATE OR REPLACE FUNCTION add_budget_transaction(
  p_owner_type TEXT,
  p_owner_id TEXT,
  p_type TEXT,
  p_subtype TEXT,
  p_money_delta BIGINT,
  p_resources_delta JSONB DEFAULT '{}'::jsonb,
  p_created_by TEXT DEFAULT NULL,
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
  -- 1. Get Budget (or create if missing)
  -- Use FOR UPDATE to prevent race conditions during concurrent creation
  SELECT id, moneyEUR, resources INTO v_budget_id, v_current_money, v_current_resources
  FROM budgets
  WHERE ownerType = p_owner_type AND ownerId = p_owner_id
  FOR UPDATE;

  IF NOT FOUND THEN
    -- Auto-create missing budget
    v_budget_id := gen_random_uuid();
    v_current_money := 0;
    v_current_resources := '{}'::jsonb;
    
    INSERT INTO budgets (id, ownerType, ownerId, moneyEUR, resources, updatedAt)
    VALUES (v_budget_id, p_owner_type, p_owner_id, v_current_money, v_current_resources, (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT)
    ON CONFLICT (ownerType, ownerId) DO UPDATE SET updatedAt = excluded.updatedAt
    RETURNING id, moneyEUR, resources INTO v_budget_id, v_current_money, v_current_resources;
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
  SET moneyEUR = moneyEUR + p_money_delta, 
      resources = v_new_resources, 
      updatedAt = (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT
  WHERE id = v_budget_id;

  -- 5. Log Transaction
  v_tx_id := substr(md5(random()::text || clock_timestamp()::text), 1, 12);
  INSERT INTO budget_transactions (
    id, budgetId, type, subtype, moneyDelta, resourcesDelta, createdAt, createdByUserId, metadata
  ) VALUES (
    v_tx_id, v_budget_id, p_type, p_subtype, p_money_delta, p_resources_delta, 
    (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT, p_created_by, p_metadata
  );

  RETURN v_tx_id;
END;
$$ LANGUAGE plpgsql;

-- 2. New RPC for atomic donation
-- Handles checking user balance, deducting resources, and updating state budget
CREATE OR REPLACE FUNCTION donate_to_state(
  p_user_id UUID,
  p_nation_id TEXT,
  p_type TEXT, -- 'money', 'gold', or resource item id
  p_amount BIGINT
) RETURNS JSONB AS $$
DECLARE
  v_user_money BIGINT;
  v_user_gold BIGINT;
  v_inv_qty BIGINT;
  v_tx_id TEXT;
  v_res_key TEXT;
  v_username TEXT;
BEGIN
  -- Get username for metadata
  SELECT username INTO v_username FROM users WHERE id = p_user_id;

  -- 1. Deduct from User
  IF p_type = 'money' THEN
    UPDATE users SET money = money - p_amount 
    WHERE id = p_user_id AND money >= p_amount
    RETURNING money INTO v_user_money;
    
    IF v_user_money IS NULL THEN RAISE EXCEPTION 'Saldo denaro insufficiente'; END IF;
  
  ELSIF p_type = 'gold' THEN
    UPDATE users SET gold = gold - p_amount 
    WHERE id = p_user_id AND gold >= p_amount
    RETURNING gold INTO v_user_gold;
    
    IF v_user_gold IS NULL THEN RAISE EXCEPTION 'Saldo gold insufficiente'; END IF;
    
  ELSE
    -- Inventory resource
    UPDATE user_inventory SET quantity = quantity - p_amount
    WHERE userId = p_user_id AND itemId = p_type AND quantity >= p_amount
    RETURNING quantity INTO v_inv_qty;
    
    IF v_inv_qty IS NULL THEN RAISE EXCEPTION 'Saldo % insufficiente', p_type; END IF;
    
    -- Cleanup zero inventory
    DELETE FROM user_inventory WHERE userId = p_user_id AND itemId = p_type AND quantity <= 0;
  END IF;

  -- 2. Update State Budget via add_budget_transaction (v2 auto-creates)
  v_res_key := CASE WHEN p_type = 'gold' THEN 'gold_ore' ELSE p_type END;
  
  v_tx_id := add_budget_transaction(
    'STATE',
    p_nation_id,
    'INCOME',
    'DONATION',
    CASE WHEN p_type = 'money' THEN p_amount ELSE 0 END,
    CASE WHEN p_type <> 'money' THEN jsonb_build_object(v_res_key, p_amount) ELSE '{}'::jsonb END,
    p_user_id::TEXT,
    jsonb_build_object('donor', v_username, 'resourceType', p_type)
  );

  -- 3. Sync Nations treasury_balance (for UI display consistency)
  IF p_type = 'money' THEN
     UPDATE nations SET treasury_balance = COALESCE(treasury_balance, 0) + p_amount
     WHERE id = p_nation_id;
  END IF;

  RETURN jsonb_build_object('success', true, 'transactionId', v_tx_id);
END;
$$ LANGUAGE plpgsql;
