-- ============================================================
-- Daily progress final RLS tranche (incremental + fail-closed)
-- Scope: public.daily_auto_work, public.periodic_reward_progress,
--        public.streak_milestone_claims
-- ============================================================

-- 1) Enable RLS on remaining daily progress tables.
ALTER TABLE IF EXISTS public.daily_auto_work ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.periodic_reward_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.streak_milestone_claims ENABLE ROW LEVEL SECURITY;

-- 2) Drop potentially broad/legacy policy names if present.
DROP POLICY IF EXISTS "daily_auto_work_public_read" ON public.daily_auto_work;
DROP POLICY IF EXISTS "daily_auto_work_authenticated_read" ON public.daily_auto_work;
DROP POLICY IF EXISTS "daily_auto_work_read_own" ON public.daily_auto_work;

DROP POLICY IF EXISTS "periodic_reward_progress_public_read" ON public.periodic_reward_progress;
DROP POLICY IF EXISTS "periodic_reward_progress_authenticated_read" ON public.periodic_reward_progress;
DROP POLICY IF EXISTS "periodic_reward_progress_read_own" ON public.periodic_reward_progress;

DROP POLICY IF EXISTS "streak_milestone_claims_public_read" ON public.streak_milestone_claims;
DROP POLICY IF EXISTS "streak_milestone_claims_authenticated_read" ON public.streak_milestone_claims;
DROP POLICY IF EXISTS "streak_milestone_claims_read_own" ON public.streak_milestone_claims;

-- 3) Fail-closed grants for client roles.
REVOKE ALL PRIVILEGES ON TABLE public.daily_auto_work FROM anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public.periodic_reward_progress FROM anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public.streak_milestone_claims FROM anon, authenticated;

-- 4) No anon/authenticated policies created intentionally.
-- Access remains backend/service-role controlled until a proven client need emerges.
