-- Atomic war deploy RPC (source of truth for deploy writes)
CREATE OR REPLACE FUNCTION public.rpc_war_deploy(
  p_war_id TEXT,
  p_user_id UUID,
  p_side TEXT,
  p_troop_type TEXT,
  p_quantity INTEGER,
  p_energy_cost INTEGER,
  p_money_cost BIGINT,
  p_base_damage BIGINT,
  p_final_damage BIGINT,
  p_bonuses JSONB DEFAULT '{}'::JSONB,
  p_update_field TEXT DEFAULT 'attackerScore',
  p_action_details JSONB DEFAULT '{}'::JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now TIMESTAMPTZ := NOW();
  v_user users%ROWTYPE;
  v_war wars%ROWTYPE;
  v_participant war_participants%ROWTYPE;
  v_existing_troops JSONB;
  v_new_troop_qty INTEGER;
  v_updated_score BIGINT;
BEGIN
  IF p_war_id IS NULL OR p_user_id IS NULL OR p_side IS NULL OR p_troop_type IS NULL THEN
    RETURN jsonb_build_object('error', 'Dati mancanti.');
  END IF;

  IF p_side NOT IN ('attacker', 'defender') THEN
    RETURN jsonb_build_object('error', 'Lato di guerra non valido.');
  END IF;

  IF p_quantity IS NULL OR p_quantity <= 0 THEN
    RETURN jsonb_build_object('error', 'Quantità non valida.');
  END IF;

  IF p_energy_cost < 0 OR p_money_cost < 0 THEN
    RETURN jsonb_build_object('error', 'Costi non validi.');
  END IF;

  IF p_update_field NOT IN ('attackerScore', 'defenderScore', 'phase1AttackerScore', 'phase1DefenderScore') THEN
    RETURN jsonb_build_object('error', 'Campo score non valido.');
  END IF;

  SELECT * INTO v_user
  FROM users
  WHERE id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Utente non trovato.');
  END IF;

  SELECT * INTO v_war
  FROM wars
  WHERE id = p_war_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Guerra inesistente.');
  END IF;

  IF v_war.status <> 'active' THEN
    RETURN jsonb_build_object('error', 'Questa guerra è già terminata.');
  END IF;

  IF COALESCE(v_user.energy, 0) < p_energy_cost THEN
    RETURN jsonb_build_object('error', 'Energia insufficiente.');
  END IF;

  IF COALESCE(v_user.money, 0) < p_money_cost THEN
    RETURN jsonb_build_object('error', 'Fondi insufficienti.');
  END IF;

  UPDATE users
  SET
    energy = energy - p_energy_cost,
    money = money - p_money_cost
  WHERE id = p_user_id;

  IF p_update_field = 'attackerScore' THEN
    UPDATE wars
    SET "attackerScore" = COALESCE("attackerScore", 0) + p_final_damage,
        "updatedAt" = v_now
    WHERE id = p_war_id
    RETURNING "attackerScore" INTO v_updated_score;
  ELSIF p_update_field = 'defenderScore' THEN
    UPDATE wars
    SET "defenderScore" = COALESCE("defenderScore", 0) + p_final_damage,
        "updatedAt" = v_now
    WHERE id = p_war_id
    RETURNING "defenderScore" INTO v_updated_score;
  ELSIF p_update_field = 'phase1AttackerScore' THEN
    UPDATE wars
    SET "phase1AttackerScore" = COALESCE("phase1AttackerScore", 0) + p_final_damage,
        "updatedAt" = v_now
    WHERE id = p_war_id
    RETURNING "phase1AttackerScore" INTO v_updated_score;
  ELSE
    UPDATE wars
    SET "phase1DefenderScore" = COALESCE("phase1DefenderScore", 0) + p_final_damage,
        "updatedAt" = v_now
    WHERE id = p_war_id
    RETURNING "phase1DefenderScore" INTO v_updated_score;
  END IF;

  SELECT * INTO v_participant
  FROM war_participants
  WHERE "warId" = p_war_id
    AND "userId" = p_user_id
  FOR UPDATE;

  IF FOUND THEN
    v_existing_troops := COALESCE(v_participant."troopsDeployed", '{}'::JSONB);
    v_new_troop_qty := COALESCE((v_existing_troops ->> p_troop_type)::INTEGER, 0) + p_quantity;

    UPDATE war_participants
    SET
      "totalDamage" = COALESCE("totalDamage", 0) + p_final_damage,
      "troopsDeployed" = jsonb_set(v_existing_troops, ARRAY[p_troop_type], to_jsonb(v_new_troop_qty), true)
    WHERE id = v_participant.id;
  ELSE
    INSERT INTO war_participants ("warId", "userId", side, "totalDamage", "troopsDeployed")
    VALUES (p_war_id, p_user_id, p_side, p_final_damage, jsonb_build_object(p_troop_type, p_quantity));
  END IF;

  INSERT INTO war_deployments (
    "warId",
    "userId",
    side,
    "troopType",
    quantity,
    "baseDamage",
    "finalDamage",
    bonuses,
    "deployedAt"
  )
  VALUES (
    p_war_id,
    p_user_id,
    p_side,
    p_troop_type,
    p_quantity,
    p_base_damage,
    p_final_damage,
    COALESCE(p_bonuses, '{}'::JSONB),
    v_now
  );

  INSERT INTO action_logs ("userId", action, details, "timestamp")
  VALUES (
    p_user_id,
    'WAR_DEPLOY',
    COALESCE(p_action_details, '{}'::JSONB),
    (EXTRACT(EPOCH FROM v_now) * 1000)::BIGINT
  );

  RETURN jsonb_build_object(
    'success', true,
    'warId', p_war_id,
    'userId', p_user_id,
    'side', p_side,
    'troopType', p_troop_type,
    'quantity', p_quantity,
    'damageDealt', p_final_damage,
    'scoreField', p_update_field,
    'updatedScore', COALESCE(v_updated_score, 0)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_war_deploy(
  TEXT,
  UUID,
  TEXT,
  TEXT,
  INTEGER,
  INTEGER,
  BIGINT,
  BIGINT,
  BIGINT,
  JSONB,
  TEXT,
  JSONB
) TO anon, authenticated, service_role;
