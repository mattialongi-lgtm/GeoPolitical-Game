-- RPC: add_budget_transaction
-- Handles atomic budget updates and transaction logging
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
  -- 1. Get Budget
  SELECT id, moneyEUR, resources INTO v_budget_id, v_current_money, v_current_resources
  FROM budgets
  WHERE ownerType = p_owner_type AND ownerId = p_owner_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Budget non trovato per % %', p_owner_type, p_owner_id;
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
      updatedAt = EXTRACT(EPOCH FROM NOW()) * 1000
  WHERE id = v_budget_id;

  -- 5. Log Transaction
  v_tx_id := encode(gen_random_bytes(6), 'hex');
  INSERT INTO budget_transactions (
    id, budgetId, type, subtype, moneyDelta, resourcesDelta, createdAt, createdByUserId, metadata
  ) VALUES (
    v_tx_id, v_budget_id, p_type, p_subtype, p_money_delta, p_resources_delta, 
    EXTRACT(EPOCH FROM NOW()) * 1000, p_created_by, p_metadata
  );

  RETURN v_tx_id;
END;
$$ LANGUAGE plpgsql;

-- RPC: process_work_action
-- Handles energy deduction, earnings, taxes, and cooldowns in one go
CREATE OR REPLACE FUNCTION process_work_action(
  p_user_id TEXT,
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
  INSERT INTO user_factory_cooldowns (user_id, factory_id, last_used)
  VALUES (p_user_id, p_factory_id, NOW())
  ON CONFLICT (user_id, factory_id) DO UPDATE SET last_used = EXCLUDED.last_used;

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
$$ LANGUAGE plpgsql;

-- RPC: add_user_xp (TEXT version delegates to UUID version)
CREATE OR REPLACE FUNCTION add_user_xp(
  p_user_id TEXT,
  p_amount INT
) RETURNS VOID AS $$
BEGIN
  PERFORM add_user_xp(p_user_id::UUID, p_amount);
END;
$$ LANGUAGE plpgsql;

-- TABLE: cooldowns
CREATE TABLE IF NOT EXISTS cooldowns (
  user_id TEXT NOT NULL,
  action_type TEXT NOT NULL,
  last_used TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (user_id, action_type)
);

-- RPC: update_region_stability
CREATE OR REPLACE FUNCTION update_region_stability(
  p_region_id TEXT,
  p_delta INT
) RETURNS VOID AS $$
BEGIN
  UPDATE regions 
  SET stability = LEAST(100, GREATEST(0, stability + p_delta))
  WHERE id = p_region_id;
END;
$$ LANGUAGE plpgsql;

-- RPC: process_invest_action
CREATE OR REPLACE FUNCTION process_invest_action(
  p_region_id TEXT,
  p_stability_delta INT,
  p_pop_delta INT,
  p_economy_delta INT
) RETURNS VOID AS $$
BEGIN
  UPDATE regions 
  SET stability = LEAST(100, stability + p_stability_delta),
      population = population + p_pop_delta,
      economyLevel = LEAST(100, COALESCE(economyLevel, 0) + p_economy_delta)
  WHERE id = p_region_id;
END;
$$ LANGUAGE plpgsql;
-- RPC: get_election_votes_count
CREATE OR REPLACE FUNCTION get_election_votes_count(p_election_id TEXT)
RETURNS TABLE(partyId TEXT, count BIGINT) AS $$
BEGIN
  RETURN QUERY
  SELECT ev.partyId, COUNT(*) as count
  FROM election_votes ev
  WHERE ev.electionId = p_election_id
  GROUP BY ev.partyId;
END;
$$ LANGUAGE plpgsql;


-- RPC: execute_factory_work
-- Handles manual work in player factories
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
  -- 1. Deduct Energy and Add Wage to user
  UPDATE users 
  SET energy = energy - p_energy_cost,
      money = money + p_wage
  WHERE id = p_user_id;

  -- 2. Deduct Wage from Factory Budget and Add Item to Owner Inventory
  UPDATE factories
  SET budget = budget - p_wage
  WHERE id = p_factory_id;

  -- 3. Add item to owner inventory
  INSERT INTO user_inventory (userId, itemId, quantity)
  VALUES (p_owner_id, p_output_item, p_output_qty)
  ON CONFLICT (userId, itemId) DO UPDATE SET quantity = user_inventory.quantity + EXCLUDED.quantity;

  -- 4. Update Cooldown
  INSERT INTO user_factory_cooldowns (userId, factoryId, lastUsed)
  VALUES (p_user_id, p_factory_id, NOW())
  ON CONFLICT (userId, factoryId) DO UPDATE SET lastUsed = EXCLUDED.lastUsed;
END;
$$ LANGUAGE plpgsql;

-- RPC: create_market_offer
CREATE OR REPLACE FUNCTION create_market_offer(
  p_user_id TEXT,
  p_item_id TEXT,
  p_quantity INT,
  p_price BIGINT,
  p_region_id TEXT,
  p_tax_rate INT,
  p_origin_state_id TEXT
) RETURNS VOID AS $$
DECLARE
  v_offer_id TEXT;
BEGIN
  -- 1. Deduct Inventory
  UPDATE user_inventory
  SET quantity = quantity - p_quantity
  WHERE userId = p_user_id AND itemId = p_item_id;

  -- Delete if zero (enforced by application logic usually, but good for safety)
  DELETE FROM user_inventory WHERE userId = p_user_id AND quantity <= 0;

  -- 2. Create Offer
  v_offer_id := encode(gen_random_bytes(6), 'hex');
  INSERT INTO market_offers (id, sellerId, sellerName, itemId, quantity, price, regionId, taxRate, originStateId, createdAt)
  SELECT v_offer_id, id, username, p_item_id, p_quantity, p_price, p_region_id, p_tax_rate, p_origin_state_id, NOW()
  FROM users WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql;

-- RPC: purchase_market_offer
CREATE OR REPLACE FUNCTION purchase_market_offer(
  p_buyer_id TEXT,
  p_offer_id TEXT,
  p_quantity INT,
  p_is_state_buy BOOLEAN,
  p_buyer_state_id TEXT
) RETURNS VOID AS $$
DECLARE
  v_offer RECORD;
  v_total_price BIGINT;
  v_tax_amount BIGINT;
  v_net_to_seller BIGINT;
  v_txn_id TEXT;
BEGIN
  -- 1. Lock and Get Offer
  SELECT * INTO v_offer FROM market_offers WHERE id = p_offer_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Offerta non trovata'; END IF;
  IF v_offer.quantity < p_quantity THEN RAISE EXCEPTION 'Quantità insufficiente'; END IF;

  v_total_price := v_offer.price * p_quantity;
  v_tax_amount := floor(v_total_price * (COALESCE(v_offer.taxRate, 10)::float / 100));
  v_net_to_seller := v_total_price - v_tax_amount;

  -- 2. Deduct Funds
  IF p_is_state_buy THEN
    -- Check if state buyer is leader (logic moved to SQL for speed)
    IF NOT EXISTS (SELECT 1 FROM regions WHERE id = p_buyer_state_id AND ownerUserId = p_buyer_id) THEN
      RAISE EXCEPTION 'Non autorizzato a usare i fondi dello Stato';
    END IF;

    UPDATE budgets SET moneyEUR = moneyEUR - v_total_price
    WHERE ownerType = 'REGION' AND ownerId = p_buyer_state_id;
    
    -- Add to state inventory (budgets resources column)
    PERFORM add_budget_transaction(
      'REGION', p_buyer_state_id,
      'EXPENSE', 'MARKET_BUY',
      -v_total_price, jsonb_build_object(v_offer.itemId, p_quantity),
      p_buyer_id, jsonb_build_object('offerId', p_offer_id)
    );
  ELSE
    UPDATE users SET money = money - v_total_price WHERE id = p_buyer_id;
    
    INSERT INTO user_inventory (userId, itemId, quantity)
    VALUES (p_buyer_id, v_offer.itemId, p_quantity)
    ON CONFLICT (userId, itemId) DO UPDATE SET quantity = user_inventory.quantity + EXCLUDED.quantity;
  END IF;

  -- 3. Pay Seller and Region Taxes
  UPDATE users SET money = money + v_net_to_seller WHERE id = v_offer.sellerId;
  
  PERFORM add_budget_transaction(
    'REGION', v_offer.regionId,
    'INCOME', 'MARKET_TAX',
    v_tax_amount, '{}'::jsonb,
    p_buyer_id, jsonb_build_object('offerId', p_offer_id)
  );

  -- 4. Update/Delete Offer
  IF v_offer.quantity = p_quantity THEN
    DELETE FROM market_offers WHERE id = p_offer_id;
  ELSE
    UPDATE market_offers SET quantity = quantity - p_quantity WHERE id = p_offer_id;
  END IF;

  -- 5. Log Transaction
  v_txn_id := encode(gen_random_bytes(6), 'hex');
  INSERT INTO market_transactions_log (id, buyerId, isStateBuy, sellerId, itemId, quantity, price, taxPaid, timestamp)
  VALUES (v_txn_id, p_buyer_id, CASE WHEN p_is_state_buy THEN 1 ELSE 0 END, v_offer.sellerId, v_offer.itemId, p_quantity, v_offer.price, v_tax_amount, EXTRACT(EPOCH FROM NOW()) * 1000);
END;
$$ LANGUAGE plpgsql;
