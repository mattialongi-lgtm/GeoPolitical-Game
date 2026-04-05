-- ============================================================
-- Daily auto-work / rewards RLS hardening (incremental + fail-closed)
-- Scope: public.daily_auto_work, public.periodic_reward_progress,
--        public.streak_milestone_claims
-- Rationale: same cluster as daily tracking & daily gameplay
--            hardening sprint. No direct client (anon/authenticated)
--            access has been identified in the current application code.
-- Idempotent: safe to re-run at any time.
-- ============================================================

-- 1) Enable RLS on the three tables.
ALTER TABLE IF EXISTS public.daily_auto_work ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.periodic_reward_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.streak_milestone_claims ENABLE ROW LEVEL SECURITY;

-- 2) Drop broad/legacy policies if they exist.
DROP POLICY IF EXISTS "daily_auto_work_public_read" ON public.daily_auto_work;
DROP POLICY IF EXISTS "daily_auto_work_authenticated_read" ON public.daily_auto_work;
DROP POLICY IF EXISTS "daily_auto_work_read_own" ON public.daily_auto_work;
DROP POLICY IF EXISTS "daily_auto_work_all" ON public.daily_auto_work;
DROP POLICY IF EXISTS "daily_auto_work_insert_own" ON public.daily_auto_work;

DROP POLICY IF EXISTS "periodic_reward_progress_public_read" ON public.periodic_reward_progress;
DROP POLICY IF EXISTS "periodic_reward_progress_authenticated_read" ON public.periodic_reward_progress;
DROP POLICY IF EXISTS "periodic_reward_progress_read_own" ON public.periodic_reward_progress;
DROP POLICY IF EXISTS "periodic_reward_progress_all" ON public.periodic_reward_progress;
DROP POLICY IF EXISTS "periodic_reward_progress_insert_own" ON public.periodic_reward_progress;

DROP POLICY IF EXISTS "streak_milestone_claims_public_read" ON public.streak_milestone_claims;
DROP POLICY IF EXISTS "streak_milestone_claims_authenticated_read" ON public.streak_milestone_claims;
DROP POLICY IF EXISTS "streak_milestone_claims_read_own" ON public.streak_milestone_claims;
DROP POLICY IF EXISTS "streak_milestone_claims_all" ON public.streak_milestone_claims;
DROP POLICY IF EXISTS "streak_milestone_claims_insert_own" ON public.streak_milestone_claims;

-- 3) Fail-closed posture: no direct client privileges.
-- Current code paths do not require direct anon/authenticated table access.
REVOKE ALL PRIVILEGES ON TABLE public.daily_auto_work FROM anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public.periodic_reward_progress FROM anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public.streak_milestone_claims FROM anon, authenticated;

-- 4) No anon/authenticated SELECT/INSERT/UPDATE/DELETE policies are created.
-- Access remains backend/service-role controlled until explicit client need is proven.
