-- Atomic RPCs for remaining high-risk politics / governance / factory-market flows.
-- Focus:
--   - factory market list/cancel
--   - party create/join
--   - bloc create/apply/vote/regulation
--   - law propose / resolve for critical multi-update side effects
--   - generic standardized RPC error payload + optional idempotency replay

CREATE TABLE IF NOT EXISTS public.rpc_operation_log (
  operation_key TEXT PRIMARY KEY,
  flow TEXT NOT NULL,
  response JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rpc_operation_log_flow_created_at
ON public.rpc_operation_log (flow, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_factory_market_active_factory
ON public.factory_market_listings ("factoryId")
WHERE status = 'active';

CREATE UNIQUE INDEX IF NOT EXISTS idx_party_invites_pending_unique
ON public.party_invites ("partyId", "userId")
WHERE status = 'pending';

CREATE UNIQUE INDEX IF NOT EXISTS idx_bloc_applications_pending_unique
ON public.bloc_applications ("blocId", "stateId")
WHERE status = 'pending';

CREATE UNIQUE INDEX IF NOT EXISTS idx_bloc_votes_target_voter_unique
ON public.bloc_votes ("targetId", "voterStateId");

CREATE UNIQUE INDEX IF NOT EXISTS idx_sanctions_active_unique
ON public.sanctions ("fromStateId", "targetStateId")
WHERE status = 'ACTIVE';

CREATE OR REPLACE FUNCTION public.rpc_std_error(
  p_code TEXT,
  p_message TEXT,
  p_details JSONB DEFAULT '{}'::JSONB,
  p_retryable BOOLEAN DEFAULT FALSE,
  p_idempotent BOOLEAN DEFAULT FALSE
)
RETURNS JSONB
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT jsonb_build_object(
    'success', FALSE,
    'code', COALESCE(NULLIF(trim(p_code), ''), 'unknown_error'),
    'message', COALESCE(NULLIF(trim(p_message), ''), 'Operazione non riuscita.'),
    'retryable', COALESCE(p_retryable, FALSE),
    'idempotent', COALESCE(p_idempotent, FALSE),
    'details', COALESCE(p_details, '{}'::jsonb)
  );
$$;

CREATE OR REPLACE FUNCTION public.rpc_store_idempotent_response(
  p_operation_key TEXT,
  p_flow TEXT,
  p_response JSONB
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF COALESCE(trim(p_operation_key), '') = '' THEN
    RETURN;
  END IF;

  INSERT INTO public.rpc_operation_log (operation_key, flow, response)
  VALUES (trim(p_operation_key), p_flow, p_response)
  ON CONFLICT (operation_key) DO UPDATE
  SET response = EXCLUDED.response;
END;
$$;

CREATE OR REPLACE FUNCTION public.rpc_get_idempotent_response(
  p_operation_key TEXT,
  p_flow TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_response JSONB;
BEGIN
  IF COALESCE(trim(p_operation_key), '') = '' THEN
    RETURN NULL;
  END IF;

  SELECT response
  INTO v_response
  FROM public.rpc_operation_log
  WHERE operation_key = trim(p_operation_key)
    AND flow = p_flow
  LIMIT 1;

  IF v_response IS NULL THEN
    RETURN NULL;
  END IF;

  RETURN jsonb_set(v_response, '{idempotent}', 'true'::jsonb, TRUE);
END;
$$;

CREATE OR REPLACE FUNCTION public.rpc_factory_market_list_atomic(
  p_factory_id UUID,
  p_seller_id UUID,
  p_asking_price BIGINT,
  p_operation_key TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_factory public.factories%ROWTYPE;
  v_listing public.factory_market_listings%ROWTYPE;
  v_response JSONB;
BEGIN
  v_response := public.rpc_get_idempotent_response(p_operation_key, 'factory_market_list');
  IF v_response IS NOT NULL THEN
    RETURN v_response;
  END IF;

  IF p_factory_id IS NULL OR p_seller_id IS NULL OR COALESCE(p_asking_price, 0) <= 0 THEN
    RETURN public.rpc_std_error('invalid_input', 'Parametri non validi.');
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('factory_market:list:' || p_factory_id::TEXT));

  SELECT *
  INTO v_factory
  FROM public.factories
  WHERE id = p_factory_id
  FOR UPDATE;

  IF v_factory.id IS NULL THEN
    RETURN public.rpc_std_error('factory_not_found', 'Fabbrica non trovata.');
  END IF;

  IF v_factory."ownerUserId" <> p_seller_id THEN
    RETURN public.rpc_std_error('forbidden', 'Non sei il proprietario.');
  END IF;

  SELECT *
  INTO v_listing
  FROM public.factory_market_listings
  WHERE "factoryId" = p_factory_id
    AND status = 'active'
  LIMIT 1
  FOR UPDATE;

  IF v_listing.id IS NOT NULL THEN
    IF v_listing."sellerId" = p_seller_id AND v_listing."askingPrice" = p_asking_price THEN
      v_response := jsonb_build_object(
        'success', TRUE,
        'listing', to_jsonb(v_listing),
        'alreadyActive', TRUE
      );
      PERFORM public.rpc_store_idempotent_response(p_operation_key, 'factory_market_list', v_response);
      RETURN v_response;
    END IF;

    RETURN public.rpc_std_error('listing_active', 'Fabbrica già in vendita.');
  END IF;

  INSERT INTO public.factory_market_listings (
    "factoryId",
    "sellerId",
    "askingPrice",
    status
  )
  VALUES (
    p_factory_id,
    p_seller_id,
    FLOOR(p_asking_price),
    'active'
  )
  RETURNING *
  INTO v_listing;

  UPDATE public.factories
  SET
    "listedForSale" = TRUE,
    "salePrice" = FLOOR(p_asking_price)
  WHERE id = p_factory_id;

  v_response := jsonb_build_object(
    'success', TRUE,
    'listing', to_jsonb(v_listing)
  );
  PERFORM public.rpc_store_idempotent_response(p_operation_key, 'factory_market_list', v_response);
  RETURN v_response;
END;
$$;

CREATE OR REPLACE FUNCTION public.rpc_factory_market_cancel_atomic(
  p_listing_id UUID,
  p_seller_id UUID,
  p_operation_key TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_listing public.factory_market_listings%ROWTYPE;
  v_response JSONB;
BEGIN
  v_response := public.rpc_get_idempotent_response(p_operation_key, 'factory_market_cancel');
  IF v_response IS NOT NULL THEN
    RETURN v_response;
  END IF;

  IF p_listing_id IS NULL OR p_seller_id IS NULL THEN
    RETURN public.rpc_std_error('invalid_input', 'ID annuncio mancante.');
  END IF;

  SELECT *
  INTO v_listing
  FROM public.factory_market_listings
  WHERE id = p_listing_id
  FOR UPDATE;

  IF v_listing.id IS NULL THEN
    RETURN public.rpc_std_error('listing_not_found', 'Annuncio non trovato.');
  END IF;

  IF v_listing."sellerId" <> p_seller_id THEN
    RETURN public.rpc_std_error('forbidden', 'Non sei il venditore.');
  END IF;

  IF v_listing.status = 'cancelled' THEN
    v_response := jsonb_build_object('success', TRUE, 'cancelled', TRUE);
    PERFORM public.rpc_store_idempotent_response(p_operation_key, 'factory_market_cancel', v_response);
    RETURN v_response;
  END IF;

  IF v_listing.status <> 'active' THEN
    RETURN public.rpc_std_error('listing_not_active', 'Annuncio non attivo.');
  END IF;

  UPDATE public.factory_market_listings
  SET status = 'cancelled'
  WHERE id = p_listing_id;

  UPDATE public.factories
  SET
    "listedForSale" = FALSE,
    "salePrice" = 0
  WHERE id = v_listing."factoryId";

  v_response := jsonb_build_object('success', TRUE, 'cancelled', TRUE);
  PERFORM public.rpc_store_idempotent_response(p_operation_key, 'factory_market_cancel', v_response);
  RETURN v_response;
END;
$$;

CREATE OR REPLACE FUNCTION public.rpc_create_party_atomic(
  p_user_id UUID,
  p_username TEXT,
  p_region_id TEXT,
  p_name TEXT,
  p_ideology TEXT DEFAULT '',
  p_tag TEXT DEFAULT '',
  p_description TEXT DEFAULT '',
  p_logo TEXT DEFAULT '',
  p_operation_key TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user public.users%ROWTYPE;
  v_existing_party_id TEXT;
  v_party_id TEXT;
  v_now BIGINT := (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT;
  v_deduct JSONB;
  v_response JSONB;
BEGIN
  v_response := public.rpc_get_idempotent_response(p_operation_key, 'party_create');
  IF v_response IS NOT NULL THEN
    RETURN v_response;
  END IF;

  IF p_user_id IS NULL OR COALESCE(trim(p_name), '') = '' THEN
    RETURN public.rpc_std_error('invalid_input', 'Nome obbligatorio.');
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('party:create:' || p_user_id::TEXT));

  SELECT *
  INTO v_user
  FROM public.users
  WHERE id = p_user_id
  FOR UPDATE;

  IF v_user.id IS NULL THEN
    RETURN public.rpc_std_error('user_not_found', 'Utente non trovato.');
  END IF;

  SELECT "partyId"
  INTO v_existing_party_id
  FROM public.party_members
  WHERE "userId" = p_user_id
  LIMIT 1
  FOR UPDATE;

  IF v_existing_party_id IS NOT NULL THEN
    RETURN public.rpc_std_error('already_member', 'Sei già membro di un partito.');
  END IF;

  v_deduct := public.safe_deduct_currency(p_user_id, 0, 100, 0);
  IF COALESCE((v_deduct->>'success')::BOOLEAN, FALSE) = FALSE THEN
    RETURN COALESCE(v_deduct, public.rpc_std_error('insufficient_gold', 'Fondi in Gold insufficienti (costa 100 Gold).'));
  END IF;

  v_party_id := substr(md5(random()::TEXT || clock_timestamp()::TEXT), 1, 9);

  INSERT INTO public.parties (
    id,
    name,
    ideology,
    tag,
    description,
    logo,
    "regionId",
    "leaderUserId",
    "createdAt"
  )
  VALUES (
    v_party_id,
    trim(p_name),
    COALESCE(p_ideology, ''),
    COALESCE(p_tag, ''),
    COALESCE(p_description, ''),
    COALESCE(p_logo, ''),
    COALESCE(NULLIF(trim(p_region_id), ''), COALESCE(v_user."residenceId", 'IT')),
    p_user_id,
    v_now
  );

  INSERT INTO public.party_members ("userId", "partyId", role, "joinedAt")
  VALUES (p_user_id, v_party_id, 'leader', v_now);

  INSERT INTO public.party_logs (id, "partyId", action, details, timestamp)
  VALUES (
    substr(md5(random()::TEXT || clock_timestamp()::TEXT), 1, 9),
    v_party_id,
    'created',
    format('Partito creato da %s in %s', COALESCE(NULLIF(trim(p_username), ''), 'Sconosciuto'), COALESCE(NULLIF(trim(p_region_id), ''), COALESCE(v_user."residenceId", 'IT'))),
    v_now
  );

  v_response := jsonb_build_object('success', TRUE, 'partyId', v_party_id);
  PERFORM public.rpc_store_idempotent_response(p_operation_key, 'party_create', v_response);
  RETURN v_response;
END;
$$;

CREATE OR REPLACE FUNCTION public.rpc_join_party_atomic(
  p_invite_id TEXT,
  p_user_id UUID,
  p_operation_key TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_invite public.party_invites%ROWTYPE;
  v_existing_party_id TEXT;
  v_response JSONB;
BEGIN
  v_response := public.rpc_get_idempotent_response(p_operation_key, 'party_join');
  IF v_response IS NOT NULL THEN
    RETURN v_response;
  END IF;

  IF COALESCE(trim(p_invite_id), '') = '' OR p_user_id IS NULL THEN
    RETURN public.rpc_std_error('invalid_input', 'Invito non valido.');
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('party:join:' || p_user_id::TEXT));

  SELECT *
  INTO v_invite
  FROM public.party_invites
  WHERE id = trim(p_invite_id)
    AND "userId" = p_user_id
  FOR UPDATE;

  IF v_invite.id IS NULL THEN
    RETURN public.rpc_std_error('invite_not_found', 'Invito non trovato.');
  END IF;

  IF v_invite.status = 'accepted' THEN
    v_response := jsonb_build_object('success', TRUE, 'partyId', v_invite."partyId");
    PERFORM public.rpc_store_idempotent_response(p_operation_key, 'party_join', v_response);
    RETURN v_response;
  END IF;

  IF v_invite.status <> 'pending' THEN
    RETURN public.rpc_std_error('invite_invalid', 'L''invito non è più valido.');
  END IF;

  SELECT "partyId"
  INTO v_existing_party_id
  FROM public.party_members
  WHERE "userId" = p_user_id
  LIMIT 1
  FOR UPDATE;

  IF v_existing_party_id IS NOT NULL THEN
    RETURN public.rpc_std_error('already_member', 'Fai già parte di un partito.');
  END IF;

  UPDATE public.party_invites
  SET status = 'accepted'
  WHERE id = v_invite.id;

  INSERT INTO public.party_members ("userId", "partyId", role, "joinedAt")
  VALUES (p_user_id, v_invite."partyId", 'member', (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT);

  UPDATE public.party_invites
  SET status = 'rejected'
  WHERE "userId" = p_user_id
    AND status = 'pending'
    AND id <> v_invite.id;

  v_response := jsonb_build_object('success', TRUE, 'partyId', v_invite."partyId");
  PERFORM public.rpc_store_idempotent_response(p_operation_key, 'party_join', v_response);
  RETURN v_response;
END;
$$;

CREATE OR REPLACE FUNCTION public.rpc_create_bloc_atomic(
  p_user_id UUID,
  p_state_id TEXT,
  p_name TEXT,
  p_description TEXT DEFAULT '',
  p_logo TEXT DEFAULT '',
  p_operation_key TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_region public.regions%ROWTYPE;
  v_existing RECORD;
  v_bloc_id TEXT;
  v_now TIMESTAMPTZ := NOW();
  v_response JSONB;
BEGIN
  v_response := public.rpc_get_idempotent_response(p_operation_key, 'bloc_create');
  IF v_response IS NOT NULL THEN
    RETURN v_response;
  END IF;

  IF p_user_id IS NULL OR COALESCE(trim(p_state_id), '') = '' OR COALESCE(trim(p_name), '') = '' THEN
    RETURN public.rpc_std_error('invalid_input', 'Nome e Stato sono obbligatori.');
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('bloc:create:' || trim(p_state_id)));

  SELECT *
  INTO v_region
  FROM public.regions
  WHERE id = trim(p_state_id)
  FOR UPDATE;

  IF v_region.id IS NULL THEN
    RETURN public.rpc_std_error('region_not_found', 'Regione non trovata.');
  END IF;

  IF v_region."ownerUserId" <> p_user_id THEN
    RETURN public.rpc_std_error('forbidden', 'Solo il Leader dello Stato può creare un blocco a suo nome.');
  END IF;

  SELECT 1
  INTO v_existing
  FROM public.bloc_memberships
  WHERE "stateId" = trim(p_state_id)
    AND status = 'active'
  LIMIT 1
  FOR UPDATE;

  IF FOUND THEN
    RETURN public.rpc_std_error('already_member', 'Questo Stato fa già parte di un blocco.');
  END IF;

  SELECT 1
  INTO v_existing
  FROM public.blocs
  WHERE name = trim(p_name)
  LIMIT 1;

  IF FOUND THEN
    RETURN public.rpc_std_error('name_conflict', 'Esiste già un blocco con questo nome.');
  END IF;

  v_bloc_id := substr(md5(random()::TEXT || clock_timestamp()::TEXT), 1, 9);

  INSERT INTO public.blocs (
    id, name, logo, description, "ownerStateId", "ownerUserId", "createdAt"
  )
  VALUES (
    v_bloc_id, trim(p_name), COALESCE(p_logo, ''), COALESCE(p_description, ''), trim(p_state_id), p_user_id, v_now
  );

  INSERT INTO public.bloc_memberships ("blocId", "stateId", status, "joinedAt")
  VALUES (v_bloc_id, trim(p_state_id), 'active', v_now);

  INSERT INTO public.bloc_regulations ("blocId", "openBorders", "defaultMilitaryAgreement", "migrationOpen")
  VALUES (v_bloc_id, 0, 0, 0)
  ON CONFLICT ("blocId") DO NOTHING;

  v_response := jsonb_build_object('success', TRUE, 'blocId', v_bloc_id);
  PERFORM public.rpc_store_idempotent_response(p_operation_key, 'bloc_create', v_response);
  RETURN v_response;
END;
$$;

CREATE OR REPLACE FUNCTION public.rpc_apply_to_bloc_atomic(
  p_bloc_id TEXT,
  p_user_id UUID,
  p_state_id TEXT,
  p_operation_key TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_region public.regions%ROWTYPE;
  v_response JSONB;
BEGIN
  v_response := public.rpc_get_idempotent_response(p_operation_key, 'bloc_apply');
  IF v_response IS NOT NULL THEN
    RETURN v_response;
  END IF;

  IF COALESCE(trim(p_bloc_id), '') = '' OR p_user_id IS NULL OR COALESCE(trim(p_state_id), '') = '' THEN
    RETURN public.rpc_std_error('invalid_input', 'Stato non specificato.');
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('bloc:apply:' || trim(p_bloc_id) || ':' || trim(p_state_id)));

  SELECT *
  INTO v_region
  FROM public.regions
  WHERE id = trim(p_state_id)
  FOR UPDATE;

  IF v_region.id IS NULL THEN
    RETURN public.rpc_std_error('region_not_found', 'Regione non trovata.');
  END IF;

  IF v_region."ownerUserId" <> p_user_id THEN
    RETURN public.rpc_std_error('forbidden', 'Solo il leader può candidarsi.');
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.bloc_memberships
    WHERE "stateId" = trim(p_state_id)
      AND status = 'active'
  ) THEN
    RETURN public.rpc_std_error('already_member', 'Questo Stato è già in un blocco.');
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.bloc_applications
    WHERE "blocId" = trim(p_bloc_id)
      AND "stateId" = trim(p_state_id)
      AND status = 'pending'
  ) THEN
    v_response := jsonb_build_object('success', TRUE, 'alreadyPending', TRUE);
    PERFORM public.rpc_store_idempotent_response(p_operation_key, 'bloc_apply', v_response);
    RETURN v_response;
  END IF;

  INSERT INTO public.bloc_applications (id, "blocId", "stateId", "createdAt", status)
  VALUES (
    substr(md5(random()::TEXT || clock_timestamp()::TEXT), 1, 9),
    trim(p_bloc_id),
    trim(p_state_id),
    NOW(),
    'pending'
  );

  v_response := jsonb_build_object('success', TRUE);
  PERFORM public.rpc_store_idempotent_response(p_operation_key, 'bloc_apply', v_response);
  RETURN v_response;
END;
$$;

CREATE OR REPLACE FUNCTION public.rpc_vote_bloc_application_atomic(
  p_application_id TEXT,
  p_voter_user_id UUID,
  p_voter_state_id TEXT,
  p_choice INT,
  p_operation_key TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_application public.bloc_applications%ROWTYPE;
  v_yes_votes INT := 0;
  v_no_votes INT := 0;
  v_active_count INT := 0;
  v_required_to_pass INT := 0;
  v_required_to_reject INT := 0;
  v_result TEXT := 'pending';
  v_response JSONB;
BEGIN
  v_response := public.rpc_get_idempotent_response(p_operation_key, 'bloc_application_vote');
  IF v_response IS NOT NULL THEN
    RETURN v_response;
  END IF;

  IF COALESCE(trim(p_application_id), '') = '' OR p_voter_user_id IS NULL OR COALESCE(trim(p_voter_state_id), '') = '' THEN
    RETURN public.rpc_std_error('invalid_input', 'Voto non valido.');
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('bloc:application:' || trim(p_application_id)));

  SELECT *
  INTO v_application
  FROM public.bloc_applications
  WHERE id = trim(p_application_id)
  FOR UPDATE;

  IF v_application.id IS NULL OR v_application.status <> 'pending' THEN
    RETURN public.rpc_std_error('invalid_application', 'Candidatura non valida.');
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.bloc_memberships
    WHERE "blocId" = v_application."blocId"
      AND "stateId" = trim(p_voter_state_id)
      AND status = 'active'
  ) THEN
    RETURN public.rpc_std_error('forbidden', 'Stato non autorizzato a votare.');
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.regions
    WHERE id = trim(p_voter_state_id)
      AND "ownerUserId" = p_voter_user_id
  ) THEN
    RETURN public.rpc_std_error('forbidden', 'Solo il leader può votare.');
  END IF;

  INSERT INTO public.bloc_votes ("targetId", "voterStateId", choice, "createdAt")
  VALUES (trim(p_application_id), trim(p_voter_state_id), CASE WHEN COALESCE(p_choice, 0) <> 0 THEN 1 ELSE 0 END, NOW())
  ON CONFLICT ("targetId", "voterStateId") DO NOTHING;

  SELECT COUNT(*)::INT
  INTO v_active_count
  FROM public.bloc_memberships
  WHERE "blocId" = v_application."blocId"
    AND status = 'active';

  SELECT
    COUNT(*) FILTER (WHERE choice = 1)::INT,
    COUNT(*) FILTER (WHERE choice = 0)::INT
  INTO v_yes_votes, v_no_votes
  FROM public.bloc_votes
  WHERE "targetId" = trim(p_application_id);

  v_required_to_pass := FLOOR(v_active_count / 2.0)::INT + 1;
  v_required_to_reject := v_active_count - v_required_to_pass + 1;

  IF v_yes_votes >= v_required_to_pass THEN
    UPDATE public.bloc_applications
    SET status = 'approved'
    WHERE id = v_application.id;

    INSERT INTO public.bloc_memberships ("blocId", "stateId", status, "joinedAt")
    VALUES (v_application."blocId", v_application."stateId", 'active', NOW())
    ON CONFLICT DO NOTHING;

    v_result := 'approved';
  ELSIF v_no_votes >= v_required_to_reject OR (v_yes_votes + v_no_votes) >= v_active_count THEN
    UPDATE public.bloc_applications
    SET status = 'rejected'
    WHERE id = v_application.id;

    v_result := 'rejected';
  END IF;

  v_response := jsonb_build_object('success', TRUE, 'result', v_result, 'yesVotes', v_yes_votes, 'noVotes', v_no_votes);
  PERFORM public.rpc_store_idempotent_response(p_operation_key, 'bloc_application_vote', v_response);
  RETURN v_response;
END;
$$;

CREATE OR REPLACE FUNCTION public.rpc_propose_bloc_regulation_atomic(
  p_bloc_id TEXT,
  p_proposer_user_id UUID,
  p_proposer_state_id TEXT,
  p_type TEXT,
  p_proposed_value INT,
  p_operation_key TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_prop_id TEXT;
  v_response JSONB;
BEGIN
  v_response := public.rpc_get_idempotent_response(p_operation_key, 'bloc_regulation_propose');
  IF v_response IS NOT NULL THEN
    RETURN v_response;
  END IF;

  IF COALESCE(trim(p_bloc_id), '') = '' OR p_proposer_user_id IS NULL OR COALESCE(trim(p_proposer_state_id), '') = '' THEN
    RETURN public.rpc_std_error('invalid_input', 'Proposta non valida.');
  END IF;

  IF p_type NOT IN ('openBorders', 'migrationOpen', 'defaultMilitaryAgreement') THEN
    RETURN public.rpc_std_error('invalid_type', 'Tipo non valido.');
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('bloc:regulation:' || trim(p_bloc_id) || ':' || trim(p_type)));

  IF NOT EXISTS (
    SELECT 1
    FROM public.bloc_memberships
    WHERE "blocId" = trim(p_bloc_id)
      AND "stateId" = trim(p_proposer_state_id)
      AND status = 'active'
  ) THEN
    RETURN public.rpc_std_error('forbidden', 'Non sei un membro attivo.');
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.regions
    WHERE id = trim(p_proposer_state_id)
      AND "ownerUserId" = p_proposer_user_id
  ) THEN
    RETURN public.rpc_std_error('forbidden', 'Solo il leader può proporre.');
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.bloc_regulation_proposals
    WHERE "blocId" = trim(p_bloc_id)
      AND type = p_type
      AND status = 'pending'
  ) THEN
    RETURN public.rpc_std_error('duplicate_pending', 'Proposta già pendente.');
  END IF;

  v_prop_id := substr(md5(random()::TEXT || clock_timestamp()::TEXT), 1, 9);

  INSERT INTO public.bloc_regulation_proposals (id, "blocId", type, "proposedValue", "createdAt", status)
  VALUES (v_prop_id, trim(p_bloc_id), p_type, CASE WHEN COALESCE(p_proposed_value, 0) <> 0 THEN 1 ELSE 0 END, NOW(), 'pending');

  INSERT INTO public.bloc_votes ("targetId", "voterStateId", choice, "createdAt")
  VALUES (v_prop_id, trim(p_proposer_state_id), 1, NOW())
  ON CONFLICT ("targetId", "voterStateId") DO NOTHING;

  v_response := jsonb_build_object('success', TRUE, 'proposalId', v_prop_id);
  PERFORM public.rpc_store_idempotent_response(p_operation_key, 'bloc_regulation_propose', v_response);
  RETURN v_response;
END;
$$;

CREATE OR REPLACE FUNCTION public.rpc_vote_bloc_regulation_atomic(
  p_proposal_id TEXT,
  p_voter_user_id UUID,
  p_voter_state_id TEXT,
  p_choice INT,
  p_operation_key TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_proposal public.bloc_regulation_proposals%ROWTYPE;
  v_yes_votes INT := 0;
  v_no_votes INT := 0;
  v_active_count INT := 0;
  v_required_to_pass INT := 0;
  v_required_to_reject INT := 0;
  v_result TEXT := 'pending';
  v_response JSONB;
BEGIN
  v_response := public.rpc_get_idempotent_response(p_operation_key, 'bloc_regulation_vote');
  IF v_response IS NOT NULL THEN
    RETURN v_response;
  END IF;

  IF COALESCE(trim(p_proposal_id), '') = '' OR p_voter_user_id IS NULL OR COALESCE(trim(p_voter_state_id), '') = '' THEN
    RETURN public.rpc_std_error('invalid_input', 'Voto non valido.');
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('bloc:proposal:' || trim(p_proposal_id)));

  SELECT *
  INTO v_proposal
  FROM public.bloc_regulation_proposals
  WHERE id = trim(p_proposal_id)
  FOR UPDATE;

  IF v_proposal.id IS NULL OR v_proposal.status <> 'pending' THEN
    RETURN public.rpc_std_error('invalid_proposal', 'Proposta non valida.');
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.bloc_memberships
    WHERE "blocId" = v_proposal."blocId"
      AND "stateId" = trim(p_voter_state_id)
      AND status = 'active'
  ) THEN
    RETURN public.rpc_std_error('forbidden', 'Non sei membro del blocco.');
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.regions
    WHERE id = trim(p_voter_state_id)
      AND "ownerUserId" = p_voter_user_id
  ) THEN
    RETURN public.rpc_std_error('forbidden', 'Solo il leader può votare.');
  END IF;

  INSERT INTO public.bloc_votes ("targetId", "voterStateId", choice, "createdAt")
  VALUES (trim(p_proposal_id), trim(p_voter_state_id), CASE WHEN COALESCE(p_choice, 0) <> 0 THEN 1 ELSE 0 END, NOW())
  ON CONFLICT ("targetId", "voterStateId") DO NOTHING;

  SELECT COUNT(*)::INT
  INTO v_active_count
  FROM public.bloc_memberships
  WHERE "blocId" = v_proposal."blocId"
    AND status = 'active';

  SELECT
    COUNT(*) FILTER (WHERE choice = 1)::INT,
    COUNT(*) FILTER (WHERE choice = 0)::INT
  INTO v_yes_votes, v_no_votes
  FROM public.bloc_votes
  WHERE "targetId" = trim(p_proposal_id);

  v_required_to_pass := FLOOR(v_active_count / 2.0)::INT + 1;
  v_required_to_reject := v_active_count - v_required_to_pass + 1;

  IF v_yes_votes >= v_required_to_pass THEN
    UPDATE public.bloc_regulation_proposals
    SET status = 'approved'
    WHERE id = v_proposal.id;

    UPDATE public.bloc_regulations
    SET
      "openBorders" = CASE WHEN v_proposal.type = 'openBorders' THEN v_proposal."proposedValue" ELSE "openBorders" END,
      "migrationOpen" = CASE WHEN v_proposal.type = 'migrationOpen' THEN v_proposal."proposedValue" ELSE "migrationOpen" END,
      "defaultMilitaryAgreement" = CASE WHEN v_proposal.type = 'defaultMilitaryAgreement' THEN v_proposal."proposedValue" ELSE "defaultMilitaryAgreement" END
    WHERE "blocId" = v_proposal."blocId";

    v_result := 'approved';
  ELSIF v_no_votes >= v_required_to_reject OR (v_yes_votes + v_no_votes) >= v_active_count THEN
    UPDATE public.bloc_regulation_proposals
    SET status = 'rejected'
    WHERE id = v_proposal.id;

    v_result := 'rejected';
  END IF;

  v_response := jsonb_build_object('success', TRUE, 'result', v_result, 'yesVotes', v_yes_votes, 'noVotes', v_no_votes);
  PERFORM public.rpc_store_idempotent_response(p_operation_key, 'bloc_regulation_vote', v_response);
  RETURN v_response;
END;
$$;

-- ============================================================
-- Governance atomic RPCs (budget, ministers, leader votes, sanctions)
-- ============================================================

CREATE OR REPLACE FUNCTION public.rpc_budget_donate_atomic(
  p_user_id UUID,
  p_entity_id TEXT,
  p_amount BIGINT,
  p_currency TEXT,
  p_operation_key TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user public.users%ROWTYPE;
  v_money_delta BIGINT;
  v_conversion_rate BIGINT := 500000;
  v_deduct JSONB;
  v_response JSONB;
BEGIN
  v_response := public.rpc_get_idempotent_response(p_operation_key, 'budget_donate');
  IF v_response IS NOT NULL THEN
    RETURN v_response;
  END IF;

  IF p_user_id IS NULL OR COALESCE(trim(p_entity_id), '') = '' OR COALESCE(p_amount, 0) <= 0 THEN
    RETURN public.rpc_std_error('invalid_input', 'Dati donazione non validi.');
  END IF;
  IF p_currency NOT IN ('EUR', 'GOLD') THEN
    RETURN public.rpc_std_error('invalid_input', 'Valuta non supportata.', jsonb_build_object('currency', p_currency));
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('budget:donate:' || p_user_id::TEXT || ':' || trim(p_entity_id)));

  SELECT *
  INTO v_user
  FROM public.users
  WHERE id = p_user_id
  FOR UPDATE;

  IF v_user.id IS NULL THEN
    RETURN public.rpc_std_error('user_not_found', 'Utente non trovato.');
  END IF;

  IF COALESCE(v_user.level, 0) < 60 THEN
    RETURN public.rpc_std_error('forbidden', 'Devi essere al Livello 60 per effettuare donazioni di Stato.');
  END IF;

  v_money_delta := CASE
    WHEN p_currency = 'GOLD' THEN p_amount * v_conversion_rate
    ELSE p_amount
  END;

  v_deduct := public.safe_deduct_currency(
    p_user_id,
    CASE WHEN p_currency = 'EUR' THEN p_amount ELSE 0 END,
    CASE WHEN p_currency = 'GOLD' THEN p_amount ELSE 0 END,
    0
  );

  IF COALESCE((v_deduct->>'success')::BOOLEAN, FALSE) = FALSE THEN
    RETURN COALESCE(v_deduct, public.rpc_std_error('insufficient_funds', 'Fondi insufficienti.'));
  END IF;

  PERFORM public.add_budget_transaction(
    'REGION',
    trim(p_entity_id),
    'INCOME',
    'DONATION',
    v_money_delta,
    '{}'::jsonb,
    p_user_id,
    jsonb_build_object('originalCurrency', p_currency, 'originalAmount', p_amount)
  );

  v_response := jsonb_build_object('success', TRUE, 'donated', v_money_delta);
  PERFORM public.rpc_store_idempotent_response(p_operation_key, 'budget_donate', v_response);
  RETURN v_response;
END;
$$;

CREATE OR REPLACE FUNCTION public.rpc_budget_clean_radiation_atomic(
  p_user_id UUID,
  p_region_id TEXT,
  p_operation_key TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_region public.regions%ROWTYPE;
  v_cost BIGINT := 10000;
  v_response JSONB;
BEGIN
  v_response := public.rpc_get_idempotent_response(p_operation_key, 'budget_clean_radiation');
  IF v_response IS NOT NULL THEN
    RETURN v_response;
  END IF;

  IF p_user_id IS NULL OR COALESCE(trim(p_region_id), '') = '' THEN
    RETURN public.rpc_std_error('invalid_input', 'Nessuna regione specificata.');
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('budget:clean_radiation:' || trim(p_region_id)));

  SELECT *
  INTO v_region
  FROM public.regions
  WHERE id = trim(p_region_id)
  FOR UPDATE;

  IF v_region.id IS NULL THEN
    RETURN public.rpc_std_error('region_not_found', 'Regione non trovata.');
  END IF;

  IF v_region."ownerUserId" <> p_user_id THEN
    RETURN public.rpc_std_error('forbidden', 'Azione riservata al Leader.');
  END IF;

  IF COALESCE(v_region.radiation, 0) <= 0 THEN
    RETURN public.rpc_std_error('no_radiation', 'Nessuna radiazione da pulire.');
  END IF;

  BEGIN
    PERFORM public.add_budget_transaction(
      'REGION',
      v_region.id,
      'EXPENSE',
      'RADIATION_CLEAN',
      -v_cost,
      '{}'::jsonb,
      p_user_id,
      '{}'::jsonb
    );
  EXCEPTION
    WHEN OTHERS THEN
      RETURN public.rpc_std_error('insufficient_budget', 'Fondi insufficienti.', jsonb_build_object('cost', v_cost), FALSE, FALSE);
  END;

  UPDATE public.regions
  SET radiation = GREATEST(0, COALESCE(radiation, 0) - 10)
  WHERE id = v_region.id;

  v_response := jsonb_build_object('success', TRUE, 'cleaned', TRUE);
  PERFORM public.rpc_store_idempotent_response(p_operation_key, 'budget_clean_radiation', v_response);
  RETURN v_response;
END;
$$;

CREATE OR REPLACE FUNCTION public.rpc_ministers_assign_atomic(
  p_leader_user_id UUID,
  p_state_id TEXT,
  p_user_id UUID,
  p_role TEXT,
  p_operation_key TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_region public.regions%ROWTYPE;
  v_title TEXT;
  v_existing_state TEXT;
  v_response JSONB;
BEGIN
  v_response := public.rpc_get_idempotent_response(p_operation_key, 'ministers_assign');
  IF v_response IS NOT NULL THEN
    RETURN v_response;
  END IF;

  IF p_leader_user_id IS NULL OR p_user_id IS NULL OR COALESCE(trim(p_state_id), '') = '' OR COALESCE(trim(p_role), '') = '' THEN
    RETURN public.rpc_std_error('invalid_input', 'Dati mancanti.');
  END IF;
  IF p_role NOT IN ('economics', 'foreign') THEN
    RETURN public.rpc_std_error('role_not_supported', 'Ruolo non valido.', jsonb_build_object('role', p_role));
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('ministers:assign:' || trim(p_state_id) || ':' || trim(p_role)));

  SELECT *
  INTO v_region
  FROM public.regions
  WHERE id = trim(p_state_id)
  FOR UPDATE;

  IF v_region.id IS NULL THEN
    RETURN public.rpc_std_error('region_not_found', 'Regione non trovata.');
  END IF;

  IF v_region."ownerUserId" <> p_leader_user_id THEN
    RETURN public.rpc_std_error('forbidden', 'Solo il Leader può nominare i ministri.');
  END IF;

  IF p_role = 'foreign' AND v_region."governmentForm" IN ('DICTATORSHIP', 'ONE_PARTY_SYSTEM') THEN
    RETURN public.rpc_std_error('forbidden', 'Questa carica non esiste in questa forma di governo.');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = p_user_id) THEN
    RETURN public.rpc_std_error('user_not_found', 'Utente non trovato.');
  END IF;

  SELECT "stateId"
  INTO v_existing_state
  FROM public.ministers
  WHERE "userId" = p_user_id
    AND status = 'ACTIVE'
  LIMIT 1
  FOR UPDATE;

  IF v_existing_state IS NOT NULL THEN
    RETURN public.rpc_std_error('already_minister', 'L''utente ricopre già una carica ministeriale in un altro Stato.', jsonb_build_object('stateId', v_existing_state));
  END IF;

  v_title := CASE
    WHEN p_role = 'economics' AND v_region."governmentForm" = 'DICTATORSHIP' THEN 'Economic Advisor'
    WHEN p_role = 'economics' THEN 'Minister of Economics'
    ELSE 'Foreign Minister'
  END;

  UPDATE public.ministers
  SET status = 'REVOKED'
  WHERE "stateId" = v_region.id
    AND role = p_role
    AND status = 'ACTIVE';

  INSERT INTO public.ministers (
    id,
    "stateId",
    "userId",
    role,
    title,
    "assignedByUserId",
    "assignedAt",
    status
  )
  VALUES (
    substr(md5(random()::TEXT || clock_timestamp()::TEXT), 1, 9),
    v_region.id,
    p_user_id,
    p_role,
    v_title,
    p_leader_user_id,
    (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT,
    'ACTIVE'
  );

  IF p_role = 'economics' THEN
    UPDATE public.regions SET "economicAdviserId" = p_user_id WHERE id = v_region.id;
  ELSE
    UPDATE public.regions SET "foreignMinisterId" = p_user_id WHERE id = v_region.id;
  END IF;

  v_response := jsonb_build_object('success', TRUE, 'title', v_title);
  PERFORM public.rpc_store_idempotent_response(p_operation_key, 'ministers_assign', v_response);
  RETURN v_response;
END;
$$;

CREATE OR REPLACE FUNCTION public.rpc_ministers_revoke_atomic(
  p_leader_user_id UUID,
  p_state_id TEXT,
  p_role TEXT,
  p_operation_key TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_region public.regions%ROWTYPE;
  v_response JSONB;
BEGIN
  v_response := public.rpc_get_idempotent_response(p_operation_key, 'ministers_revoke');
  IF v_response IS NOT NULL THEN
    RETURN v_response;
  END IF;

  IF p_leader_user_id IS NULL OR COALESCE(trim(p_state_id), '') = '' OR COALESCE(trim(p_role), '') = '' THEN
    RETURN public.rpc_std_error('invalid_input', 'Dati mancanti.');
  END IF;
  IF p_role NOT IN ('economics', 'foreign') THEN
    RETURN public.rpc_std_error('role_not_supported', 'Ruolo non valido.', jsonb_build_object('role', p_role));
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('ministers:revoke:' || trim(p_state_id) || ':' || trim(p_role)));

  SELECT *
  INTO v_region
  FROM public.regions
  WHERE id = trim(p_state_id)
  FOR UPDATE;

  IF v_region.id IS NULL THEN
    RETURN public.rpc_std_error('region_not_found', 'Regione non trovata.');
  END IF;

  IF v_region."ownerUserId" <> p_leader_user_id THEN
    RETURN public.rpc_std_error('forbidden', 'Solo il Leader può revocare i ministri.');
  END IF;

  UPDATE public.ministers
  SET status = 'REVOKED'
  WHERE "stateId" = v_region.id
    AND role = p_role
    AND status = 'ACTIVE';

  IF p_role = 'economics' THEN
    UPDATE public.regions SET "economicAdviserId" = NULL WHERE id = v_region.id;
  ELSE
    UPDATE public.regions SET "foreignMinisterId" = NULL WHERE id = v_region.id;
  END IF;

  v_response := jsonb_build_object('success', TRUE);
  PERFORM public.rpc_store_idempotent_response(p_operation_key, 'ministers_revoke', v_response);
  RETURN v_response;
END;
$$;

CREATE OR REPLACE FUNCTION public.rpc_leader_vote_atomic(
  p_region_id TEXT,
  p_voter_id UUID,
  p_candidate_id UUID,
  p_operation_key TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user public.users%ROWTYPE;
  v_existing public.leader_votes%ROWTYPE;
  v_response JSONB;
BEGIN
  v_response := public.rpc_get_idempotent_response(p_operation_key, 'leader_vote');
  IF v_response IS NOT NULL THEN
    RETURN v_response;
  END IF;

  IF COALESCE(trim(p_region_id), '') = '' OR p_voter_id IS NULL OR p_candidate_id IS NULL THEN
    RETURN public.rpc_std_error('invalid_input', 'Voto non valido.');
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('leader:vote:' || trim(p_region_id) || ':' || p_voter_id::TEXT));

  SELECT *
  INTO v_user
  FROM public.users
  WHERE id = p_voter_id
  FOR UPDATE;

  IF v_user.id IS NULL THEN
    RETURN public.rpc_std_error('forbidden', 'Utente non autorizzato.');
  END IF;

  IF COALESCE(v_user."residenceId", '') <> trim(p_region_id) THEN
    RETURN public.rpc_std_error('forbidden', 'Devi essere cittadino per votare.');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.leader_candidates
    WHERE "regionId" = trim(p_region_id)
      AND "userId" = p_candidate_id
  ) THEN
    RETURN public.rpc_std_error('candidate_not_found', 'Candidato non trovato.');
  END IF;

  SELECT *
  INTO v_existing
  FROM public.leader_votes
  WHERE "regionId" = trim(p_region_id)
    AND "voterId" = p_voter_id
  FOR UPDATE;

  IF v_existing."voterId" IS NOT NULL THEN
    IF v_existing."candidateId" = p_candidate_id THEN
      v_response := jsonb_build_object('success', TRUE, 'alreadyVoted', TRUE);
      PERFORM public.rpc_store_idempotent_response(p_operation_key, 'leader_vote', v_response);
      RETURN v_response;
    END IF;
    RETURN public.rpc_std_error('already_voted', 'Hai già votato.', jsonb_build_object('candidateId', v_existing."candidateId"));
  END IF;

  INSERT INTO public.leader_votes ("regionId", "voterId", "candidateId")
  VALUES (trim(p_region_id), p_voter_id, p_candidate_id);

  UPDATE public.leader_candidates
  SET votes = COALESCE(votes, 0) + 1
  WHERE "regionId" = trim(p_region_id)
    AND "userId" = p_candidate_id;

  v_response := jsonb_build_object('success', TRUE);
  PERFORM public.rpc_store_idempotent_response(p_operation_key, 'leader_vote', v_response);
  RETURN v_response;
END;
$$;

CREATE OR REPLACE FUNCTION public.rpc_sanctions_apply_atomic(
  p_actor_user_id UUID,
  p_from_state_id TEXT,
  p_target_state_id TEXT,
  p_operation_key TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_from public.regions%ROWTYPE;
  v_response JSONB;
  v_sanction_id TEXT;
BEGIN
  v_response := public.rpc_get_idempotent_response(p_operation_key, 'sanctions_apply');
  IF v_response IS NOT NULL THEN
    RETURN v_response;
  END IF;

  IF p_actor_user_id IS NULL OR COALESCE(trim(p_from_state_id), '') = '' OR COALESCE(trim(p_target_state_id), '') = '' THEN
    RETURN public.rpc_std_error('invalid_input', 'Parametri non validi.');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.regions WHERE id = trim(p_target_state_id)) THEN
    RETURN public.rpc_std_error('target_not_found', 'Regione bersaglio inesistente.');
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('sanctions:apply:' || trim(p_from_state_id) || ':' || trim(p_target_state_id)));

  SELECT *
  INTO v_from
  FROM public.regions
  WHERE id = trim(p_from_state_id)
  FOR UPDATE;

  IF v_from.id IS NULL THEN
    RETURN public.rpc_std_error('region_not_found', 'Regione non trovata.');
  END IF;

  IF v_from."ownerUserId" <> p_actor_user_id
     AND NOT EXISTS (
       SELECT 1 FROM public.ministers
       WHERE "stateId" = v_from.id
         AND "userId" = p_actor_user_id
         AND role = 'economics'
         AND status = 'ACTIVE'
     ) THEN
    RETURN public.rpc_std_error('forbidden', 'Autorizzazione insufficiente.');
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.sanctions
    WHERE "fromStateId" = v_from.id
      AND "targetStateId" = trim(p_target_state_id)
      AND status = 'ACTIVE'
  ) THEN
    v_response := jsonb_build_object('success', TRUE, 'alreadyActive', TRUE);
    PERFORM public.rpc_store_idempotent_response(p_operation_key, 'sanctions_apply', v_response);
    RETURN v_response;
  END IF;

  v_sanction_id := substr(md5(random()::TEXT || clock_timestamp()::TEXT), 1, 9);

  INSERT INTO public.sanctions (
    id,
    "fromStateId",
    "targetStateId",
    status,
    "createdAt",
    "createdByUserId"
  )
  VALUES (
    v_sanction_id,
    v_from.id,
    trim(p_target_state_id),
    'ACTIVE',
    NOW(),
    p_actor_user_id
  );

  v_response := jsonb_build_object('success', TRUE, 'sanctionId', v_sanction_id);
  PERFORM public.rpc_store_idempotent_response(p_operation_key, 'sanctions_apply', v_response);
  RETURN v_response;
END;
$$;

CREATE OR REPLACE FUNCTION public.rpc_sanctions_revoke_atomic(
  p_actor_user_id UUID,
  p_sanction_id TEXT,
  p_operation_key TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_sanction public.sanctions%ROWTYPE;
  v_from public.regions%ROWTYPE;
  v_response JSONB;
BEGIN
  v_response := public.rpc_get_idempotent_response(p_operation_key, 'sanctions_revoke');
  IF v_response IS NOT NULL THEN
    RETURN v_response;
  END IF;

  IF p_actor_user_id IS NULL OR COALESCE(trim(p_sanction_id), '') = '' THEN
    RETURN public.rpc_std_error('invalid_input', 'Parametri non validi.');
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('sanctions:revoke:' || trim(p_sanction_id)));

  SELECT *
  INTO v_sanction
  FROM public.sanctions
  WHERE id = trim(p_sanction_id)
  FOR UPDATE;

  IF v_sanction.id IS NULL THEN
    RETURN public.rpc_std_error('not_found', 'Sanzione non trovata.');
  END IF;

  SELECT *
  INTO v_from
  FROM public.regions
  WHERE id = v_sanction."fromStateId"
  FOR UPDATE;

  IF v_from.id IS NULL THEN
    RETURN public.rpc_std_error('region_not_found', 'Regione non trovata.');
  END IF;

  IF v_from."ownerUserId" <> p_actor_user_id
     AND NOT EXISTS (
       SELECT 1 FROM public.ministers
       WHERE "stateId" = v_from.id
         AND "userId" = p_actor_user_id
         AND role = 'economics'
         AND status = 'ACTIVE'
     ) THEN
    RETURN public.rpc_std_error('forbidden', 'Autorizzazione insufficiente.');
  END IF;

  IF v_sanction.status = 'REVOKED' THEN
    v_response := jsonb_build_object('success', TRUE, 'revoked', TRUE);
    PERFORM public.rpc_store_idempotent_response(p_operation_key, 'sanctions_revoke', v_response);
    RETURN v_response;
  END IF;

  IF v_sanction.status <> 'ACTIVE' THEN
    RETURN public.rpc_std_error('conflict', 'Sanzione non attiva.');
  END IF;

  UPDATE public.sanctions
  SET
    status = 'REVOKED',
    "revokedAt" = NOW(),
    "revokedByUserId" = p_actor_user_id
  WHERE id = v_sanction.id;

  v_response := jsonb_build_object('success', TRUE, 'revoked', TRUE);
  PERFORM public.rpc_store_idempotent_response(p_operation_key, 'sanctions_revoke', v_response);
  RETURN v_response;
END;
$$;

-- ============================================================
-- Regional buildings + stats recompute (SQL parity with AUTONOMY_CONFIG)
-- ============================================================

CREATE OR REPLACE FUNCTION public.rpc_recalculate_region_stats_atomic(
  p_region_id TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_region_id TEXT := trim(p_region_id);
  v_hospital INT := 0;
  v_military_base INT := 0;
  v_school INT := 0;
  v_military_academy INT := 0;
  v_missile_system INT := 0;
  v_airport INT := 0;
  v_naval_port INT := 0;
  v_space_port INT := 0;
  v_real_estate_fund INT := 0;
  v_power_plant INT := 0;

  v_raw_health NUMERIC := 0;
  v_raw_military NUMERIC := 0;
  v_raw_education NUMERIC := 0;
  v_raw_development NUMERIC := 0;

  v_health_idx INT := 1;
  v_military_idx INT := 1;
  v_education_idx INT := 1;
  v_development_idx INT := 1;

  v_health_prog NUMERIC := 0;
  v_military_prog NUMERIC := 0;
  v_education_prog NUMERIC := 0;
  v_development_prog NUMERIC := 0;

  v_classification TEXT := 'underdeveloped';

  v_consumption INT := 0;
  v_generation INT := 0;
  v_efficiency INT := 0;
BEGIN
  IF COALESCE(v_region_id, '') = '' THEN
    RETURN;
  END IF;

  -- Lock region row for consistent write
  PERFORM pg_advisory_xact_lock(hashtext('region:recalc:' || v_region_id));

  -- Read building quantities
  SELECT
    COALESCE(MAX(CASE WHEN "buildingType" = 'hospital' THEN quantity END), 0),
    COALESCE(MAX(CASE WHEN "buildingType" = 'military_base' THEN quantity END), 0),
    COALESCE(MAX(CASE WHEN "buildingType" = 'school' THEN quantity END), 0),
    COALESCE(MAX(CASE WHEN "buildingType" = 'military_academy' THEN quantity END), 0),
    COALESCE(MAX(CASE WHEN "buildingType" = 'missile_system' THEN quantity END), 0),
    COALESCE(MAX(CASE WHEN "buildingType" = 'airport' THEN quantity END), 0),
    COALESCE(MAX(CASE WHEN "buildingType" = 'naval_port' THEN quantity END), 0),
    COALESCE(MAX(CASE WHEN "buildingType" = 'space_port' THEN quantity END), 0),
    COALESCE(MAX(CASE WHEN "buildingType" = 'real_estate_fund' THEN quantity END), 0),
    COALESCE(MAX(CASE WHEN "buildingType" = 'power_plant' THEN quantity END), 0)
  INTO
    v_hospital,
    v_military_base,
    v_school,
    v_military_academy,
    v_missile_system,
    v_airport,
    v_naval_port,
    v_space_port,
    v_real_estate_fund,
    v_power_plant
  FROM public.regional_buildings
  WHERE "regionId" = v_region_id;

  -- Raw weighted scores (matches AUTONOMY_CONFIG.INDEX_WEIGHTS)
  v_raw_health := ROUND((v_hospital * 1.0)::NUMERIC, 2);
  v_raw_education := ROUND((v_school * 1.0)::NUMERIC, 2);
  v_raw_development := ROUND((v_real_estate_fund * 1.0)::NUMERIC, 2);
  v_raw_military := ROUND((
    (v_military_base * 1.0) +
    (v_military_academy * 1.5) +
    (v_missile_system * 0.8) +
    (v_airport * 0.6) +
    (v_naval_port * 0.6) +
    (v_space_port * 0.4)
  )::NUMERIC, 2);

  -- Index levels (thresholds: [1,3,6,10,15,21,28,36,45,55])
  v_health_idx := CASE
    WHEN v_raw_health >= 55 THEN 10
    WHEN v_raw_health >= 45 THEN 9
    WHEN v_raw_health >= 36 THEN 8
    WHEN v_raw_health >= 28 THEN 7
    WHEN v_raw_health >= 21 THEN 6
    WHEN v_raw_health >= 15 THEN 5
    WHEN v_raw_health >= 10 THEN 4
    WHEN v_raw_health >= 6 THEN 3
    WHEN v_raw_health >= 3 THEN 2
    WHEN v_raw_health >= 1 THEN 1
    ELSE 1
  END;
  v_military_idx := CASE
    WHEN v_raw_military >= 55 THEN 10
    WHEN v_raw_military >= 45 THEN 9
    WHEN v_raw_military >= 36 THEN 8
    WHEN v_raw_military >= 28 THEN 7
    WHEN v_raw_military >= 21 THEN 6
    WHEN v_raw_military >= 15 THEN 5
    WHEN v_raw_military >= 10 THEN 4
    WHEN v_raw_military >= 6 THEN 3
    WHEN v_raw_military >= 3 THEN 2
    WHEN v_raw_military >= 1 THEN 1
    ELSE 1
  END;
  v_education_idx := CASE
    WHEN v_raw_education >= 55 THEN 10
    WHEN v_raw_education >= 45 THEN 9
    WHEN v_raw_education >= 36 THEN 8
    WHEN v_raw_education >= 28 THEN 7
    WHEN v_raw_education >= 21 THEN 6
    WHEN v_raw_education >= 15 THEN 5
    WHEN v_raw_education >= 10 THEN 4
    WHEN v_raw_education >= 6 THEN 3
    WHEN v_raw_education >= 3 THEN 2
    WHEN v_raw_education >= 1 THEN 1
    ELSE 1
  END;
  v_development_idx := CASE
    WHEN v_raw_development >= 55 THEN 10
    WHEN v_raw_development >= 45 THEN 9
    WHEN v_raw_development >= 36 THEN 8
    WHEN v_raw_development >= 28 THEN 7
    WHEN v_raw_development >= 21 THEN 6
    WHEN v_raw_development >= 15 THEN 5
    WHEN v_raw_development >= 10 THEN 4
    WHEN v_raw_development >= 6 THEN 3
    WHEN v_raw_development >= 3 THEN 2
    WHEN v_raw_development >= 1 THEN 1
    ELSE 1
  END;

  -- Progress toward next level (approx parity with TS)
  -- prevThreshold = thresholds[level-1], nextThreshold = thresholds[level]
  -- If max, progress=100.
  v_health_prog := CASE
    WHEN v_health_idx >= 10 THEN 100
    ELSE ROUND(
      (
        (v_raw_health - (ARRAY[1,3,6,10,15,21,28,36,45,55])[v_health_idx]) /
        ((ARRAY[3,6,10,15,21,28,36,45,55,55])[v_health_idx] - (ARRAY[1,3,6,10,15,21,28,36,45,55])[v_health_idx])
      ) * 100,
      2
    )
  END;
  v_military_prog := CASE
    WHEN v_military_idx >= 10 THEN 100
    ELSE ROUND(
      (
        (v_raw_military - (ARRAY[1,3,6,10,15,21,28,36,45,55])[v_military_idx]) /
        ((ARRAY[3,6,10,15,21,28,36,45,55,55])[v_military_idx] - (ARRAY[1,3,6,10,15,21,28,36,45,55])[v_military_idx])
      ) * 100,
      2
    )
  END;
  v_education_prog := CASE
    WHEN v_education_idx >= 10 THEN 100
    ELSE ROUND(
      (
        (v_raw_education - (ARRAY[1,3,6,10,15,21,28,36,45,55])[v_education_idx]) /
        ((ARRAY[3,6,10,15,21,28,36,45,55,55])[v_education_idx] - (ARRAY[1,3,6,10,15,21,28,36,45,55])[v_education_idx])
      ) * 100,
      2
    )
  END;
  v_development_prog := CASE
    WHEN v_development_idx >= 10 THEN 100
    ELSE ROUND(
      (
        (v_raw_development - (ARRAY[1,3,6,10,15,21,28,36,45,55])[v_development_idx]) /
        ((ARRAY[3,6,10,15,21,28,36,45,55,55])[v_development_idx] - (ARRAY[1,3,6,10,15,21,28,36,45,55])[v_development_idx])
      ) * 100,
      2
    )
  END;

  v_classification := CASE
    WHEN v_development_idx >= 6 THEN 'developed'
    WHEN v_development_idx >= 2 THEN 'developing'
    ELSE 'underdeveloped'
  END;

  -- Energy (matches AUTONOMY_CONFIG.ENERGY_CONSUMPTION/PRODUCTION)
  v_consumption :=
    (v_hospital * 2) +
    (v_military_base * 2) +
    (v_school * 2) +
    (v_military_academy * 0) +
    (v_missile_system * 2) +
    (v_airport * 2) +
    (v_naval_port * 2) +
    (v_space_port * 0) +
    (v_real_estate_fund * 0) +
    (v_power_plant * 0);
  v_generation := v_power_plant * 10;
  v_efficiency := v_generation - v_consumption;

  UPDATE public.regions
  SET
    "healthIndex" = v_health_idx,
    "militaryIndex" = v_military_idx,
    "educationIndex" = v_education_idx,
    "developmentIndex" = v_development_idx,
    "healthProgress" = GREATEST(0, LEAST(100, v_health_prog)),
    "militaryProgress" = GREATEST(0, LEAST(100, v_military_prog)),
    "educationProgress" = GREATEST(0, LEAST(100, v_education_prog)),
    "developmentProgress" = GREATEST(0, LEAST(100, v_development_prog)),
    "regionalClassification" = v_classification,
    "energyGeneration" = v_generation,
    "energyConsumption" = v_consumption,
    "energyEfficiency" = v_efficiency
  WHERE id = v_region_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.rpc_execute_law_effect_atomic(
  p_law_id TEXT,
  p_region_id TEXT,
  p_type TEXT,
  p_params JSONB DEFAULT '{}'::JSONB,
  p_actor_user_id UUID DEFAULT NULL,
  p_operation_key TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_region public.regions%ROWTYPE;
  v_target_region public.regions%ROWTYPE;
  v_share INT;
  v_tax INT;
  v_amount BIGINT;
  v_now TIMESTAMPTZ := NOW();
  v_target_id TEXT;
  v_other_id TEXT;
  v_existing_war public.wars%ROWTYPE;
  v_active_wars INT := 0;
  v_war_cost BIGINT := 0;
  v_winner TEXT;
  v_loser TEXT;
  v_loser_budget BIGINT := 0;
  v_attacker_region public.regions%ROWTYPE;
  v_conquest_leader UUID;
  v_conquest_nation TEXT;
  v_bt TEXT;
  v_cost BIGINT := 0;
  v_is_autonomous BOOLEAN := FALSE;
  v_regional_budget BIGINT := 0;
  v_response JSONB;
BEGIN
  v_response := public.rpc_get_idempotent_response(p_operation_key, 'law_effect:' || COALESCE(NULLIF(trim(p_law_id), ''), trim(p_type)));
  IF v_response IS NOT NULL THEN
    RETURN v_response;
  END IF;

  SELECT *
  INTO v_region
  FROM public.regions
  WHERE id = trim(p_region_id)
  FOR UPDATE;

  IF v_region.id IS NULL THEN
    RETURN public.rpc_std_error('region_not_found', 'Regione non trovata.');
  END IF;

  IF p_type = 'transfer_budget' THEN
    v_amount := COALESCE((p_params->>'amount')::BIGINT, 0);
    IF v_amount <= 0 OR COALESCE(trim(p_params->>'targetRegionId'), '') = '' THEN
      RETURN public.rpc_std_error('invalid_input', 'Importo non valido.');
    END IF;
    PERFORM public.add_budget_transaction('REGION', v_region.id, 'EXPENSE', 'BUDGET_TRANSFER', -v_amount, '{}'::jsonb, p_actor_user_id, jsonb_build_object('to', p_params->>'targetRegionId'));
    PERFORM public.add_budget_transaction('REGION', p_params->>'targetRegionId', 'INCOME', 'BUDGET_TRANSFER', v_amount, '{}'::jsonb, p_actor_user_id, jsonb_build_object('from', v_region.id));

  ELSIF p_type = 'grant_autonomy' THEN
    SELECT * INTO v_target_region FROM public.regions WHERE id = p_params->>'targetRegionId' FOR UPDATE;
    IF v_target_region.id IS NULL THEN
      RETURN public.rpc_std_error('target_not_found', 'Regione bersaglio inesistente.');
    END IF;
    v_share := GREATEST(0, LEAST(100, COALESCE((p_params->>'profitShare')::INT, 30)));
    UPDATE public.regions
    SET
      "isAutonomous" = TRUE,
      "regionalParliamentEnabled" = TRUE,
      "regionalProfitSharePercent" = v_share,
      "nationalProfitSharePercent" = 100 - v_share,
      "regionalBudget" = 0,
      "autonomyGrantedAt" = NOW(),
      "autonomyRevokedAt" = NULL
    WHERE id = v_target_region.id;
    INSERT INTO public.autonomy_history ("regionId", action, details, "performedByUserId")
    VALUES (v_target_region.id, 'granted', jsonb_build_object('profitShare', v_share, 'grantedBy', v_region.id), p_actor_user_id);

  ELSIF p_type = 'revoke_autonomy' THEN
    SELECT * INTO v_target_region FROM public.regions WHERE id = p_params->>'targetRegionId' FOR UPDATE;
    IF v_target_region.id IS NULL THEN
      RETURN public.rpc_std_error('target_not_found', 'Regione bersaglio inesistente.');
    END IF;
    IF COALESCE(v_target_region."regionalBudget", 0) > 0 THEN
      PERFORM public.add_budget_transaction('REGION', v_region.id, 'INCOME', 'AUTONOMY_REVOKE_TRANSFER', COALESCE(v_target_region."regionalBudget", 0), '{}'::jsonb, p_actor_user_id, jsonb_build_object('fromRegion', v_target_region.id));
    END IF;
    UPDATE public.regions
    SET
      "isAutonomous" = FALSE,
      "regionalParliamentEnabled" = FALSE,
      "governorPlayerId" = NULL,
      "regionalBudget" = 0,
      "regionalProfitSharePercent" = 0,
      "nationalProfitSharePercent" = 100,
      "autonomyRevokedAt" = NOW()
    WHERE id = v_target_region.id;
    DELETE FROM public.regional_parliament_members WHERE "regionId" = v_target_region.id;
    INSERT INTO public.autonomy_history ("regionId", action, details, "performedByUserId")
    VALUES (v_target_region.id, 'revoked', jsonb_build_object('revokedBy', v_region.id, 'frozenBudget', COALESCE(v_target_region."regionalBudget", 0)), p_actor_user_id);

  ELSIF p_type = 'change_profit_share' THEN
    v_share := GREATEST(0, LEAST(100, COALESCE((p_params->>'profitShare')::INT, 0)));
    UPDATE public.regions
    SET
      "regionalProfitSharePercent" = v_share,
      "nationalProfitSharePercent" = 100 - v_share
    WHERE id = p_params->>'targetRegionId';

  ELSIF p_type = 'change_worker_tax' THEN
    v_tax := GREATEST(0, LEAST(100, COALESCE((p_params->>'tax')::INT, 0)));
    UPDATE public.regions SET "workerTaxPercent" = v_tax WHERE id = COALESCE(NULLIF(p_params->>'targetRegionId', ''), v_region.id);

  ELSIF p_type = 'change_industry_tax' THEN
    v_tax := GREATEST(0, LEAST(100, COALESCE((p_params->>'tax')::INT, 0)));
    UPDATE public.regions SET "industryTaxPercent" = v_tax WHERE id = COALESCE(NULLIF(p_params->>'targetRegionId', ''), v_region.id);

  ELSIF p_type = 'assign_governor' THEN
    UPDATE public.regions
    SET "governorPlayerId" = p_params->>'governorUserId'
    WHERE id = p_params->>'targetRegionId';

  ELSIF p_type = 'migration_agreement' THEN
    v_target_id := COALESCE(NULLIF(trim(p_params->>'targetRegionId'), ''), NULL);
    IF v_target_id IS NULL OR v_target_id = v_region.id THEN
      RETURN public.rpc_std_error('invalid_input', 'ID Nazione bersaglio obbligatorio.');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.regions WHERE id = v_target_id) THEN
      RETURN public.rpc_std_error('target_not_found', 'Nazione bersaglio inesistente.');
    END IF;

    INSERT INTO public.migration_agreements (
      id,
      "fromStateId",
      "toStateId",
      status,
      type,
      "createdAt",
      "activatedAt",
      "sourceLawId",
      "updatedAt"
    )
    VALUES (
      substr(md5(random()::TEXT || clock_timestamp()::TEXT), 1, 9),
      v_region.id,
      v_target_id,
      'ACTIVE',
      'UNILATERAL',
      v_now,
      v_now,
      NULLIF(trim(p_law_id), ''),
      v_now
    )
    ON CONFLICT ("fromStateId", "toStateId") DO UPDATE SET
      status = 'ACTIVE',
      type = 'UNILATERAL',
      "activatedAt" = EXCLUDED."activatedAt",
      "sourceLawId" = EXCLUDED."sourceLawId",
      "updatedAt" = EXCLUDED."updatedAt";

    -- If inverse is also active, mark both as BILATERAL
    IF EXISTS (
      SELECT 1 FROM public.migration_agreements
      WHERE "fromStateId" = v_target_id
        AND "toStateId" = v_region.id
        AND status = 'ACTIVE'
    ) THEN
      UPDATE public.migration_agreements
      SET type = 'BILATERAL', "updatedAt" = v_now
      WHERE ("fromStateId" = v_region.id AND "toStateId" = v_target_id)
         OR ("fromStateId" = v_target_id AND "toStateId" = v_region.id);
    END IF;

  ELSIF p_type = 'revoke_migration_agreement' THEN
    v_target_id := COALESCE(NULLIF(trim(p_params->>'targetRegionId'), ''), NULL);
    IF v_target_id IS NULL THEN
      RETURN public.rpc_std_error('invalid_input', 'ID Nazione bersaglio obbligatorio.');
    END IF;

    UPDATE public.migration_agreements
    SET
      status = 'INACTIVE',
      type = 'UNILATERAL',
      "revokedAt" = v_now,
      "sourceLawId" = NULLIF(trim(p_law_id), ''),
      "updatedAt" = v_now
    WHERE "fromStateId" = v_region.id
      AND "toStateId" = v_target_id
      AND status = 'ACTIVE';

    IF NOT FOUND THEN
      RETURN public.rpc_std_error('not_found', 'Non c''è un accordo attivo da revocare.');
    END IF;

    UPDATE public.migration_agreements
    SET type = 'UNILATERAL', "updatedAt" = v_now
    WHERE "fromStateId" = v_target_id
      AND "toStateId" = v_region.id;

  ELSIF p_type = 'apply_sanctions' THEN
    v_target_id := COALESCE(NULLIF(trim(p_params->>'targetRegionId'), ''), NULL);
    IF v_target_id IS NULL OR v_target_id = v_region.id THEN
      RETURN public.rpc_std_error('invalid_input', 'ID Nazione bersaglio obbligatorio.');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.regions WHERE id = v_target_id) THEN
      RETURN public.rpc_std_error('target_not_found', 'Nazione bersaglio inesistente.');
    END IF;
    IF EXISTS (
      SELECT 1 FROM public.sanctions
      WHERE "fromStateId" = v_region.id
        AND "targetStateId" = v_target_id
        AND status = 'ACTIVE'
    ) THEN
      -- idempotent success (law might be replayed)
      NULL;
    ELSE
      INSERT INTO public.sanctions (
        id,
        "fromStateId",
        "targetStateId",
        status,
        "createdAt",
        "createdByUserId"
      )
      VALUES (
        'sanc_' || (EXTRACT(EPOCH FROM clock_timestamp()) * 1000)::BIGINT || '_' || substr(md5(random()::TEXT || clock_timestamp()::TEXT), 1, 6),
        v_region.id,
        v_target_id,
        'ACTIVE',
        v_now,
        COALESCE(p_actor_user_id, v_region."ownerUserId")
      );
    END IF;

  ELSIF p_type = 'revoke_sanctions' THEN
    v_target_id := COALESCE(NULLIF(trim(p_params->>'targetRegionId'), ''), NULL);
    IF v_target_id IS NULL THEN
      RETURN public.rpc_std_error('invalid_input', 'ID Nazione bersaglio obbligatorio.');
    END IF;

    UPDATE public.sanctions
    SET
      status = 'REVOKED',
      "revokedAt" = v_now,
      "revokedByUserId" = COALESCE(p_actor_user_id, v_region."ownerUserId")
    WHERE "fromStateId" = v_region.id
      AND "targetStateId" = v_target_id
      AND status = 'ACTIVE';

    IF NOT FOUND THEN
      RETURN public.rpc_std_error('not_found', 'Non c''è una sanzione attiva da revocare.');
    END IF;

  ELSIF p_type = 'declare_war' THEN
    v_target_id := COALESCE(NULLIF(trim(p_params->>'targetRegionId'), ''), NULL);
    IF v_target_id IS NULL OR v_target_id = v_region.id THEN
      RETURN public.rpc_std_error('invalid_input', 'ID Nazione bersaglio obbligatorio.');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.regions WHERE id = v_target_id) THEN
      RETURN public.rpc_std_error('target_not_found', 'Nazione bersaglio inesistente.');
    END IF;

    PERFORM pg_advisory_xact_lock(hashtext('war:declare:' || v_region.id || ':' || v_target_id));

    IF EXISTS (
      SELECT 1 FROM public.wars
      WHERE status = 'active'
        AND (
          ("attackerCountryIso2" = v_region.id AND "defenderCountryIso2" = v_target_id)
          OR ("attackerCountryIso2" = v_target_id AND "defenderCountryIso2" = v_region.id)
        )
    ) THEN
      RETURN public.rpc_std_error('conflict', 'Sei già in guerra con questa nazione.');
    END IF;

    -- Bloc restriction: cannot declare war on same bloc
    IF EXISTS (
      SELECT 1
      FROM public.bloc_memberships a
      JOIN public.bloc_memberships b ON a."blocId" = b."blocId"
      WHERE a."stateId" = v_region.id
        AND b."stateId" = v_target_id
        AND a.status = 'active'
        AND b.status = 'active'
    ) THEN
      RETURN public.rpc_std_error('forbidden', 'Non puoi dichiarare guerra a un membro dello stesso Blocco Geopolitico.');
    END IF;

    SELECT COUNT(*)::INT
    INTO v_active_wars
    FROM public.wars
    WHERE status = 'active'
      AND ("attackerCountryIso2" = v_region.id OR "defenderCountryIso2" = v_region.id);

    v_war_cost := FLOOR(50000 * (1 + 0.25 * COALESCE(v_active_wars, 0)))::BIGINT;

    BEGIN
      PERFORM public.add_budget_transaction(
        'REGION',
        v_region.id,
        'EXPENSE',
        'WAR_START',
        -v_war_cost,
        '{}'::jsonb,
        p_actor_user_id,
        jsonb_build_object('target', v_target_id)
      );
    EXCEPTION
      WHEN OTHERS THEN
        RETURN public.rpc_std_error('insufficient_budget', 'Fondi in bilancio insufficienti.', jsonb_build_object('cost', v_war_cost));
    END;

    INSERT INTO public.wars (
      id,
      "attackerCountryIso2",
      "defenderCountryIso2",
      status,
      "startedAt",
      "endsAt",
      "attackerScore",
      "defenderScore",
      "lastEventAt"
    )
    VALUES (
      'war_' || (EXTRACT(EPOCH FROM clock_timestamp()) * 1000)::BIGINT || '_' || v_region.id || '_' || v_target_id,
      v_region.id,
      v_target_id,
      'active',
      v_now,
      v_now + make_interval(hours => 24),
      0,
      0,
      v_now
    );

  ELSIF p_type = 'peace_treaty' THEN
    v_target_id := COALESCE(NULLIF(trim(p_params->>'targetRegionId'), ''), NULL);
    IF v_target_id IS NULL THEN
      RETURN public.rpc_std_error('invalid_input', 'ID Nazione bersaglio obbligatorio.');
    END IF;

    PERFORM pg_advisory_xact_lock(hashtext('war:peace:' || v_region.id || ':' || v_target_id));

    SELECT *
    INTO v_existing_war
    FROM public.wars
    WHERE status = 'active'
      AND (
        ("attackerCountryIso2" = v_region.id AND "defenderCountryIso2" = v_target_id)
        OR ("attackerCountryIso2" = v_target_id AND "defenderCountryIso2" = v_region.id)
      )
    LIMIT 1
    FOR UPDATE;

    IF v_existing_war.id IS NULL THEN
      RETURN public.rpc_std_error('not_found', 'Non c''è una guerra attiva con questa nazione.');
    END IF;

    v_winner := NULL;
    v_loser := NULL;
    IF COALESCE(v_existing_war."attackerScore", 0) > COALESCE(v_existing_war."defenderScore", 0) THEN
      v_winner := v_existing_war."attackerCountryIso2";
      v_loser := v_existing_war."defenderCountryIso2";
    ELSIF COALESCE(v_existing_war."defenderScore", 0) > COALESCE(v_existing_war."attackerScore", 0) THEN
      v_winner := v_existing_war."defenderCountryIso2";
      v_loser := v_existing_war."attackerCountryIso2";
    END IF;

    IF v_winner IS NOT NULL AND v_loser IS NOT NULL THEN
      SELECT COALESCE("moneyEUR", 0)
      INTO v_loser_budget
      FROM public.budgets
      WHERE "ownerType" = 'REGION'
        AND "ownerId" = v_loser
      ORDER BY id
      LIMIT 1
      FOR UPDATE;

      IF COALESCE(v_loser_budget, 0) > 0 THEN
        PERFORM public.add_budget_transaction('REGION', v_loser, 'WAR_LOOT', 'LOOT_LOST', -v_loser_budget, '{}'::jsonb, p_actor_user_id, jsonb_build_object('to', v_winner, 'warId', v_existing_war.id));
        PERFORM public.add_budget_transaction('REGION', v_winner, 'WAR_LOOT', 'LOOT_WON', v_loser_budget, '{}'::jsonb, p_actor_user_id, jsonb_build_object('from', v_loser, 'warId', v_existing_war.id));
      END IF;

      -- Territory annexation if attacker wins
      IF v_winner = v_existing_war."attackerCountryIso2" THEN
        SELECT *
        INTO v_attacker_region
        FROM public.regions
        WHERE id = v_winner
        FOR UPDATE;

        v_conquest_leader := COALESCE(v_attacker_region."leaderUserId", v_attacker_region."ownerUserId");
        v_conquest_nation := COALESCE(v_attacker_region.nation_id, 'nation_' || v_winner);

        IF v_conquest_leader IS NOT NULL THEN
          UPDATE public.regions
          SET
            "ownerUserId" = v_conquest_leader,
            "leaderUserId" = v_conquest_leader,
            nation_id = v_conquest_nation,
            "stateColor" = v_attacker_region."stateColor",
            "governmentForm" = v_attacker_region."governmentForm",
            "leaderTitle" = v_attacker_region."leaderTitle",
            dictatorship = v_attacker_region.dictatorship,
            stability = 30
          WHERE id = v_loser;
        END IF;
      END IF;
    END IF;

    UPDATE public.wars
    SET status = 'ended', "endsAt" = v_now
    WHERE id = v_existing_war.id;

  ELSIF p_type = 'build_regional_building' THEN
    v_bt := COALESCE(NULLIF(trim(p_params->>'buildingType'), ''), NULL);
    v_target_id := COALESCE(NULLIF(trim(p_params->>'targetRegionId'), ''), v_region.id);

    IF v_bt IS NULL THEN
      RETURN public.rpc_std_error('invalid_input', 'Tipo edificio non valido.');
    END IF;
    IF v_bt NOT IN ('hospital', 'military_base', 'school', 'military_academy', 'missile_system', 'airport', 'naval_port', 'space_port', 'real_estate_fund', 'power_plant') THEN
      RETURN public.rpc_std_error('invalid_input', 'Tipo edificio non valido.', jsonb_build_object('buildingType', v_bt));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.regions WHERE id = v_target_id) THEN
      RETURN public.rpc_std_error('target_not_found', 'Regione non trovata.');
    END IF;

    -- Costs (matches AUTONOMY_CONFIG.BUILDING_COSTS)
    v_cost := CASE v_bt
      WHEN 'hospital' THEN 25000
      WHEN 'military_base' THEN 50000
      WHEN 'school' THEN 20000
      WHEN 'military_academy' THEN 80000
      WHEN 'missile_system' THEN 100000
      WHEN 'airport' THEN 75000
      WHEN 'naval_port' THEN 75000
      WHEN 'space_port' THEN 150000
      WHEN 'real_estate_fund' THEN 40000
      WHEN 'power_plant' THEN 60000
      ELSE 0
    END;

    SELECT COALESCE("isAutonomous", FALSE), COALESCE("regionalBudget", 0)
    INTO v_is_autonomous, v_regional_budget
    FROM public.regions
    WHERE id = v_target_id
    FOR UPDATE;

    IF v_is_autonomous THEN
      IF v_regional_budget < v_cost THEN
        RETURN public.rpc_std_error('insufficient_budget', 'Budget regionale insufficiente.', jsonb_build_object('cost', v_cost, 'available', v_regional_budget));
      END IF;

      INSERT INTO public.regional_budget_transactions ("regionId", type, subtype, "moneyDelta", description, "createdByUserId")
      VALUES (v_target_id, 'EXPENSE', 'BUILDING', -v_cost, 'Costruzione edificio regionale', p_actor_user_id);

      UPDATE public.regions
      SET "regionalBudget" = GREATEST(0, COALESCE("regionalBudget", 0) - v_cost)
      WHERE id = v_target_id;
    ELSE
      BEGIN
        PERFORM public.add_budget_transaction('REGION', v_region.id, 'EXPENSE', 'BUILDING', -v_cost, '{}'::jsonb, p_actor_user_id, jsonb_build_object('building', v_bt, 'targetRegion', v_target_id));
      EXCEPTION
        WHEN OTHERS THEN
          RETURN public.rpc_std_error('insufficient_budget', 'Fondi statali insufficienti.', jsonb_build_object('cost', v_cost));
      END;
    END IF;

    INSERT INTO public.regional_buildings ("regionId", "buildingType", quantity, level, "updatedAt")
    VALUES (v_target_id, v_bt, 1, 1, v_now)
    ON CONFLICT ("regionId", "buildingType") DO UPDATE SET
      quantity = public.regional_buildings.quantity + 1,
      "updatedAt" = EXCLUDED."updatedAt";

    PERFORM public.rpc_recalculate_region_stats_atomic(v_target_id);

  ELSE
    RETURN public.rpc_std_error('unsupported_law_type', 'Tipo legge non supportato dalla RPC atomica.', jsonb_build_object('type', p_type));
  END IF;

  v_response := jsonb_build_object('success', TRUE, 'applied', TRUE, 'type', p_type);
  PERFORM public.rpc_store_idempotent_response(p_operation_key, 'law_effect:' || COALESCE(NULLIF(trim(p_law_id), ''), trim(p_type)), v_response);
  RETURN v_response;
END;
$$;

CREATE OR REPLACE FUNCTION public.rpc_propose_law_atomic(
  p_user_id UUID,
  p_region_id TEXT,
  p_type TEXT,
  p_params JSONB DEFAULT '{}'::JSONB,
  p_force_immediate BOOLEAN DEFAULT FALSE,
  p_operation_key TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_law_id TEXT;
  v_status TEXT := 'pending';
  v_response JSONB;
BEGIN
  v_response := public.rpc_get_idempotent_response(p_operation_key, 'law_propose');
  IF v_response IS NOT NULL THEN
    RETURN v_response;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('law:propose:' || trim(p_region_id) || ':' || trim(p_type)));

  IF EXISTS (
    SELECT 1
    FROM public.laws
    WHERE "regionId" = trim(p_region_id)
      AND type = trim(p_type)
      AND status IN ('pending', 'pending_assent')
  ) THEN
    RETURN public.rpc_std_error('duplicate_pending', 'Una proposta simile è già in votazione o in attesa di sanzione.');
  END IF;

  v_law_id := 'law_' || (EXTRACT(EPOCH FROM clock_timestamp()) * 1000)::BIGINT || '_' || substr(md5(random()::TEXT || clock_timestamp()::TEXT), 1, 6);
  IF COALESCE(p_force_immediate, FALSE) THEN
    v_status := 'passed';
  END IF;

  INSERT INTO public.laws (id, "regionId", "proposerId", type, params, status, "createdAt", "expiresAt")
  VALUES (
    v_law_id,
    trim(p_region_id),
    p_user_id,
    trim(p_type),
    COALESCE(p_params, '{}'::jsonb),
    v_status,
    NOW(),
    CASE WHEN COALESCE(p_force_immediate, FALSE) THEN NOW() ELSE NOW() + make_interval(days => 1) END
  );

  IF COALESCE(p_force_immediate, FALSE) THEN
    v_response := public.rpc_execute_law_effect_atomic(v_law_id, trim(p_region_id), trim(p_type), COALESCE(p_params, '{}'::jsonb), p_user_id, COALESCE(p_operation_key, v_law_id || ':effect'));
    IF COALESCE((v_response->>'success')::BOOLEAN, FALSE) = FALSE THEN
      RETURN v_response;
    END IF;
  ELSE
    INSERT INTO public.law_votes ("lawId", "voterId", vote, "createdAt")
    VALUES (v_law_id, p_user_id, 'yes', NOW())
    ON CONFLICT ("lawId", "voterId") DO UPDATE SET vote = EXCLUDED.vote, "createdAt" = EXCLUDED."createdAt";
  END IF;

  v_response := jsonb_build_object('success', TRUE, 'lawId', v_law_id, 'immediate', COALESCE(p_force_immediate, FALSE), 'status', v_status);
  PERFORM public.rpc_store_idempotent_response(p_operation_key, 'law_propose', v_response);
  RETURN v_response;
END;
$$;

CREATE OR REPLACE FUNCTION public.rpc_resolve_law_atomic(
  p_law_id TEXT,
  p_actor_user_id UUID,
  p_action TEXT,
  p_operation_key TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_law public.laws%ROWTYPE;
  v_response JSONB;
BEGIN
  v_response := public.rpc_get_idempotent_response(p_operation_key, 'law_resolve');
  IF v_response IS NOT NULL THEN
    RETURN v_response;
  END IF;

  SELECT *
  INTO v_law
  FROM public.laws
  WHERE id = trim(p_law_id)
  FOR UPDATE;

  IF v_law.id IS NULL THEN
    RETURN public.rpc_std_error('not_found', 'Legge non trovata.');
  END IF;

  IF p_action = 'withdraw' THEN
    IF v_law."proposerId" <> p_actor_user_id THEN
      RETURN public.rpc_std_error('forbidden', 'Solo il creatore della proposta può ritirarla.');
    END IF;
    UPDATE public.laws SET status = 'withdrawn' WHERE id = v_law.id AND status IN ('pending', 'pending_assent');
    v_response := jsonb_build_object('success', TRUE, 'result', 'withdrawn');
  ELSIF p_action = 'fast_pass' OR p_action = 'assent' THEN
    UPDATE public.laws SET status = 'passed', "expiresAt" = NOW() WHERE id = v_law.id;
    v_response := public.rpc_execute_law_effect_atomic(v_law.id, v_law."regionId", v_law.type, v_law.params, p_actor_user_id, COALESCE(p_operation_key, v_law.id || ':effect'));
    IF COALESCE((v_response->>'success')::BOOLEAN, FALSE) = FALSE THEN
      RETURN v_response;
    END IF;
    v_response := jsonb_build_object('success', TRUE, 'result', 'passed');
  ELSIF p_action = 'veto' THEN
    UPDATE public.laws SET status = 'rejected' WHERE id = v_law.id;
    v_response := jsonb_build_object('success', TRUE, 'result', 'vetoed');
  ELSE
    RETURN public.rpc_std_error('invalid_action', 'Azione legge non supportata.');
  END IF;

  PERFORM public.rpc_store_idempotent_response(p_operation_key, 'law_resolve', v_response);
  RETURN v_response;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.rpc_std_error(TEXT, TEXT, JSONB, BOOLEAN, BOOLEAN) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.rpc_store_idempotent_response(TEXT, TEXT, JSONB) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.rpc_get_idempotent_response(TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.rpc_factory_market_list_atomic(UUID, UUID, BIGINT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.rpc_factory_market_cancel_atomic(UUID, UUID, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.rpc_create_party_atomic(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.rpc_join_party_atomic(TEXT, UUID, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.rpc_create_bloc_atomic(UUID, TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.rpc_apply_to_bloc_atomic(TEXT, UUID, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.rpc_vote_bloc_application_atomic(TEXT, UUID, TEXT, INT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.rpc_propose_bloc_regulation_atomic(TEXT, UUID, TEXT, TEXT, INT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.rpc_vote_bloc_regulation_atomic(TEXT, UUID, TEXT, INT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.rpc_budget_donate_atomic(UUID, TEXT, BIGINT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.rpc_budget_clean_radiation_atomic(UUID, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.rpc_ministers_assign_atomic(UUID, TEXT, UUID, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.rpc_ministers_revoke_atomic(UUID, TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.rpc_leader_vote_atomic(TEXT, UUID, UUID, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.rpc_sanctions_apply_atomic(UUID, TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.rpc_sanctions_revoke_atomic(UUID, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.rpc_recalculate_region_stats_atomic(TEXT) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.rpc_execute_law_effect_atomic(TEXT, TEXT, TEXT, JSONB, UUID, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.rpc_propose_law_atomic(UUID, TEXT, TEXT, JSONB, BOOLEAN, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.rpc_resolve_law_atomic(TEXT, UUID, TEXT, TEXT) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.rpc_std_error(TEXT, TEXT, JSONB, BOOLEAN, BOOLEAN) TO service_role;
GRANT EXECUTE ON FUNCTION public.rpc_store_idempotent_response(TEXT, TEXT, JSONB) TO service_role;
GRANT EXECUTE ON FUNCTION public.rpc_get_idempotent_response(TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.rpc_factory_market_list_atomic(UUID, UUID, BIGINT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.rpc_factory_market_cancel_atomic(UUID, UUID, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.rpc_create_party_atomic(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.rpc_join_party_atomic(TEXT, UUID, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.rpc_create_bloc_atomic(UUID, TEXT, TEXT, TEXT, TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.rpc_apply_to_bloc_atomic(TEXT, UUID, TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.rpc_vote_bloc_application_atomic(TEXT, UUID, TEXT, INT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.rpc_propose_bloc_regulation_atomic(TEXT, UUID, TEXT, TEXT, INT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.rpc_vote_bloc_regulation_atomic(TEXT, UUID, TEXT, INT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.rpc_budget_donate_atomic(UUID, TEXT, BIGINT, TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.rpc_budget_clean_radiation_atomic(UUID, TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.rpc_ministers_assign_atomic(UUID, TEXT, UUID, TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.rpc_ministers_revoke_atomic(UUID, TEXT, TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.rpc_leader_vote_atomic(TEXT, UUID, UUID, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.rpc_sanctions_apply_atomic(UUID, TEXT, TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.rpc_sanctions_revoke_atomic(UUID, TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.rpc_recalculate_region_stats_atomic(TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.rpc_execute_law_effect_atomic(TEXT, TEXT, TEXT, JSONB, UUID, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.rpc_propose_law_atomic(UUID, TEXT, TEXT, JSONB, BOOLEAN, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.rpc_resolve_law_atomic(TEXT, UUID, TEXT, TEXT) TO service_role;
