-- Harden /api/actions/apply against concurrent double submit and duplicate pending rows.
-- 1) Enforce DB-level uniqueness only for pending applications.
-- 2) Move create flow to a single transactional RPC.

-- Normalize existing invalid state so unique partial index can be created deterministically.
WITH ranked_pending AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY "userId", "regionId", type
      ORDER BY "createdAt" ASC, id ASC
    ) AS rn
  FROM applications
  WHERE status = 'pending'
)
UPDATE applications a
SET status = 'rejected'
FROM ranked_pending r
WHERE a.id = r.id
  AND r.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS applications_pending_unique_idx
ON applications ("userId", "regionId", type)
WHERE status = 'pending';

CREATE OR REPLACE FUNCTION public.create_application_atomic(
  p_user_id UUID,
  p_username TEXT,
  p_region_id TEXT,
  p_type TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_user users%ROWTYPE;
  v_owner_user_id UUID;
  v_application_id TEXT;
  v_now TIMESTAMPTZ := NOW();
BEGIN
  IF p_user_id IS NULL OR p_username IS NULL OR btrim(p_username) = '' OR p_region_id IS NULL OR btrim(p_region_id) = '' OR p_type IS NULL THEN
    RETURN jsonb_build_object('success', false, 'code', 'invalid_input', 'message', 'Input non valido.');
  END IF;

  IF p_region_id !~ '^[A-Z]{2,4}$' THEN
    RETURN jsonb_build_object('success', false, 'code', 'invalid_region', 'message', 'Regione non valida.');
  END IF;

  IF p_type NOT IN ('residence', 'work_permit') THEN
    RETURN jsonb_build_object('success', false, 'code', 'invalid_type', 'message', 'Tipo di richiesta non valido.');
  END IF;

  SELECT *
  INTO v_user
  FROM users
  WHERE id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'code', 'user_not_found', 'message', 'Utente non trovato.');
  END IF;

  IF (p_type = 'residence' AND v_user."residenceId" = p_region_id)
     OR (p_type = 'work_permit' AND v_user."workPermitId" = p_region_id) THEN
    RETURN jsonb_build_object('success', false, 'code', 'already_assigned', 'message', 'Permesso/residenza già assegnato per questa regione.');
  END IF;

  SELECT "ownerUserId"
  INTO v_owner_user_id
  FROM regions
  WHERE id = p_region_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'code', 'region_not_found', 'message', 'Regione non trovata.');
  END IF;

  v_application_id := gen_random_uuid()::text;

  IF v_owner_user_id IS NULL THEN
    IF p_type = 'residence' THEN
      UPDATE users SET "residenceId" = p_region_id WHERE id = p_user_id;
    ELSE
      UPDATE users SET "workPermitId" = p_region_id WHERE id = p_user_id;
    END IF;

    INSERT INTO applications (id, "userId", username, "regionId", type, status, "createdAt")
    VALUES (v_application_id, p_user_id, btrim(p_username), p_region_id, p_type, 'accepted', v_now);

    RETURN jsonb_build_object(
      'success', true,
      'applicationId', v_application_id,
      'status', 'accepted',
      'autoAccepted', true
    );
  END IF;

  BEGIN
    INSERT INTO applications (id, "userId", username, "regionId", type, status, "createdAt")
    VALUES (v_application_id, p_user_id, btrim(p_username), p_region_id, p_type, 'pending', v_now);
  EXCEPTION
    WHEN unique_violation THEN
      RETURN jsonb_build_object(
        'success', false,
        'code', 'duplicate_pending',
        'message', 'Hai già inviato una richiesta in attesa di approvazione.'
      );
  END;

  RETURN jsonb_build_object(
    'success', true,
    'applicationId', v_application_id,
    'status', 'pending',
    'autoAccepted', false
  );
END;
$$;
