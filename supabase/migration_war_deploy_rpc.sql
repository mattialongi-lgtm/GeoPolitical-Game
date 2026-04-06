-- ============================================================
-- Migration: rpc_war_deploy — Atomic war deploy function
-- Scope: Replaces 4 independent DB writes (users, wars,
--        war_participants, action_logs) with a single
--        atomic transaction.
-- Idempotent: CREATE OR REPLACE, IF NOT EXISTS throughout.
-- ============================================================

-- 1. Index for war_participants lookups (idempotent)
CREATE INDEX IF NOT EXISTS idx_war_participants_war_user
  ON war_participants("warId", "userId");

-- 2. Atomic war deploy function
CREATE OR REPLACE FUNCTION rpc_war_deploy(
  p_user_id     UUID,
  p_war_id      UUID,
  p_side        TEXT,        -- 'attacker' | 'defender'
  p_weapon_id   TEXT,        -- 'infantry' | 'tank' | 'airstrike' | 'battleship'
  p_energy_cost INT,
  p_money_cost  NUMERIC,
  p_damage      INT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user       RECORD;
  v_war        RECORD;
  v_new_score  INT;
BEGIN
  -- 1. Lock user row + verify balance
  SELECT id, energy, money INTO v_user
  FROM users
  WHERE id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('error', 'Utente non trovato.');
  END IF;

  IF v_user.energy < p_energy_cost THEN
    RETURN json_build_object('error',
      format('Energia insufficiente. Servono %s, hai %s.', p_energy_cost, v_user.energy));
  END IF;

  IF v_user.money < p_money_cost THEN
    RETURN json_build_object('error',
      format('Fondi insufficienti. Servono $%s, hai $%s.', p_money_cost, v_user.money));
  END IF;

  -- 2. Lock war row + verify active
  SELECT id, status, "attackerScore", "defenderScore"
  INTO v_war
  FROM wars
  WHERE id = p_war_id
  FOR UPDATE;

  IF NOT FOUND OR v_war.status != 'active' THEN
    RETURN json_build_object('error', 'Guerra non trovata o non attiva.');
  END IF;

  -- 3. Atomic deduct energy + money
  UPDATE users
  SET energy = energy - p_energy_cost,
      money  = money  - p_money_cost
  WHERE id = p_user_id;

  -- 4. Atomic increment war score
  IF p_side = 'attacker' THEN
    UPDATE wars
    SET "attackerScore" = "attackerScore" + p_damage,
        "updatedAt"     = NOW()
    WHERE id = p_war_id;
    v_new_score := v_war."attackerScore" + p_damage;
  ELSE
    UPDATE wars
    SET "defenderScore" = "defenderScore" + p_damage,
        "updatedAt"     = NOW()
    WHERE id = p_war_id;
    v_new_score := v_war."defenderScore" + p_damage;
  END IF;

  -- 5. Upsert war_participants (damage tracking)
  INSERT INTO war_participants ("warId", "userId", side, "totalDamage")
  VALUES (p_war_id, p_user_id, p_side, p_damage)
  ON CONFLICT ("warId", "userId")
  DO UPDATE SET
    "totalDamage" = war_participants."totalDamage" + p_damage;

  -- 6. Insert action log
  INSERT INTO action_logs ("userId", action, details, "createdAt")
  VALUES (
    p_user_id,
    'WAR_DEPLOY',
    json_build_object(
      'warId',    p_war_id,
      'side',     p_side,
      'weaponId', p_weapon_id,
      'damage',   p_damage,
      'cost',     json_build_object('energy', p_energy_cost, 'money', p_money_cost)
    ),
    NOW()
  );

  -- 7. Return success with updated balances
  RETURN json_build_object(
    'success',   true,
    'damage',    p_damage,
    'newScore',  v_new_score,
    'energy',    v_user.energy - p_energy_cost,
    'money',     v_user.money  - p_money_cost
  );
END;
$$;

-- 3. Security: restrict execution to service_role only
REVOKE EXECUTE ON FUNCTION rpc_war_deploy FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION rpc_war_deploy TO service_role;
