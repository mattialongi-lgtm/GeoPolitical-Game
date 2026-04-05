-- ============================================================
-- Daily tracking RLS hardening (incremental + fail-closed)
-- Scope: public.work_streaks, public.free_reward_claims,
--        public.daily_task_completions
-- ============================================================

-- 1) Enable RLS on Security Advisor flagged tables.
ALTER TABLE IF EXISTS public.work_streaks ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.free_reward_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.daily_task_completions ENABLE ROW LEVEL SECURITY;

-- 2) Drop broad/legacy policies if they exist.
DROP POLICY IF EXISTS "work_streaks_public_read" ON public.work_streaks;
DROP POLICY IF EXISTS "work_streaks_authenticated_read" ON public.work_streaks;
DROP POLICY IF EXISTS "work_streaks_read_own" ON public.work_streaks;

DROP POLICY IF EXISTS "free_reward_claims_public_read" ON public.free_reward_claims;
DROP POLICY IF EXISTS "free_reward_claims_authenticated_read" ON public.free_reward_claims;
DROP POLICY IF EXISTS "free_reward_claims_read_own" ON public.free_reward_claims;

DROP POLICY IF EXISTS "daily_task_completions_public_read" ON public.daily_task_completions;
DROP POLICY IF EXISTS "daily_task_completions_authenticated_read" ON public.daily_task_completions;
DROP POLICY IF EXISTS "daily_task_completions_read_own" ON public.daily_task_completions;

-- 3) Fail-closed posture: no direct client privileges.
-- Current code paths do not require direct anon/authenticated table access.
REVOKE ALL PRIVILEGES ON TABLE public.work_streaks FROM anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public.free_reward_claims FROM anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public.daily_task_completions FROM anon, authenticated;

-- 4) No anon/authenticated SELECT/INSERT/UPDATE/DELETE policies are created.
-- Access remains backend/service-role controlled until explicit client need is proven.
