-- Atomic purchase of energy drinks from market using gold.
-- Rule: 1 energy drink = 30 gold.
-- Supports quantity purchase with server-side validation.

CREATE OR REPLACE FUNCTION public.buy_energy_drinks(
  p_user_id uuid,
  p_quantity int
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_quantity int;
  v_unit_cost int := 30;
  v_total_cost bigint;
  v_gold_before bigint;
  v_drinks_before int;
BEGIN
  v_quantity := coalesce(p_quantity, 0);

  IF v_quantity <= 0 THEN
    RAISE EXCEPTION 'La quantità deve essere > 0';
  END IF;

  IF v_quantity > 100000 THEN
    RAISE EXCEPTION 'Quantità troppo alta (max 100000)';
  END IF;

  v_total_cost := v_quantity::bigint * v_unit_cost::bigint;

  SELECT u.gold, coalesce(u."energyDrinks", 0)
  INTO v_gold_before, v_drinks_before
  FROM public.users u
  WHERE u.id = p_user_id
  FOR UPDATE;

  IF v_gold_before IS NULL THEN
    RAISE EXCEPTION 'Utente non trovato';
  END IF;

  IF v_gold_before < v_total_cost THEN
    RAISE EXCEPTION 'Gold insufficiente: costo=% , disponibile=%', v_total_cost, v_gold_before;
  END IF;

  UPDATE public.users
  SET gold = gold - v_total_cost,
      "energyDrinks" = coalesce("energyDrinks", 0) + v_quantity
  WHERE id = p_user_id;

  RETURN jsonb_build_object(
    'success', true,
    'playerId', p_user_id,
    'quantity', v_quantity,
    'unitCost', v_unit_cost,
    'totalCost', v_total_cost,
    'goldBefore', v_gold_before,
    'goldAfter', v_gold_before - v_total_cost,
    'energyDrinksBefore', v_drinks_before,
    'energyDrinksAfter', v_drinks_before + v_quantity
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.buy_energy_drinks(uuid, int) TO anon, authenticated, service_role;
