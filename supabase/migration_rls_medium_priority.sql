-- ============================================================
-- Medium-priority RLS hardening (incremental + fail-closed)
-- Scope: public.cooldowns, public.user_factory_cooldowns,
--        public.budget_transactions
-- Rationale: endpoint-by-endpoint review found backend-mediated
--            access patterns only (service-role and backend APIs).
--            No direct client table access is required.
-- ============================================================

-- 1) Enable RLS on target tables.
ALTER TABLE IF EXISTS public.cooldowns ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.user_factory_cooldowns ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.budget_transactions ENABLE ROW LEVEL SECURITY;

-- 2) Drop broad/legacy policies if they exist.
DROP POLICY IF EXISTS "cooldowns_public_read" ON public.cooldowns;
DROP POLICY IF EXISTS "cooldowns_authenticated_read" ON public.cooldowns;
DROP POLICY IF EXISTS "cooldowns_read_own" ON public.cooldowns;
DROP POLICY IF EXISTS "cooldowns_all" ON public.cooldowns;
DROP POLICY IF EXISTS "cooldowns_insert_own" ON public.cooldowns;
DROP POLICY IF EXISTS cooldowns_public_read ON public.cooldowns;
DROP POLICY IF EXISTS cooldowns_authenticated_read ON public.cooldowns;
DROP POLICY IF EXISTS cooldowns_read_own ON public.cooldowns;
DROP POLICY IF EXISTS cooldowns_all ON public.cooldowns;
DROP POLICY IF EXISTS cooldowns_insert_own ON public.cooldowns;

DROP POLICY IF EXISTS "user_factory_cooldowns_public_read" ON public.user_factory_cooldowns;
DROP POLICY IF EXISTS "user_factory_cooldowns_authenticated_read" ON public.user_factory_cooldowns;
DROP POLICY IF EXISTS "user_factory_cooldowns_read_own" ON public.user_factory_cooldowns;
DROP POLICY IF EXISTS "user_factory_cooldowns_all" ON public.user_factory_cooldowns;
DROP POLICY IF EXISTS "user_factory_cooldowns_insert_own" ON public.user_factory_cooldowns;
DROP POLICY IF EXISTS user_factory_cooldowns_public_read ON public.user_factory_cooldowns;
DROP POLICY IF EXISTS user_factory_cooldowns_authenticated_read ON public.user_factory_cooldowns;
DROP POLICY IF EXISTS user_factory_cooldowns_read_own ON public.user_factory_cooldowns;
DROP POLICY IF EXISTS user_factory_cooldowns_all ON public.user_factory_cooldowns;
DROP POLICY IF EXISTS user_factory_cooldowns_insert_own ON public.user_factory_cooldowns;

DROP POLICY IF EXISTS "budget_transactions_public_read" ON public.budget_transactions;
DROP POLICY IF EXISTS "budget_transactions_authenticated_read" ON public.budget_transactions;
DROP POLICY IF EXISTS "budget_transactions_read_own" ON public.budget_transactions;
DROP POLICY IF EXISTS "budget_transactions_all" ON public.budget_transactions;
DROP POLICY IF EXISTS "budget_transactions_insert_own" ON public.budget_transactions;
DROP POLICY IF EXISTS budget_transactions_public_read ON public.budget_transactions;
DROP POLICY IF EXISTS budget_transactions_authenticated_read ON public.budget_transactions;
DROP POLICY IF EXISTS budget_transactions_read_own ON public.budget_transactions;
DROP POLICY IF EXISTS budget_transactions_all ON public.budget_transactions;
DROP POLICY IF EXISTS budget_transactions_insert_own ON public.budget_transactions;

-- 3) Fail-closed posture for client roles.
-- Current code paths do not require direct anon/authenticated table access.
REVOKE ALL PRIVILEGES ON TABLE public.cooldowns FROM anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public.user_factory_cooldowns FROM anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public.budget_transactions FROM anon, authenticated;

-- 4) Intentionally no anon/authenticated SELECT/INSERT/UPDATE/DELETE policies.
-- Access remains backend/service-role controlled.
