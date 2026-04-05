-- ============================================================
-- Daily gameplay RLS hardening (incremental + fail-closed)
-- Scope: public.daily_damage_log, public.military_academy_claims
-- ============================================================

-- 1) Enable RLS on both tables flagged by Security Advisor.
ALTER TABLE IF EXISTS public.daily_damage_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.military_academy_claims ENABLE ROW LEVEL SECURITY;

-- 2) Drop potentially broad / legacy policies if present.
DROP POLICY IF EXISTS "daily_damage_log_public_read" ON public.daily_damage_log;
DROP POLICY IF EXISTS "daily_damage_log_authenticated_read" ON public.daily_damage_log;
DROP POLICY IF EXISTS "daily_damage_log_read_own" ON public.daily_damage_log;
DROP POLICY IF EXISTS "military_academy_claims_public_read" ON public.military_academy_claims;
DROP POLICY IF EXISTS "military_academy_claims_authenticated_read" ON public.military_academy_claims;
DROP POLICY IF EXISTS "military_academy_claims_read_own" ON public.military_academy_claims;

-- 3) Fail-closed grants for client roles.
-- Current app flows do not require direct client access to these tables.
REVOKE ALL PRIVILEGES ON TABLE public.daily_damage_log FROM anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public.military_academy_claims FROM anon, authenticated;

-- 4) No anon/authenticated policies are created intentionally.
-- Writes and reads remain backend-only via service role / controlled APIs.
