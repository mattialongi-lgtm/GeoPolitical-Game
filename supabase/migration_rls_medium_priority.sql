-- ============================================================
-- Medium-priority RLS hardening (incremental + fail-closed)
-- Scope: public.cooldowns, public.user_factory_cooldowns,
--        public.budget_transactions
-- Rationale: endpoint-by-endpoint analysis (see
--   docs/rls-medium-priority-analysis.md) confirms all three
--   tables are accessed exclusively via service-role on the
--   backend. No authenticated/anon client path exists.
-- Pattern: same fail-closed posture used in previous tranches
--   (daily-tracking, daily-gameplay, daily-auto-work).
-- Idempotent: safe to re-run at any time.
-- ============================================================

-- 1) Enable RLS on the three medium-priority tables.
ALTER TABLE IF EXISTS public.cooldowns ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.user_factory_cooldowns ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.budget_transactions ENABLE ROW LEVEL SECURITY;

-- 2) Drop potentially broad / legacy policies if present.
DROP POLICY IF EXISTS "cooldowns_public_read" ON public.cooldowns;
DROP POLICY IF EXISTS "cooldowns_authenticated_read" ON public.cooldowns;
DROP POLICY IF EXISTS "cooldowns_read_own" ON public.cooldowns;
DROP POLICY IF EXISTS "cooldowns_all" ON public.cooldowns;
DROP POLICY IF EXISTS "cooldowns_insert_own" ON public.cooldowns;

DROP POLICY IF EXISTS "user_factory_cooldowns_public_read" ON public.user_factory_cooldowns;
DROP POLICY IF EXISTS "user_factory_cooldowns_authenticated_read" ON public.user_factory_cooldowns;
DROP POLICY IF EXISTS "user_factory_cooldowns_read_own" ON public.user_factory_cooldowns;
DROP POLICY IF EXISTS "user_factory_cooldowns_all" ON public.user_factory_cooldowns;
DROP POLICY IF EXISTS "user_factory_cooldowns_insert_own" ON public.user_factory_cooldowns;

DROP POLICY IF EXISTS "budget_transactions_public_read" ON public.budget_transactions;
DROP POLICY IF EXISTS "budget_transactions_authenticated_read" ON public.budget_transactions;
DROP POLICY IF EXISTS "budget_transactions_read_own" ON public.budget_transactions;
DROP POLICY IF EXISTS "budget_transactions_all" ON public.budget_transactions;
DROP POLICY IF EXISTS "budget_transactions_insert_own" ON public.budget_transactions;

-- 3) Fail-closed grants for client roles.
-- Current app flows do not require direct client access to these tables.
REVOKE ALL PRIVILEGES ON TABLE public.cooldowns FROM anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public.user_factory_cooldowns FROM anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public.budget_transactions FROM anon, authenticated;

-- 4) No anon/authenticated SELECT/INSERT/UPDATE/DELETE policies are created.
-- Access remains backend/service-role controlled until explicit client need is proven.
