-- Migration: Factory Storage Fix
-- Description: Updates execute_factory_work and adds increment_factory_storage to support internal factory warehouse.

-- 1. Update execute_factory_work to use internal storage
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

  -- 2. Deduct Wage from Factory Budget and Add Item to Factory Storage
  UPDATE factories
  SET budget = budget - p_wage,
      currentStorage = COALESCE(currentStorage, 0) + p_output_qty
  WHERE id = p_factory_id;

  -- 3. Update Cooldown
  INSERT INTO user_factory_cooldowns (userId, factoryId, lastUsed)
  VALUES (p_user_id, p_factory_id, NOW())
  ON CONFLICT (userId, factoryId) DO UPDATE SET lastUsed = EXCLUDED.lastUsed;
END;
$$ LANGUAGE plpgsql;

-- 2. Add increment_factory_storage RPC
CREATE OR REPLACE FUNCTION increment_factory_storage(
  p_factory_id UUID,
  p_amount INT
) RETURNS VOID AS $$
BEGIN
  UPDATE factories
  SET currentStorage = COALESCE(currentStorage, 0) + p_amount
  WHERE id = p_factory_id;
END;
$$ LANGUAGE plpgsql;
