-- ============================================================
-- Atomic action RPCs for critical economy / ownership flows
-- Scope:
--   - JIT user provisioning
--   - travel start
--   - legacy attack action
--   - deep exploration activation
--   - resource recharge
-- ============================================================

CREATE OR REPLACE FUNCTION public.read_numeric_setting(
  p_key TEXT,
  p_default NUMERIC
)
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_value JSONB;
  v_text TEXT;
BEGIN
  SELECT value
  INTO v_value
  FROM public.game_settings
  WHERE key = p_key
  LIMIT 1;

  IF v_value IS NULL THEN
    RETURN p_default;
  END IF;

  v_text := trim(BOTH '"' FROM v_value::TEXT);

  BEGIN
    RETURN COALESCE(v_text::NUMERIC, p_default);
  EXCEPTION
    WHEN OTHERS THEN
      RETURN p_default;
  END;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.read_numeric_setting(TEXT, NUMERIC) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.read_numeric_setting(TEXT, NUMERIC) TO service_role;

CREATE OR REPLACE FUNCTION public.ensure_budget_for_owner(
  p_owner_type TEXT,
  p_owner_id TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_budget_id UUID;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('budget:' || coalesce(p_owner_type, '') || ':' || coalesce(p_owner_id, '')));

  SELECT id
  INTO v_budget_id
  FROM public.budgets
  WHERE "ownerType" = p_owner_type
    AND "ownerId" = p_owner_id
  ORDER BY id
  LIMIT 1
  FOR UPDATE;

  IF v_budget_id IS NULL THEN
    INSERT INTO public.budgets (
      "ownerType",
      "ownerId",
      "moneyEUR",
      resources,
      "updatedAt"
    )
    VALUES (
      p_owner_type,
      p_owner_id,
      0,
      '{}'::jsonb,
      (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT
    )
    RETURNING id INTO v_budget_id;
  END IF;

  RETURN v_budget_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.ensure_budget_for_owner(TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_budget_for_owner(TEXT, TEXT) TO service_role;

CREATE OR REPLACE FUNCTION public.rpc_provision_user_atomic(
  p_user_id UUID,
  p_email TEXT,
  p_username TEXT,
  p_default_region_id TEXT,
  p_last_energy_update BIGINT,
  p_last_login BIGINT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user public.users%ROWTYPE;
  v_created BOOLEAN := FALSE;
  v_username TEXT;
  v_region_exists BOOLEAN := FALSE;
BEGIN
  IF p_user_id IS NULL OR COALESCE(trim(p_default_region_id), '') = '' THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'code', 'invalid_input',
      'message', 'Parametri di provisioning non validi.'
    );
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('provision:' || p_user_id::TEXT));

  SELECT EXISTS(
    SELECT 1
    FROM public.regions
    WHERE id = p_default_region_id
  )
  INTO v_region_exists;

  IF NOT v_region_exists THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'code', 'invalid_default_region',
      'message', 'Regione di default non valida.'
    );
  END IF;

  v_username := COALESCE(
    NULLIF(trim(p_username), ''),
    NULLIF(split_part(COALESCE(p_email, ''), '@', 1), ''),
    'User_' || substr(p_user_id::TEXT, 1, 5)
  );

  INSERT INTO public.users (
    id,
    username,
    email,
    money,
    gold,
    energy,
    xp,
    level,
    "regionId",
    "residenceId",
    "lastEnergyUpdate",
    "lastLogin"
  )
  VALUES (
    p_user_id,
    v_username,
    NULLIF(trim(p_email), ''),
    5000,
    50,
    100,
    0,
    1,
    p_default_region_id,
    p_default_region_id,
    COALESCE(p_last_energy_update, (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT),
    COALESCE(p_last_login, (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT)
  )
  ON CONFLICT (id) DO NOTHING
  RETURNING *
  INTO v_user;

  IF FOUND THEN
    v_created := TRUE;

    INSERT INTO public.user_inventory ("userId", "itemId", quantity)
    VALUES
      (p_user_id, 'oil', 20),
      (p_user_id, 'minerals', 20),
      (p_user_id, 'uranium', 5),
      (p_user_id, 'diamonds', 5)
    ON CONFLICT ("userId", "itemId") DO NOTHING;
  ELSE
    SELECT *
    INTO v_user
    FROM public.users
    WHERE id = p_user_id
    LIMIT 1;
  END IF;

  IF v_user.id IS NULL THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'code', 'user_not_found',
      'message', 'Profilo utente non disponibile dopo il provisioning.'
    );
  END IF;

  RETURN jsonb_build_object(
    'success', TRUE,
    'created', v_created,
    'user', jsonb_build_object(
      'id', v_user.id,
      'username', v_user.username,
      'email', v_user.email,
      'money', v_user.money,
      'gold', v_user.gold,
      'energy', v_user.energy,
      'regionId', v_user."regionId",
      'residenceId', v_user."residenceId",
      'workPermitId', v_user."workPermitId",
      'originalNation', v_user."originalNation",
      'displayedNation', v_user."displayedNation",
      'lastOriginalNationChange', v_user."lastOriginalNationChange",
      'lastEnergyUpdate', v_user."lastEnergyUpdate",
      'xp', v_user.xp,
      'level', v_user.level,
      'energyDrinks', v_user."energyDrinks",
      'lastEnergyDrink', v_user."lastEnergyDrink",
      'warMedals', v_user."warMedals",
      'lastMedalClaim', v_user."lastMedalClaim",
      'travelingTo', v_user."travelingTo",
      'travelingUntil', v_user."travelingUntil",
      'travelingFrom', v_user."travelingFrom",
      'travelDurationMs', v_user."travelDurationMs",
      'perkUpgradesJson', v_user."perkUpgradesJson",
      'boostersJson', v_user."boostersJson"
    )
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.rpc_provision_user_atomic(UUID, TEXT, TEXT, TEXT, BIGINT, BIGINT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_provision_user_atomic(UUID, TEXT, TEXT, TEXT, BIGINT, BIGINT) TO service_role;

CREATE OR REPLACE FUNCTION public.rpc_start_travel_atomic(
  p_user_id UUID,
  p_target_region_id TEXT,
  p_travel_time_ms BIGINT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user public.users%ROWTYPE;
  v_target public.regions%ROWTYPE;
  v_target_region_id TEXT;
  v_now_ms BIGINT := (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT;
  v_duration_ms BIGINT;
  v_traveling_until BIGINT;
  v_travel_minutes INT;
  v_is_restricted BOOLEAN;
  v_travel_fee BIGINT;
  v_source_state_id TEXT;
  v_user_bloc_id TEXT;
  v_target_bloc_id TEXT;
  v_open_borders BOOLEAN := FALSE;
  v_has_agreement BOOLEAN := FALSE;
  v_money_after BIGINT;
BEGIN
  v_target_region_id := UPPER(trim(COALESCE(p_target_region_id, '')));
  v_duration_ms := GREATEST(COALESCE(p_travel_time_ms, 120000), 1000);
  v_traveling_until := v_now_ms + v_duration_ms;
  v_travel_minutes := GREATEST(1, ROUND(v_duration_ms / 60000.0));

  IF p_user_id IS NULL OR v_target_region_id = '' THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'code', 'invalid_input',
      'message', 'Destinazione non valida.'
    );
  END IF;

  IF v_target_region_id !~ '^[A-Z]{2,4}$' THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'code', 'invalid_region',
      'message', 'Regione non valida.'
    );
  END IF;

  SELECT *
  INTO v_user
  FROM public.users
  WHERE id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'code', 'user_not_found',
      'message', 'Utente non trovato.'
    );
  END IF;

  SELECT *
  INTO v_target
  FROM public.regions
  WHERE id = v_target_region_id
  LIMIT 1;

  IF v_target.id IS NULL THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'code', 'region_not_found',
      'message', 'Regione non trovata.'
    );
  END IF;

  IF COALESCE(v_user."regionId", '') = v_target_region_id THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'code', 'same_region',
      'message', 'Sei gia in questa regione.'
    );
  END IF;

  IF v_user."travelingUntil" IS NOT NULL
     AND v_user."travelingTo" IS NOT NULL
     AND v_now_ms < v_user."travelingUntil" THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'code', 'already_traveling',
      'message', 'Sei gia in viaggio.',
      'travelingTo', v_user."travelingTo",
      'travelingUntil', v_user."travelingUntil",
      'remainingMs', v_user."travelingUntil" - v_now_ms
    );
  END IF;

  v_is_restricted := COALESCE(v_target."workRestrictions", 0) = 1;
  v_travel_fee := GREATEST(0, COALESCE(v_target."travelFee", 0));
  v_source_state_id := COALESCE(NULLIF(v_user."residenceId", ''), v_user."regionId");

  SELECT "blocId"
  INTO v_user_bloc_id
  FROM public.bloc_memberships
  WHERE "stateId" = v_source_state_id
    AND status = 'active'
  LIMIT 1;

  SELECT "blocId"
  INTO v_target_bloc_id
  FROM public.bloc_memberships
  WHERE "stateId" = v_target_region_id
    AND status = 'active'
  LIMIT 1;

  IF v_user_bloc_id IS NOT NULL
     AND v_target_bloc_id IS NOT NULL
     AND v_user_bloc_id = v_target_bloc_id THEN
    SELECT (
      COALESCE("openBorders", 0) <> 0
      OR COALESCE("migrationOpen", 0) <> 0
    )
    INTO v_open_borders
    FROM public.bloc_regulations
    WHERE "blocId" = v_user_bloc_id
    LIMIT 1;

    IF COALESCE(v_open_borders, FALSE) THEN
      v_is_restricted := FALSE;
      v_travel_fee := 0;
    END IF;
  END IF;

  IF v_is_restricted OR v_travel_fee > 0 THEN
    SELECT EXISTS(
      SELECT 1
      FROM public.migration_agreements
      WHERE "fromStateId" = v_target_region_id
        AND "toStateId" = v_source_state_id
        AND status = 'ACTIVE'
    )
    INTO v_has_agreement;

    IF v_has_agreement THEN
      v_is_restricted := FALSE;
      v_travel_fee := 0;
    END IF;
  END IF;

  IF v_is_restricted
     AND v_travel_fee > 0
     AND COALESCE(v_user.money, 0) < v_travel_fee THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'code', 'insufficient_funds',
      'message', format('Fondi insufficienti per pagare la tassa di frontiera ($%s).', v_travel_fee),
      'required', v_travel_fee,
      'available', COALESCE(v_user.money, 0)
    );
  END IF;

  UPDATE public.users
  SET
    "travelingFrom" = v_user."regionId",
    "travelingTo" = v_target_region_id,
    "travelingUntil" = v_traveling_until,
    "travelDurationMs" = v_duration_ms,
    money = money - CASE
      WHEN v_is_restricted AND v_travel_fee > 0 THEN v_travel_fee
      ELSE 0
    END
  WHERE id = p_user_id;

  IF v_is_restricted AND v_travel_fee > 0 THEN
    PERFORM public.ensure_budget_for_owner('REGION', v_target_region_id);
    PERFORM public.add_budget_transaction(
      'REGION',
      v_target_region_id,
      'INCOME',
      'TRAVEL_FEE',
      v_travel_fee,
      '{}'::jsonb,
      p_user_id,
      jsonb_build_object('fromRegion', v_user."regionId")
    );
  END IF;

  v_money_after := COALESCE(v_user.money, 0) - CASE
    WHEN v_is_restricted AND v_travel_fee > 0 THEN v_travel_fee
    ELSE 0
  END;

  RETURN jsonb_build_object(
    'success', TRUE,
    'regionId', v_target_region_id,
    'travelMinutes', v_travel_minutes,
    'travelingUntil', v_traveling_until,
    'travelingFrom', v_user."regionId",
    'travelDurationMs', v_duration_ms,
    'travelFeePaid', CASE
      WHEN v_is_restricted AND v_travel_fee > 0 THEN v_travel_fee
      ELSE 0
    END,
    'moneyAfter', v_money_after
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.rpc_start_travel_atomic(UUID, TEXT, BIGINT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_start_travel_atomic(UUID, TEXT, BIGINT) TO service_role;

CREATE OR REPLACE FUNCTION public.rpc_attack_action_atomic(
  p_user_id UUID,
  p_target_region_id TEXT,
  p_attack_cooldown_ms BIGINT,
  p_base_energy_cost INT,
  p_xp_success BIGINT,
  p_xp_failure BIGINT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user public.users%ROWTYPE;
  v_target public.regions%ROWTYPE;
  v_target_region_id TEXT;
  v_last_used TIMESTAMPTZ;
  v_remaining_ms BIGINT;
  v_forza INT := 0;
  v_istruzione INT := 0;
  v_resistenza INT := 0;
  v_energy_reduction NUMERIC := 0;
  v_energy_cost INT;
  v_forza_bonus NUMERIC := 0;
  v_istruzione_bonus NUMERIC := 0;
  v_resistenza_bonus NUMERIC := 0;
  v_alpha_bonus NUMERIC := 0;
  v_total_bonus NUMERIC := 0;
  v_win_probability NUMERIC := 0;
  v_roll INT := 0;
  v_attack_succeeded BOOLEAN := FALSE;
  v_xp_gain BIGINT := 0;
  v_war_id TEXT := NULL;
  v_attacker_bloc_id TEXT;
  v_defender_bloc_id TEXT;
BEGIN
  v_target_region_id := UPPER(trim(COALESCE(p_target_region_id, '')));

  IF p_user_id IS NULL OR v_target_region_id = '' THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'code', 'invalid_input',
      'message', 'Parametri di attacco non validi.'
    );
  END IF;

  IF v_target_region_id !~ '^[A-Z]{2,4}$' THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'code', 'invalid_region',
      'message', 'Regione non valida.'
    );
  END IF;

  SELECT *
  INTO v_user
  FROM public.users
  WHERE id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'code', 'user_not_found',
      'message', 'Utente non trovato.'
    );
  END IF;

  SELECT *
  INTO v_target
  FROM public.regions
  WHERE id = v_target_region_id
  FOR UPDATE;

  IF v_target.id IS NULL THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'code', 'region_not_found',
      'message', 'Regione non trovata.'
    );
  END IF;

  IF COALESCE(v_user."regionId", '') = v_target_region_id THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'code', 'same_region',
      'message', 'Non puoi attaccare la tua stessa regione.'
    );
  END IF;

  SELECT last_used
  INTO v_last_used
  FROM public.cooldowns
  WHERE user_id = p_user_id
    AND action_type = 'attack';

  IF v_last_used IS NOT NULL THEN
    v_remaining_ms := GREATEST(
      0,
      p_attack_cooldown_ms - (
        (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT
        - (EXTRACT(EPOCH FROM v_last_used) * 1000)::BIGINT
      )
    );

    IF v_remaining_ms > 0 THEN
      RETURN jsonb_build_object(
        'success', FALSE,
        'code', 'cooldown_active',
        'message', 'Action on cooldown',
        'remainingMs', v_remaining_ms
      );
    END IF;
  END IF;

  SELECT
    COALESCE(MAX(CASE WHEN "perkId" = 'FORZA' THEN level END), 0),
    COALESCE(MAX(CASE WHEN "perkId" = 'ISTRUZIONE' THEN level END), 0),
    COALESCE(MAX(CASE WHEN "perkId" = 'RESISTENZA' THEN level END), 0)
  INTO v_forza, v_istruzione, v_resistenza
  FROM public.perks
  WHERE "userId" = p_user_id;

  v_energy_reduction := LEAST(0.5, v_resistenza / 100.0);
  v_energy_cost := CEIL(COALESCE(p_base_energy_cost, 0) * (1 - v_energy_reduction));

  IF COALESCE(v_user.energy, 0) < v_energy_cost THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'code', 'insufficient_energy',
      'message', 'Not enough energy',
      'required', v_energy_cost,
      'available', COALESCE(v_user.energy, 0)
    );
  END IF;

  SELECT "blocId"
  INTO v_attacker_bloc_id
  FROM public.bloc_memberships
  WHERE "stateId" = v_user."regionId"
    AND status = 'active'
  LIMIT 1;

  SELECT "blocId"
  INTO v_defender_bloc_id
  FROM public.bloc_memberships
  WHERE "stateId" = v_target_region_id
    AND status = 'active'
  LIMIT 1;

  IF v_attacker_bloc_id IS NOT NULL
     AND v_defender_bloc_id IS NOT NULL
     AND v_attacker_bloc_id = v_defender_bloc_id THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'code', 'forbidden_same_bloc',
      'message', 'Non puoi dichiarare guerra a un membro dello stesso Blocco Geopolitico.'
    );
  END IF;

  v_forza_bonus := v_forza * 0.05;
  v_istruzione_bonus := v_istruzione * 0.02;
  v_resistenza_bonus := v_resistenza * 0.03;
  v_total_bonus := v_forza_bonus + v_istruzione_bonus + v_resistenza_bonus;

  IF v_resistenza >= 50 THEN
    v_alpha_bonus := v_alpha_bonus + 0.10;
  END IF;
  IF v_resistenza >= 75 THEN
    v_alpha_bonus := v_alpha_bonus + 0.10;
  END IF;
  IF v_resistenza >= 100 THEN
    v_alpha_bonus := v_alpha_bonus + 0.15;
  END IF;

  v_win_probability := LEAST(0.9, 0.3 + v_total_bonus + v_alpha_bonus);
  v_roll := FLOOR(random() * 1000)::INT;
  v_attack_succeeded := v_roll < ROUND(v_win_probability * 1000);

  UPDATE public.users
  SET energy = energy - v_energy_cost
  WHERE id = p_user_id;

  IF v_attack_succeeded THEN
    UPDATE public.regions
    SET
      "ownerUserId" = p_user_id,
      stability = GREATEST(0, COALESCE(stability, 100) - 20)
    WHERE id = v_target_region_id;

    v_war_id := SUBSTR(md5(random()::TEXT || clock_timestamp()::TEXT), 1, 7);

    INSERT INTO public.wars (
      id,
      "attackerCountryIso2",
      "defenderCountryIso2",
      "attackerUserId",
      "defenderUserId",
      status,
      "startedAt",
      "endsAt",
      "attackerScore",
      "defenderScore"
    )
    VALUES (
      v_war_id,
      v_user."regionId",
      v_target_region_id,
      p_user_id,
      v_target."ownerUserId",
      'ended',
      NOW(),
      NOW(),
      100,
      0
    );

    v_xp_gain := COALESCE(p_xp_success, 0);
  ELSE
    v_xp_gain := COALESCE(p_xp_failure, 0);
  END IF;

  IF v_xp_gain > 0 THEN
    PERFORM public.add_user_xp(p_user_id, v_xp_gain::INT);
  END IF;

  INSERT INTO public.cooldowns (user_id, action_type, last_used)
  VALUES (p_user_id, 'attack', NOW())
  ON CONFLICT (user_id, action_type)
  DO UPDATE SET last_used = EXCLUDED.last_used;

  RETURN jsonb_build_object(
    'success', TRUE,
    'attackSucceeded', v_attack_succeeded,
    'winProbability', ROUND(v_win_probability * 100),
    'energyAfter', COALESCE(v_user.energy, 0) - v_energy_cost,
    'xpGranted', v_xp_gain,
    'warId', v_war_id
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.rpc_attack_action_atomic(UUID, TEXT, BIGINT, INT, BIGINT, BIGINT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_attack_action_atomic(UUID, TEXT, BIGINT, INT, BIGINT, BIGINT) TO service_role;

CREATE OR REPLACE FUNCTION public.rpc_activate_deep_exploration_atomic(
  p_user_id UUID,
  p_nation_id TEXT,
  p_resource_type TEXT,
  p_level INT,
  p_activation_id TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user public.users%ROWTYPE;
  v_capital_region public.regions%ROWTYPE;
  v_existing_deep RECORD;
  v_target_cap INT;
  v_cap_target_max_recommended INT;
  v_cap_max_global INT;
  v_num_regions INT;
  v_sum_delta NUMERIC;
  v_avg_base_cap NUMERIC;
  v_base_cost_diamonds INT;
  v_base_cost_eur INT;
  v_base_cost_gold INT;
  v_per_delta_diamonds NUMERIC;
  v_per_delta_eur NUMERIC;
  v_per_delta_gold NUMERIC;
  v_per_region_diamonds INT;
  v_per_region_eur INT;
  v_per_region_gold INT;
  v_discount_strength NUMERIC;
  v_cost_diamonds INT;
  v_cost_eur INT;
  v_cost_gold INT;
  v_discount_factor NUMERIC;
  v_diamonds_before INT := 0;
  v_budget_money BIGINT := 0;
  v_duration_days INT;
  v_starts_at TIMESTAMPTZ := NOW();
  v_ends_at TIMESTAMPTZ;
  v_deep_id TEXT;
BEGIN
  IF p_user_id IS NULL
     OR COALESCE(trim(p_nation_id), '') = ''
     OR COALESCE(trim(p_resource_type), '') = ''
     OR COALESCE(p_level, 0) <= 0 THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'code', 'invalid_input',
      'message', 'nationId, resourceType e level sono obbligatori.'
    );
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('deep:' || trim(p_nation_id)));

  SELECT *
  INTO v_user
  FROM public.users
  WHERE id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'code', 'user_not_found',
      'message', 'Utente non trovato.'
    );
  END IF;

  SELECT *
  INTO v_capital_region
  FROM public.regions
  WHERE nation_id = p_nation_id
    AND COALESCE("isCapital", FALSE) = TRUE
  LIMIT 1;

  IF v_capital_region.id IS NULL THEN
    IF EXISTS(SELECT 1 FROM public.regions WHERE nation_id = p_nation_id) THEN
      RETURN jsonb_build_object(
        'success', FALSE,
        'code', 'capital_not_configured',
        'message', 'Capitale nazionale non configurata.'
      );
    END IF;

    RETURN jsonb_build_object(
      'success', FALSE,
      'code', 'nation_not_found',
      'message', 'Nazione non trovata.'
    );
  END IF;

  IF v_capital_region."ownerUserId" <> p_user_id
     AND v_capital_region."economicAdviserId" <> p_user_id THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'code', 'forbidden',
      'message', 'Solo il Leader/Dittatore o il Ministro dell''Economia può attivare Deep Exploration.'
    );
  END IF;

  SELECT id, "resourceType", "endsAt"
  INTO v_existing_deep
  FROM public.deep_explorations
  WHERE "nationId" = p_nation_id
    AND "isActive" = TRUE
    AND "endsAt" >= NOW()
  ORDER BY "startsAt" DESC
  LIMIT 1;

  IF v_existing_deep.id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'code', 'active_deep_exists',
      'message', format(
        'Deep Exploration già attiva per %s. Scade il %s.',
        v_existing_deep."resourceType",
        to_char(v_existing_deep."endsAt", 'YYYY-MM-DD"T"HH24:MI:SSOF')
      ),
      'activeResourceType', v_existing_deep."resourceType",
      'endsAt', v_existing_deep."endsAt"
    );
  END IF;

  SELECT "targetCap"
  INTO v_target_cap
  FROM public.deep_levels
  WHERE level = p_level
    AND enabled = TRUE
  LIMIT 1;

  IF v_target_cap IS NULL THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'code', 'invalid_level',
      'message', 'Livello Deep non valido o disabilitato.'
    );
  END IF;

  v_cap_target_max_recommended := COALESCE(public.read_numeric_setting('cap_target_max_recommended', 637), 637);
  v_cap_max_global := COALESCE(public.read_numeric_setting('cap_max_global', 2000), 2000);

  IF v_target_cap > LEAST(v_cap_target_max_recommended, v_cap_max_global) THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'code', 'cap_limit_exceeded',
      'message', 'targetCap supera il limite consentito.'
    );
  END IF;

  SELECT
    COUNT(*)::INT,
    COALESCE(SUM(GREATEST(0, v_target_cap - rr."baseCapPerRecharge")), 0),
    COALESCE(AVG(rr."baseCapPerRecharge"), 0)
  INTO v_num_regions, v_sum_delta, v_avg_base_cap
  FROM public.region_resources rr
  INNER JOIN public.regions r
    ON r.id = rr."regionId"
  WHERE r.nation_id = p_nation_id
    AND rr."resourceType" = p_resource_type;

  IF COALESCE(v_num_regions, 0) = 0 THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'code', 'resource_not_configured',
      'message', 'Nessuna regione ha questa risorsa configurata.'
    );
  END IF;

  v_base_cost_diamonds := COALESCE(public.read_numeric_setting('deep_base_cost_diamonds', 500), 500);
  v_base_cost_eur := COALESCE(public.read_numeric_setting('deep_base_cost_eur', 100000), 100000);
  v_base_cost_gold := COALESCE(public.read_numeric_setting('deep_base_cost_gold', 0), 0);
  v_per_delta_diamonds := COALESCE(public.read_numeric_setting('deep_cost_per_delta_diamonds', 2), 2);
  v_per_delta_eur := COALESCE(public.read_numeric_setting('deep_cost_per_delta_eur', 500), 500);
  v_per_delta_gold := COALESCE(public.read_numeric_setting('deep_cost_per_delta_gold', 0), 0);
  v_per_region_diamonds := COALESCE(public.read_numeric_setting('deep_cost_per_region_diamonds', 50), 50);
  v_per_region_eur := COALESCE(public.read_numeric_setting('deep_cost_per_region_eur', 10000), 10000);
  v_per_region_gold := COALESCE(public.read_numeric_setting('deep_cost_per_region_gold', 0), 0);
  v_discount_strength := COALESCE(public.read_numeric_setting('deep_cost_cap_discount_strength', 0), 0);

  v_cost_diamonds := ROUND(v_base_cost_diamonds + (v_sum_delta * v_per_delta_diamonds) + (v_num_regions * v_per_region_diamonds));
  v_cost_eur := ROUND(v_base_cost_eur + (v_sum_delta * v_per_delta_eur) + (v_num_regions * v_per_region_eur));
  v_cost_gold := ROUND(v_base_cost_gold + (v_sum_delta * v_per_delta_gold) + (v_num_regions * v_per_region_gold));

  IF v_discount_strength > 0 AND v_target_cap > 0 THEN
    v_discount_factor := 1 - v_discount_strength * (v_avg_base_cap / v_target_cap);
    v_discount_factor := GREATEST(0.6, LEAST(1.0, v_discount_factor));
    v_cost_diamonds := ROUND(v_cost_diamonds * v_discount_factor);
    v_cost_eur := ROUND(v_cost_eur * v_discount_factor);
    v_cost_gold := ROUND(v_cost_gold * v_discount_factor);
  END IF;

  v_cost_diamonds := GREATEST(v_base_cost_diamonds, v_cost_diamonds);
  v_cost_eur := GREATEST(v_base_cost_eur, v_cost_eur);
  v_cost_gold := GREATEST(v_base_cost_gold, v_cost_gold);

  SELECT COALESCE(quantity, 0)
  INTO v_diamonds_before
  FROM public.user_inventory
  WHERE "userId" = p_user_id
    AND "itemId" = 'diamonds'
  FOR UPDATE;

  v_diamonds_before := COALESCE(v_diamonds_before, 0);

  IF v_diamonds_before < v_cost_diamonds THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'code', 'insufficient_diamonds',
      'message', format('Diamanti insufficienti. Servono %s, hai %s.', v_cost_diamonds, v_diamonds_before),
      'required', v_cost_diamonds,
      'available', v_diamonds_before
    );
  END IF;

  IF COALESCE(v_user.gold, 0) < v_cost_gold THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'code', 'insufficient_gold',
      'message', format('Gold insufficiente. Servono %s, hai %s.', v_cost_gold, COALESCE(v_user.gold, 0)),
      'required', v_cost_gold,
      'available', COALESCE(v_user.gold, 0)
    );
  END IF;

  PERFORM public.ensure_budget_for_owner('REGION', v_capital_region.id);

  SELECT COALESCE("moneyEUR", 0)
  INTO v_budget_money
  FROM public.budgets
  WHERE "ownerType" = 'REGION'
    AND "ownerId" = v_capital_region.id
  ORDER BY id
  LIMIT 1
  FOR UPDATE;

  IF v_budget_money < v_cost_eur THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'code', 'insufficient_budget',
      'message', format('Fondi EUR insufficienti nel tesoro nazionale. Servono €%s.', v_cost_eur),
      'required', v_cost_eur,
      'available', v_budget_money
    );
  END IF;

  IF v_cost_eur > 0 THEN
    PERFORM public.add_budget_transaction(
      'REGION',
      v_capital_region.id,
      'EXPENSE',
      'DEEP_EXPLORATION',
      -v_cost_eur,
      '{}'::jsonb,
      p_user_id,
      jsonb_build_object(
        'resourceType', p_resource_type,
        'level', p_level,
        'targetCap', v_target_cap,
        'costDiamonds', v_cost_diamonds,
        'costGold', v_cost_gold
      )
    );
  END IF;

  IF v_cost_diamonds > 0 THEN
    UPDATE public.user_inventory
    SET quantity = quantity - v_cost_diamonds
    WHERE "userId" = p_user_id
      AND "itemId" = 'diamonds';
  END IF;

  IF v_cost_gold > 0 THEN
    UPDATE public.users
    SET gold = gold - v_cost_gold
    WHERE id = p_user_id;
  END IF;

  v_duration_days := COALESCE(public.read_numeric_setting('deep_duration_days', 7), 7);
  v_ends_at := v_starts_at + make_interval(days => v_duration_days);
  v_deep_id := COALESCE(NULLIF(trim(COALESCE(p_activation_id, '')), ''), 'deep_' || substr(md5(random()::TEXT || clock_timestamp()::TEXT), 1, 9));

  INSERT INTO public.deep_explorations (
    id,
    "nationId",
    "resourceType",
    level,
    "targetCap",
    "activatedByUserId",
    "startsAt",
    "endsAt",
    "isActive",
    "costDiamonds",
    "costEur",
    "costGold"
  )
  VALUES (
    v_deep_id,
    p_nation_id,
    p_resource_type,
    p_level,
    v_target_cap,
    p_user_id,
    v_starts_at,
    v_ends_at,
    TRUE,
    v_cost_diamonds,
    v_cost_eur,
    v_cost_gold
  );

  RETURN jsonb_build_object(
    'success', TRUE,
    'deepId', v_deep_id,
    'targetCap', v_target_cap,
    'endsAt', v_ends_at,
    'costs', jsonb_build_object(
      'diamonds', v_cost_diamonds,
      'eur', v_cost_eur,
      'gold', v_cost_gold
    ),
    'message', format(
      'Deep Exploration Livello %s attivata per %s! Durata: %s giorni.',
      p_level,
      p_resource_type,
      v_duration_days
    )
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.rpc_activate_deep_exploration_atomic(UUID, TEXT, TEXT, INT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_activate_deep_exploration_atomic(UUID, TEXT, TEXT, INT, TEXT) TO service_role;

CREATE OR REPLACE FUNCTION public.rpc_recharge_resource_atomic(
  p_user_id UUID,
  p_region_id TEXT,
  p_resource_type TEXT,
  p_recharge_amount INT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_region public.regions%ROWTYPE;
  v_region_resource public.region_resources%ROWTYPE;
  v_last_recharge TIMESTAMPTZ;
  v_region_id TEXT;
  v_now TIMESTAMPTZ := NOW();
  v_cooldown_sec INT;
  v_remaining_sec INT;
  v_daily_max_cap INT;
  v_total_unlocked_today INT;
  v_current_available_cap INT;
  v_initial_available_cap INT;
  v_can_unlock_more INT;
  v_requested_amount INT;
  v_actual_recharge INT;
  v_cost_eur INT;
  v_budget_money BIGINT := 0;
BEGIN
  v_region_id := UPPER(trim(COALESCE(p_region_id, '')));

  IF p_user_id IS NULL
     OR v_region_id = ''
     OR COALESCE(trim(p_resource_type), '') = '' THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'code', 'invalid_input',
      'message', 'regionId e resourceType sono obbligatori.'
    );
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('recharge:' || v_region_id || ':' || trim(p_resource_type)));

  SELECT *
  INTO v_region
  FROM public.regions
  WHERE id = v_region_id
  LIMIT 1;

  IF v_region.id IS NULL THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'code', 'region_not_found',
      'message', 'Regione non trovata.'
    );
  END IF;

  IF v_region."ownerUserId" <> p_user_id
     AND v_region."economicAdviserId" <> p_user_id THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'code', 'forbidden',
      'message', 'Solo il Dittatore/Leader o il Ministro dell''Economia possono ricaricare.'
    );
  END IF;

  SELECT *
  INTO v_region_resource
  FROM public.region_resources
  WHERE "regionId" = v_region_id
    AND "resourceType" = p_resource_type
  FOR UPDATE;

  IF v_region_resource."regionId" IS NULL THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'code', 'resource_not_found',
      'message', 'Risorsa non configurata per questa regione.'
    );
  END IF;

  v_daily_max_cap := COALESCE(v_region_resource."dailyMaxCap", 999999);
  v_total_unlocked_today := COALESCE(v_region_resource."totalUnlockedToday", 0);
  v_current_available_cap := COALESCE(v_region_resource."currentAvailableCap", 0);
  v_initial_available_cap := COALESCE(v_region_resource."initialAvailableCap", 200);
  v_can_unlock_more := GREATEST(0, v_daily_max_cap - v_total_unlocked_today);

  IF v_can_unlock_more <= 0 THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'code', 'daily_max_reached',
      'message', 'Massimo giornaliero già raggiunto. Non è possibile sbloccare ulteriore disponibilità oggi.',
      'dailyMaxCap', v_daily_max_cap,
      'totalUnlockedToday', v_total_unlocked_today
    );
  END IF;

  SELECT "lastRechargeAt"
  INTO v_last_recharge
  FROM public.resource_recharges
  WHERE "regionId" = v_region_id
    AND "resourceType" = p_resource_type
  FOR UPDATE;

  v_cooldown_sec := COALESCE(public.read_numeric_setting('recharge_cooldown_seconds', 1800), 1800);

  IF v_last_recharge IS NOT NULL THEN
    v_remaining_sec := CEIL(
      EXTRACT(EPOCH FROM (v_last_recharge + make_interval(secs => v_cooldown_sec) - v_now))
    );
    v_remaining_sec := GREATEST(0, v_remaining_sec);

    IF v_remaining_sec > 0 THEN
      RETURN jsonb_build_object(
        'success', FALSE,
        'code', 'cooldown_active',
        'message', format('Cooldown attivo. Riprova tra %s minuti.', CEIL(v_remaining_sec / 60.0)),
        'cooldownRemaining', v_remaining_sec
      );
    END IF;
  END IF;

  v_requested_amount := CASE
    WHEN COALESCE(p_recharge_amount, 0) > 0 THEN p_recharge_amount
    ELSE v_initial_available_cap
  END;
  v_actual_recharge := LEAST(v_requested_amount, v_can_unlock_more);
  v_cost_eur := COALESCE(public.read_numeric_setting('recharge_cost_eur', 0), 0);

  IF v_cost_eur > 0 THEN
    PERFORM public.ensure_budget_for_owner('REGION', v_region_id);

    SELECT COALESCE("moneyEUR", 0)
    INTO v_budget_money
    FROM public.budgets
    WHERE "ownerType" = 'REGION'
      AND "ownerId" = v_region_id
    ORDER BY id
    LIMIT 1
    FOR UPDATE;

    IF v_budget_money < v_cost_eur THEN
      RETURN jsonb_build_object(
        'success', FALSE,
        'code', 'insufficient_budget',
        'message', format('Fondi del tesoro insufficienti. Servono €%s.', v_cost_eur),
        'required', v_cost_eur,
        'available', v_budget_money
      );
    END IF;
  END IF;

  IF v_cost_eur > 0 THEN
    PERFORM public.add_budget_transaction(
      'REGION',
      v_region_id,
      'EXPENSE',
      'RESOURCE_RECHARGE',
      -v_cost_eur,
      '{}'::jsonb,
      p_user_id,
      jsonb_build_object(
        'resourceType', p_resource_type,
        'rechargeAmount', v_actual_recharge,
        'costEur', v_cost_eur
      )
    );
  END IF;

  UPDATE public.region_resources
  SET
    "currentAvailableCap" = v_current_available_cap + v_actual_recharge,
    "totalUnlockedToday" = v_total_unlocked_today + v_actual_recharge,
    "updatedAt" = NOW()
  WHERE "regionId" = v_region_id
    AND "resourceType" = p_resource_type;

  INSERT INTO public.resource_recharges (
    "regionId",
    "resourceType",
    "lastRechargeAt",
    "rechargedByUserId"
  )
  VALUES (
    v_region_id,
    p_resource_type,
    v_now,
    p_user_id
  )
  ON CONFLICT ("regionId", "resourceType")
  DO UPDATE SET
    "lastRechargeAt" = EXCLUDED."lastRechargeAt",
    "rechargedByUserId" = EXCLUDED."rechargedByUserId";

  RETURN jsonb_build_object(
    'success', TRUE,
    'message', format('Disponibilità ricaricata di %s unità per %s.', v_actual_recharge, p_resource_type),
    'rechargedAmount', v_actual_recharge,
    'newCurrentAvailableCap', v_current_available_cap + v_actual_recharge,
    'newTotalUnlockedToday', v_total_unlocked_today + v_actual_recharge,
    'dailyMaxCap', v_daily_max_cap,
    'canUnlockMoreAfter', GREATEST(0, v_daily_max_cap - (v_total_unlocked_today + v_actual_recharge)),
    'cooldownSeconds', v_cooldown_sec
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.rpc_recharge_resource_atomic(UUID, TEXT, TEXT, INT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_recharge_resource_atomic(UUID, TEXT, TEXT, INT) TO service_role;
