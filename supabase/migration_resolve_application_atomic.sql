-- Atomic and idempotent application resolution (accept/reject)
-- Prevents partial updates between applications/users and guards concurrent double resolution.

CREATE OR REPLACE FUNCTION public.resolve_application_atomic(
  p_application_id TEXT,
  p_action TEXT,
  p_actor_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_application applications%ROWTYPE;
  v_leader_user_id UUID;
  v_target_status TEXT;
BEGIN
  IF p_application_id IS NULL OR btrim(p_application_id) = '' OR p_actor_user_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'invalid_input',
      'message', 'Input non valido.'
    );
  END IF;

  IF p_action NOT IN ('accept', 'reject') THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'invalid_action',
      'message', 'Azione non valida.'
    );
  END IF;

  SELECT *
  INTO v_application
  FROM applications
  WHERE id = btrim(p_application_id)
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'not_found',
      'message', 'Richiesta non trovata.'
    );
  END IF;

  IF v_application.status <> 'pending' THEN
    IF (p_action = 'accept' AND v_application.status = 'accepted')
       OR (p_action = 'reject' AND v_application.status = 'rejected') THEN
      RETURN jsonb_build_object(
        'success', true,
        'idempotent', true,
        'status', v_application.status,
        'applicationId', v_application.id
      );
    END IF;

    RETURN jsonb_build_object(
      'success', false,
      'code', 'already_resolved',
      'message', 'Richiesta già risolta con stato diverso.',
      'status', v_application.status
    );
  END IF;

  SELECT "leaderUserId"
  INTO v_leader_user_id
  FROM regions
  WHERE id = v_application."regionId";

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'region_not_found',
      'message', 'Regione non trovata.'
    );
  END IF;

  IF v_leader_user_id IS DISTINCT FROM p_actor_user_id THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'forbidden',
      'message', 'Solo il Leader può approvare residenze o visti.'
    );
  END IF;

  IF p_action = 'accept' THEN
    IF v_application.type = 'residence' THEN
      UPDATE users
      SET "residenceId" = v_application."regionId"
      WHERE id = v_application."userId";
    ELSIF v_application.type = 'work_permit' THEN
      UPDATE users
      SET "workPermitId" = v_application."regionId"
      WHERE id = v_application."userId";
    ELSE
      RETURN jsonb_build_object(
        'success', false,
        'code', 'invalid_application_type',
        'message', 'Tipo richiesta non supportato.'
      );
    END IF;

    IF NOT FOUND THEN
      RETURN jsonb_build_object(
        'success', false,
        'code', 'user_not_found',
        'message', 'Utente della richiesta non trovato.'
      );
    END IF;

    v_target_status := 'accepted';
  ELSE
    v_target_status := 'rejected';
  END IF;

  UPDATE applications
  SET status = v_target_status
  WHERE id = v_application.id
    AND status = 'pending';

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'race_condition',
      'message', 'Richiesta già aggiornata da un’altra transazione.'
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'idempotent', false,
    'status', v_target_status,
    'applicationId', v_application.id
  );
END;
$$;
