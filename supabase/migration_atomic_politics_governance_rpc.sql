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
GRANT EXECUTE ON FUNCTION public.rpc_execute_law_effect_atomic(TEXT, TEXT, TEXT, JSONB, UUID, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.rpc_propose_law_atomic(UUID, TEXT, TEXT, JSONB, BOOLEAN, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.rpc_resolve_law_atomic(TEXT, UUID, TEXT, TEXT) TO service_role;
