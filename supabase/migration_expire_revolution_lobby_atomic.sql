-- Atomic + idempotent lobby expiration with optional gold refunds.
-- Designed to be called by an explicit mutating API endpoint (not from GET handlers).

CREATE OR REPLACE FUNCTION public.expire_revolution_lobby_atomic(
  p_lobby_id UUID,
  p_actor_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_lobby revolution_lobbies%ROWTYPE;
  v_region_owner UUID;
  v_region_leader UUID;
  v_refunded_count INT := 0;
BEGIN
  IF p_lobby_id IS NULL OR p_actor_user_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'invalid_input',
      'message', 'Input non valido.'
    );
  END IF;

  SELECT *
  INTO v_lobby
  FROM revolution_lobbies
  WHERE id = p_lobby_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'not_found',
      'message', 'Lobby non trovata.'
    );
  END IF;

  SELECT "ownerUserId", "leaderUserId"
  INTO v_region_owner, v_region_leader
  FROM regions
  WHERE id = v_lobby."regionId";

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'region_not_found',
      'message', 'Regione della lobby non trovata.'
    );
  END IF;

  IF p_actor_user_id IS DISTINCT FROM v_region_owner
     AND p_actor_user_id IS DISTINCT FROM v_region_leader THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'forbidden',
      'message', 'Non autorizzato a scadere questa lobby.'
    );
  END IF;

  IF v_lobby.status = 'expired' THEN
    RETURN jsonb_build_object(
      'success', true,
      'status', 'expired',
      'idempotent', true,
      'refundedParticipants', 0
    );
  END IF;

  IF v_lobby.status <> 'pending' THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'invalid_state',
      'message', 'Solo le lobby pending possono essere scadute.'
    );
  END IF;

  IF v_lobby."expiresAt" IS NULL OR v_lobby."expiresAt" > NOW() THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'not_expired',
      'message', 'La lobby non è ancora scaduta.'
    );
  END IF;

  UPDATE revolution_lobbies
  SET status = 'expired',
      "updatedAt" = NOW()
  WHERE id = v_lobby.id
    AND status = 'pending';

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'race_condition',
      'message', 'Lobby già aggiornata da un’altra transazione.'
    );
  END IF;

  IF COALESCE(v_lobby."goldCostPerPlayer", 0) > 0
     AND COALESCE(array_length(v_lobby."participantIds", 1), 0) > 0 THEN
    UPDATE users
    SET gold = COALESCE(gold, 0) + v_lobby."goldCostPerPlayer"
    WHERE id = ANY(v_lobby."participantIds");

    GET DIAGNOSTICS v_refunded_count = ROW_COUNT;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'status', 'expired',
    'idempotent', false,
    'refundedParticipants', v_refunded_count
  );
END;
$$;
