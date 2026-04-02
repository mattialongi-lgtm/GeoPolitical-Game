-- Transfer work experience between resources (atomic, gold-cost, cap-respecting).
-- Rules:
-- - source != target
-- - xp_to_transfer > 0
-- - source has enough XP
-- - user has enough gold (ceil(xp/100))
-- - target must stay <= cap (2000 + educationLevel*1000)
-- - no XP is created (source decreases, target increases)

CREATE OR REPLACE FUNCTION public.transfer_work_experience(
  p_player_id uuid,
  p_source_resource text,
  p_target_resource text,
  p_xp_to_transfer int
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_source text;
  v_target text;
  v_xp int;
  v_gold_cost int;
  v_gold_current int;
  v_edu_level int;
  v_cap int;
  v_source_xp int;
  v_target_xp int;
  v_target_remaining int;
BEGIN
  v_source := lower(trim(coalesce(p_source_resource, '')));
  v_target := lower(trim(coalesce(p_target_resource, '')));
  v_xp := coalesce(p_xp_to_transfer, 0);

  IF v_source = '' OR v_target = '' THEN
    RAISE EXCEPTION 'sourceResource e targetResource sono obbligatori';
  END IF;

  IF v_source = v_target THEN
    RAISE EXCEPTION 'sourceResource e targetResource non possono essere uguali';
  END IF;

  IF v_xp <= 0 THEN
    RAISE EXCEPTION 'xpToTransfer deve essere > 0';
  END IF;

  -- Restrict to known working resource types
  IF v_source NOT IN ('oil','minerals','uranium','diamonds','gold_ore','liquid_oxygen','helium3','energy','food','steel','gas')
     OR v_target NOT IN ('oil','minerals','uranium','diamonds','gold_ore','liquid_oxygen','helium3','energy','food','steel','gas') THEN
    RAISE EXCEPTION 'Risorsa non valida (source=% , target=%)', v_source, v_target;
  END IF;

  -- Lock player row (gold)
  SELECT u.gold
  INTO v_gold_current
  FROM public.users u
  WHERE u.id = p_player_id
  FOR UPDATE;

  IF v_gold_current IS NULL THEN
    RAISE EXCEPTION 'Utente non trovato';
  END IF;

  -- Education level for cap (perks table is the canonical normalized store in this repo)
  SELECT coalesce(p.level, 0)
  INTO v_edu_level
  FROM public.perks p
  WHERE p."userId" = p_player_id
    AND p."perkId" = 'ISTRUZIONE'
  LIMIT 1;

  v_edu_level := greatest(0, floor(coalesce(v_edu_level, 0)));
  v_cap := 2000 + (v_edu_level * 1000);

  v_gold_cost := ceil(v_xp::numeric / 100)::int;
  IF v_gold_cost <= 0 THEN
    v_gold_cost := 1;
  END IF;

  IF v_gold_current < v_gold_cost THEN
    RAISE EXCEPTION 'Gold insufficiente: costo=% , disponibile=%', v_gold_cost, v_gold_current;
  END IF;

  -- Lock source and target XP rows
  SELECT pre.experience
  INTO v_source_xp
  FROM public.player_resource_work_experience pre
  WHERE pre."playerId" = p_player_id
    AND pre."resourceType" = v_source
  FOR UPDATE;

  v_source_xp := coalesce(v_source_xp, 0);
  IF v_source_xp < v_xp THEN
    RAISE EXCEPTION 'XP insufficiente nella sorgente: richiesto=% , disponibile=%', v_xp, v_source_xp;
  END IF;

  SELECT pre.experience
  INTO v_target_xp
  FROM public.player_resource_work_experience pre
  WHERE pre."playerId" = p_player_id
    AND pre."resourceType" = v_target
  FOR UPDATE;

  v_target_xp := coalesce(v_target_xp, 0);
  IF v_target_xp >= v_cap THEN
    RAISE EXCEPTION 'La risorsa target è già al cap (%/%).', v_target_xp, v_cap;
  END IF;

  v_target_remaining := v_cap - v_target_xp;
  IF v_xp > v_target_remaining THEN
    RAISE EXCEPTION 'XP oltre cap target: richiesto=% , spazio_disponibile=% (cap=% , target=%)',
      v_xp, v_target_remaining, v_cap, v_target_xp;
  END IF;

  -- Apply: subtract source, add target, deduct gold
  UPDATE public.player_resource_work_experience
  SET experience = (experience - v_xp),
      "lastWorkedAt" = now()
  WHERE "playerId" = p_player_id
    AND "resourceType" = v_source;

  INSERT INTO public.player_resource_work_experience ("playerId", "resourceType", experience, "totalExtractions", "lastWorkedAt")
  VALUES (p_player_id, v_target, v_target_xp + v_xp, 0, now())
  ON CONFLICT ("playerId","resourceType")
  DO UPDATE SET experience = EXCLUDED.experience,
                "lastWorkedAt" = EXCLUDED."lastWorkedAt";

  UPDATE public.users
  SET gold = gold - v_gold_cost
  WHERE id = p_player_id;

  RETURN jsonb_build_object(
    'playerId', p_player_id,
    'sourceResource', v_source,
    'targetResource', v_target,
    'xpTransferred', v_xp,
    'goldCost', v_gold_cost,
    'educationLevel', v_edu_level,
    'maxWorkXpPerResource', v_cap,
    'sourceBefore', v_source_xp,
    'sourceAfter', v_source_xp - v_xp,
    'targetBefore', v_target_xp,
    'targetAfter', v_target_xp + v_xp,
    'goldBefore', v_gold_current,
    'goldAfter', v_gold_current - v_gold_cost
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.transfer_work_experience(uuid, text, text, int) TO anon, authenticated, service_role;
