-- Fix ambiguous RPC resolution for add_budget_transaction
-- Cause: both overloads existed with p_created_by as TEXT and UUID.
-- Effect: PostgREST cannot pick a best candidate for RPC calls.

-- 1) Remove legacy TEXT overload to avoid ambiguity
DROP FUNCTION IF EXISTS public.add_budget_transaction(
  text, text, text, text, bigint, jsonb, text, jsonb
);

-- 2) Keep a single canonical UUID overload
CREATE OR REPLACE FUNCTION public.add_budget_transaction(
  p_owner_type TEXT,
  p_owner_id TEXT,
  p_type TEXT,
  p_subtype TEXT,
  p_money_delta BIGINT,
  p_resources_delta JSONB DEFAULT '{}'::jsonb,
  p_created_by UUID DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::jsonb
) RETURNS TEXT
SET search_path = public
AS $$
DECLARE
  v_budget_id UUID;
  v_current_money BIGINT;
  v_current_resources JSONB;
  v_new_resources JSONB;
  v_res_key TEXT;
  v_res_val INT;
  v_tx_id TEXT;
BEGIN
  SELECT id, "moneyEUR", resources
    INTO v_budget_id, v_current_money, v_current_resources
  FROM budgets
  WHERE "ownerType" = p_owner_type
    AND "ownerId" = p_owner_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Budget non trovato per % %', p_owner_type, p_owner_id;
  END IF;

  IF v_current_money + p_money_delta < 0 THEN
    RAISE EXCEPTION 'Fondi insufficienti';
  END IF;

  v_new_resources = COALESCE(v_current_resources, '{}'::jsonb);
  FOR v_res_key, v_res_val IN SELECT * FROM jsonb_each_text(COALESCE(p_resources_delta, '{}'::jsonb))
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

  UPDATE budgets
  SET "moneyEUR" = "moneyEUR" + p_money_delta,
      resources = v_new_resources,
      "updatedAt" = (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT
  WHERE id = v_budget_id;

  v_tx_id := substr(md5(random()::text || clock_timestamp()::text), 1, 12);
  INSERT INTO budget_transactions (
    id, "budgetId", type, subtype, "moneyDelta", "resourcesDelta", "createdAt", "createdByUserId", metadata
  ) VALUES (
    v_tx_id,
    v_budget_id,
    p_type,
    p_subtype,
    p_money_delta,
    COALESCE(p_resources_delta, '{}'::jsonb),
    (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT,
    p_created_by,
    COALESCE(p_metadata, '{}'::jsonb)
  );

  RETURN v_tx_id;
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION public.add_budget_transaction(
  text, text, text, text, bigint, jsonb, uuid, jsonb
) TO anon, authenticated, service_role;
