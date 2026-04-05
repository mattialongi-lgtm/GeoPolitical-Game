-- Final residual linter fix: public.upgrade_factory search_path hardening only

DO $$
BEGIN
  IF to_regprocedure('public.upgrade_factory(uuid, integer, uuid)') IS NOT NULL THEN
    ALTER FUNCTION public.upgrade_factory(uuid, integer, uuid)
      SET search_path = public, pg_temp;
  END IF;
END
$$;
