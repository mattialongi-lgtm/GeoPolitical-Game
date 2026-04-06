-- Supabase linter warning fixes
-- Date: 2026-04-06
-- Fixes:
-- 1) Function Search Path Mutable on public.upgrade_factory
-- 2) RLS Policy Always True on:
--    - public.autonomy_history
--    - public.migration_agreements
--    - public.regional_budget_transactions
--    - public.regional_buildings
--    - public.regional_law_votes
--    - public.regional_laws
--    - public.regional_parliament_members

-- ---------------------------------------------------------------------------
-- 1) Harden upgrade_factory search_path
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF to_regprocedure('public.upgrade_factory(uuid, integer, uuid)') IS NOT NULL THEN
    ALTER FUNCTION public.upgrade_factory(uuid, integer, uuid)
      SET search_path = public, pg_temp;
  END IF;
END
$$;

-- ---------------------------------------------------------------------------
-- 2) Replace always-true RLS policies on the targeted tables
-- ---------------------------------------------------------------------------
ALTER TABLE IF EXISTS public.autonomy_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.migration_agreements ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.regional_budget_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.regional_buildings ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.regional_law_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.regional_laws ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.regional_parliament_members ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  target_table TEXT;
  policy_record RECORD;
BEGIN
  FOREACH target_table IN ARRAY ARRAY[
    'autonomy_history',
    'migration_agreements',
    'regional_budget_transactions',
    'regional_buildings',
    'regional_law_votes',
    'regional_laws',
    'regional_parliament_members'
  ]
  LOOP
    FOR policy_record IN
      SELECT pol.policyname
      FROM pg_policies pol
      WHERE pol.schemaname = 'public'
        AND pol.tablename = target_table
        AND (
          regexp_replace(COALESCE(pol.qual, ''), '[[:space:]()]', '', 'g') = 'true'
          OR regexp_replace(COALESCE(pol.with_check, ''), '[[:space:]()]', '', 'g') = 'true'
        )
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', policy_record.policyname, target_table);
    END LOOP;
  END LOOP;
END
$$;

DROP POLICY IF EXISTS "Autonomy history public read" ON public.autonomy_history;
DROP POLICY IF EXISTS "Autonomy history server manage" ON public.autonomy_history;
DROP POLICY IF EXISTS "migration_agreements_read" ON public.migration_agreements;
DROP POLICY IF EXISTS "migration_agreements_write" ON public.migration_agreements;
DROP POLICY IF EXISTS "Regional budget tx public read" ON public.regional_budget_transactions;
DROP POLICY IF EXISTS "Regional budget tx server manage" ON public.regional_budget_transactions;
DROP POLICY IF EXISTS "Regional buildings public read" ON public.regional_buildings;
DROP POLICY IF EXISTS "Regional buildings server manage" ON public.regional_buildings;
DROP POLICY IF EXISTS "Regional law votes public read" ON public.regional_law_votes;
DROP POLICY IF EXISTS "Regional law votes server manage" ON public.regional_law_votes;
DROP POLICY IF EXISTS "Regional laws public read" ON public.regional_laws;
DROP POLICY IF EXISTS "Regional laws server manage" ON public.regional_laws;
DROP POLICY IF EXISTS "Regional parliament public read" ON public.regional_parliament_members;
DROP POLICY IF EXISTS "Regional parliament server manage" ON public.regional_parliament_members;

CREATE POLICY "Autonomy history public read"
ON public.autonomy_history
FOR SELECT
TO anon, authenticated
USING (auth.role() IN ('anon', 'authenticated'));

CREATE POLICY "Autonomy history server manage"
ON public.autonomy_history
FOR ALL
TO service_role
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "migration_agreements_read"
ON public.migration_agreements
FOR SELECT
TO anon, authenticated
USING (auth.role() IN ('anon', 'authenticated'));

CREATE POLICY "migration_agreements_write"
ON public.migration_agreements
FOR ALL
TO service_role
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Regional budget tx public read"
ON public.regional_budget_transactions
FOR SELECT
TO anon, authenticated
USING (auth.role() IN ('anon', 'authenticated'));

CREATE POLICY "Regional budget tx server manage"
ON public.regional_budget_transactions
FOR ALL
TO service_role
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Regional buildings public read"
ON public.regional_buildings
FOR SELECT
TO anon, authenticated
USING (auth.role() IN ('anon', 'authenticated'));

CREATE POLICY "Regional buildings server manage"
ON public.regional_buildings
FOR ALL
TO service_role
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Regional law votes public read"
ON public.regional_law_votes
FOR SELECT
TO anon, authenticated
USING (auth.role() IN ('anon', 'authenticated'));

CREATE POLICY "Regional law votes server manage"
ON public.regional_law_votes
FOR ALL
TO service_role
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Regional laws public read"
ON public.regional_laws
FOR SELECT
TO anon, authenticated
USING (auth.role() IN ('anon', 'authenticated'));

CREATE POLICY "Regional laws server manage"
ON public.regional_laws
FOR ALL
TO service_role
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Regional parliament public read"
ON public.regional_parliament_members
FOR SELECT
TO anon, authenticated
USING (auth.role() IN ('anon', 'authenticated'));

CREATE POLICY "Regional parliament server manage"
ON public.regional_parliament_members
FOR ALL
TO service_role
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');
