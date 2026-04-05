const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || "";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

const supabase = createClient(supabaseUrl, supabaseKey);

const sql = `
-- Fix: create_market_offer
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
  WHERE "userId" = p_user_id::uuid AND "itemId" = p_item_id;

  DELETE FROM user_inventory WHERE "userId" = p_user_id::uuid AND quantity <= 0;

  -- 2. Create Offer
  v_offer_id := encode(gen_random_bytes(6), 'hex');
  INSERT INTO market_offers (id, "sellerId", "sellerName", "itemId", quantity, price, "regionId", "taxRate", "originStateId", "createdAt")
  SELECT v_offer_id, id, username, p_item_id, p_quantity, p_price, p_region_id, p_tax_rate, p_origin_state_id, NOW()
  FROM users WHERE id = p_user_id::uuid;
END;
$$ LANGUAGE plpgsql;

-- Fix: purchase_market_offer
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
  v_tax_amount := floor(v_total_price * (COALESCE(v_offer."taxRate", 10)::float / 100));
  v_net_to_seller := v_total_price - v_tax_amount;

  -- 2. Deduct Funds
  IF p_is_state_buy THEN
    IF NOT EXISTS (SELECT 1 FROM regions WHERE id = p_buyer_state_id AND "ownerUserId" = p_buyer_id::uuid) THEN
      RAISE EXCEPTION 'Non autorizzato a usare i fondi dello Stato';
    END IF;

    UPDATE budgets SET "moneyEUR" = "moneyEUR" - v_total_price
    WHERE "ownerType" = 'REGION' AND "ownerId" = p_buyer_state_id;

    PERFORM add_budget_transaction(
      'REGION', p_buyer_state_id,
      'EXPENSE', 'MARKET_BUY',
      -v_total_price, jsonb_build_object(v_offer."itemId", p_quantity),
      p_buyer_id, jsonb_build_object('offerId', p_offer_id)
    );
  ELSE
    UPDATE users SET money = money - v_total_price WHERE id = p_buyer_id::uuid;

    INSERT INTO user_inventory ("userId", "itemId", quantity)
    VALUES (p_buyer_id::uuid, v_offer."itemId", p_quantity)
    ON CONFLICT ("userId", "itemId") DO UPDATE SET quantity = user_inventory.quantity + EXCLUDED.quantity;
  END IF;

  -- 3. Pay Seller and Region Taxes
  UPDATE users SET money = money + v_net_to_seller WHERE id = v_offer."sellerId";

  PERFORM add_budget_transaction(
    'REGION', v_offer."regionId",
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
  INSERT INTO market_transactions_log (id, "buyerId", "isStateBuy", "sellerId", "itemId", quantity, price, "taxPaid", timestamp)
  VALUES (v_txn_id, p_buyer_id, CASE WHEN p_is_state_buy THEN 1 ELSE 0 END, v_offer."sellerId", v_offer."itemId", p_quantity, v_offer.price, v_tax_amount, EXTRACT(EPOCH FROM NOW()) * 1000);
END;
$$ LANGUAGE plpgsql;
`;

async function applyFix() {
    console.log("Applying SQL fix to Supabase...");
    // Since we don't have a direct 'sql' rpc usually, we'll try to find if there's one.
    // If not, we'll have to ask the user to run it.
    // However, some setups have an 'exec_sql' or similar.
    // Let's assume for this environment we might have a way or we just log it.
    
    // Actually, I'll check if there's a way to run raw SQL.
    // If not, I'll have to provide the SQL to the user.
    
    console.log("SQL to run:");
    console.log(sql);
}

applyFix();
