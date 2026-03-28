-- Defense-in-depth hardening for sensitive application/lobby flows.
-- Scope:
--   - applications table (pending application lifecycle)
--   - revolution_lobbies table (revolution/coup lobby lifecycle)
--   - critical atomic RPC grants/search_path

-- ---------------------------------------------------------------------------
-- 1) applications: enable RLS and allow read only to involved actors.
-- ---------------------------------------------------------------------------
ALTER TABLE IF EXISTS public.applications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS applications_sensitive_select ON public.applications;
CREATE POLICY applications_sensitive_select
ON public.applications
FOR SELECT
TO authenticated
USING (
  auth.uid() = "userId"
  OR EXISTS (
    SELECT 1
    FROM public.regions r
    WHERE r.id = applications."regionId"
      AND (
        r."ownerUserId" = auth.uid()
        OR r."leaderUserId" = auth.uid()
      )
  )
);

-- No INSERT/UPDATE/DELETE policy on applications for authenticated/anon roles:
-- mutating operations remain backend/service-role/RPC only.

-- ---------------------------------------------------------------------------
-- 2) revolution_lobbies: replace permissive policies with scoped read-only RLS.
-- ---------------------------------------------------------------------------
ALTER TABLE IF EXISTS public.revolution_lobbies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS revolution_lobbies_select ON public.revolution_lobbies;
DROP POLICY IF EXISTS revolution_lobbies_insert ON public.revolution_lobbies;
DROP POLICY IF EXISTS revolution_lobbies_update ON public.revolution_lobbies;

CREATE POLICY revolution_lobbies_sensitive_select
ON public.revolution_lobbies
FOR SELECT
TO authenticated
USING (
  auth.uid() = "creatorId"
  OR auth.uid() = ANY("participantIds")
  OR EXISTS (
    SELECT 1
    FROM public.regions r
    WHERE r.id = revolution_lobbies."regionId"
      AND (
        r."ownerUserId" = auth.uid()
        OR r."leaderUserId" = auth.uid()
      )
  )
  OR EXISTS (
    SELECT 1
    FROM public.users u
    WHERE u.id = auth.uid()
      AND (
        u."residenceId" = revolution_lobbies."regionId"
        OR u."workPermitId" = revolution_lobbies."regionId"
      )
  )
);

-- No INSERT/UPDATE/DELETE policy on revolution_lobbies for authenticated/anon roles:
-- mutating operations remain backend/service-role/RPC only.

-- ---------------------------------------------------------------------------
-- 3) Critical RPC surface: restrict execute grants + pin search_path.
-- ---------------------------------------------------------------------------
ALTER FUNCTION public.create_application_atomic(UUID, TEXT, TEXT, TEXT)
  SET search_path = public, pg_temp;
ALTER FUNCTION public.resolve_application_atomic(TEXT, TEXT, UUID)
  SET search_path = public, pg_temp;
ALTER FUNCTION public.expire_revolution_lobby_atomic(UUID, UUID)
  SET search_path = public, pg_temp;

REVOKE EXECUTE ON FUNCTION public.create_application_atomic(UUID, TEXT, TEXT, TEXT)
  FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.resolve_application_atomic(TEXT, TEXT, UUID)
  FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.expire_revolution_lobby_atomic(UUID, UUID)
  FROM PUBLIC;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE EXECUTE ON FUNCTION public.create_application_atomic(UUID, TEXT, TEXT, TEXT) FROM anon;
    REVOKE EXECUTE ON FUNCTION public.resolve_application_atomic(TEXT, TEXT, UUID) FROM anon;
    REVOKE EXECUTE ON FUNCTION public.expire_revolution_lobby_atomic(UUID, UUID) FROM anon;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE EXECUTE ON FUNCTION public.create_application_atomic(UUID, TEXT, TEXT, TEXT) FROM authenticated;
    REVOKE EXECUTE ON FUNCTION public.resolve_application_atomic(TEXT, TEXT, UUID) FROM authenticated;
    REVOKE EXECUTE ON FUNCTION public.expire_revolution_lobby_atomic(UUID, UUID) FROM authenticated;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    GRANT EXECUTE ON FUNCTION public.create_application_atomic(UUID, TEXT, TEXT, TEXT) TO service_role;
    GRANT EXECUTE ON FUNCTION public.resolve_application_atomic(TEXT, TEXT, UUID) TO service_role;
    GRANT EXECUTE ON FUNCTION public.expire_revolution_lobby_atomic(UUID, UUID) TO service_role;
  END IF;
END
$$;
