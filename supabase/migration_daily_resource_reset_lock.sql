-- Persisted daily resource reset watermark + lightweight DB lock.
-- Goal: allow only one valid reset per logical day across restarts / multi-instance.

INSERT INTO public.game_settings (key, value, description)
VALUES (
  'daily_resource_reset_state',
  '{}'::jsonb,
  'Persistent execution state for the daily resource reset scheduler'
)
ON CONFLICT (key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.acquire_daily_resource_reset_lock(
  p_logical_date DATE,
  p_lock_owner TEXT DEFAULT NULL,
  p_timeout_seconds INTEGER DEFAULT 1800
)
RETURNS JSONB
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_setting game_settings%ROWTYPE;
  v_value JSONB := '{}'::jsonb;
  v_last_completed_date DATE;
  v_lock_date DATE;
  v_lock_owner TEXT;
  v_lock_acquired_at TIMESTAMPTZ;
  v_now TIMESTAMPTZ := NOW();
BEGIN
  IF p_logical_date IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'acquired', false,
      'code', 'invalid_input',
      'message', 'Logical date is required.'
    );
  END IF;

  IF p_timeout_seconds IS NULL OR p_timeout_seconds < 30 THEN
    p_timeout_seconds := 1800;
  END IF;

  INSERT INTO game_settings (key, value, description)
  VALUES (
    'daily_resource_reset_state',
    '{}'::jsonb,
    'Persistent execution state for the daily resource reset scheduler'
  )
  ON CONFLICT (key) DO NOTHING;

  SELECT *
  INTO v_setting
  FROM game_settings
  WHERE key = 'daily_resource_reset_state'
  FOR UPDATE;

  v_value := COALESCE(v_setting.value, '{}'::jsonb);
  v_last_completed_date := NULLIF(v_value ->> 'lastCompletedDate', '')::date;
  v_lock_date := NULLIF(v_value ->> 'lockDate', '')::date;
  v_lock_owner := NULLIF(v_value ->> 'lockOwner', '');
  v_lock_acquired_at := NULLIF(v_value ->> 'lockAcquiredAt', '')::timestamptz;

  IF v_last_completed_date IS NOT NULL AND v_last_completed_date >= p_logical_date THEN
    RETURN jsonb_build_object(
      'success', true,
      'acquired', false,
      'code', 'already_completed',
      'lastCompletedDate', v_last_completed_date::text
    );
  END IF;

  IF v_lock_date = p_logical_date
     AND v_lock_acquired_at IS NOT NULL
     AND v_lock_acquired_at > (v_now - make_interval(secs => p_timeout_seconds)) THEN
    RETURN jsonb_build_object(
      'success', true,
      'acquired', false,
      'code', 'in_progress',
      'lockDate', v_lock_date::text,
      'lockOwner', v_lock_owner,
      'lockAcquiredAt', v_lock_acquired_at
    );
  END IF;

  UPDATE game_settings
  SET
    value = jsonb_strip_nulls(
      (v_value - 'lockDate' - 'lockOwner' - 'lockAcquiredAt')
      || jsonb_build_object(
        'lockDate', p_logical_date::text,
        'lockOwner', p_lock_owner,
        'lockAcquiredAt', v_now
      )
    ),
    "updatedAt" = v_now
  WHERE key = 'daily_resource_reset_state';

  RETURN jsonb_build_object(
    'success', true,
    'acquired', true,
    'code', 'acquired',
    'lockDate', p_logical_date::text,
    'lockOwner', p_lock_owner,
    'lockAcquiredAt', v_now,
    'lastCompletedDate', v_last_completed_date::text
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_daily_resource_reset_lock(
  p_logical_date DATE,
  p_lock_owner TEXT DEFAULT NULL,
  p_mark_completed BOOLEAN DEFAULT TRUE
)
RETURNS JSONB
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_setting game_settings%ROWTYPE;
  v_value JSONB := '{}'::jsonb;
  v_new_value JSONB := '{}'::jsonb;
  v_last_completed_date DATE;
  v_lock_date DATE;
  v_lock_owner TEXT;
  v_now TIMESTAMPTZ := NOW();
BEGIN
  IF p_logical_date IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'completed', false,
      'code', 'invalid_input',
      'message', 'Logical date is required.'
    );
  END IF;

  INSERT INTO game_settings (key, value, description)
  VALUES (
    'daily_resource_reset_state',
    '{}'::jsonb,
    'Persistent execution state for the daily resource reset scheduler'
  )
  ON CONFLICT (key) DO NOTHING;

  SELECT *
  INTO v_setting
  FROM game_settings
  WHERE key = 'daily_resource_reset_state'
  FOR UPDATE;

  v_value := COALESCE(v_setting.value, '{}'::jsonb);
  v_last_completed_date := NULLIF(v_value ->> 'lastCompletedDate', '')::date;
  v_lock_date := NULLIF(v_value ->> 'lockDate', '')::date;
  v_lock_owner := NULLIF(v_value ->> 'lockOwner', '');

  IF v_last_completed_date IS NOT NULL AND v_last_completed_date >= p_logical_date THEN
    v_new_value := v_value - 'lockDate' - 'lockOwner' - 'lockAcquiredAt';

    UPDATE game_settings
    SET
      value = jsonb_strip_nulls(v_new_value),
      "updatedAt" = v_now
    WHERE key = 'daily_resource_reset_state';

    RETURN jsonb_build_object(
      'success', true,
      'completed', true,
      'idempotent', true,
      'lastCompletedDate', v_last_completed_date::text
    );
  END IF;

  IF v_lock_date IS DISTINCT FROM p_logical_date THEN
    RETURN jsonb_build_object(
      'success', false,
      'completed', false,
      'code', 'lock_not_held',
      'message', 'No matching lock is currently held for this logical date.',
      'lockDate', v_lock_date::text,
      'lockOwner', v_lock_owner
    );
  END IF;

  IF p_lock_owner IS NOT NULL
     AND v_lock_owner IS NOT NULL
     AND v_lock_owner <> p_lock_owner THEN
    RETURN jsonb_build_object(
      'success', false,
      'completed', false,
      'code', 'lock_owner_mismatch',
      'message', 'The lock is owned by another scheduler instance.',
      'lockDate', v_lock_date::text,
      'lockOwner', v_lock_owner
    );
  END IF;

  v_new_value := v_value - 'lockDate' - 'lockOwner' - 'lockAcquiredAt';

  IF p_mark_completed THEN
    v_new_value := v_new_value || jsonb_build_object(
      'lastCompletedDate', p_logical_date::text,
      'lastCompletedAt', v_now
    );
  END IF;

  UPDATE game_settings
  SET
    value = jsonb_strip_nulls(v_new_value),
    "updatedAt" = v_now
  WHERE key = 'daily_resource_reset_state';

  RETURN jsonb_build_object(
    'success', true,
    'completed', COALESCE(p_mark_completed, false),
    'released', true,
    'lastCompletedDate', CASE
      WHEN COALESCE(p_mark_completed, false) THEN p_logical_date::text
      ELSE v_last_completed_date::text
    END
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.acquire_daily_resource_reset_lock(DATE, TEXT, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.complete_daily_resource_reset_lock(DATE, TEXT, BOOLEAN) TO service_role;
