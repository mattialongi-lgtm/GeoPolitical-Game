-- ============================================================
-- Newspaper RLS hardening (incremental + fail-closed)
-- Scope: public.newspapers, public.newspaper_members
-- ============================================================

-- 1) Ensure RLS is enabled.
ALTER TABLE IF EXISTS public.newspapers ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.newspaper_members ENABLE ROW LEVEL SECURITY;

-- 2) Remove legacy/permissive policies if they exist.
DROP POLICY IF EXISTS "Allow public read on newspapers" ON public.newspapers;
DROP POLICY IF EXISTS "Allow public read on members" ON public.newspaper_members;
DROP POLICY IF EXISTS "newspapers_authenticated_read" ON public.newspapers;
DROP POLICY IF EXISTS "newspaper_members_read_own" ON public.newspaper_members;

-- 3) Harden grants (deny write directly from client roles).
REVOKE INSERT, UPDATE, DELETE ON TABLE public.newspapers FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.newspaper_members FROM anon, authenticated;

-- 4) Keep only minimal read grants for authenticated users.
REVOKE SELECT ON TABLE public.newspapers FROM anon;
REVOKE SELECT ON TABLE public.newspaper_members FROM anon;
GRANT SELECT ON TABLE public.newspapers TO authenticated;
GRANT SELECT ON TABLE public.newspaper_members TO authenticated;

-- 5) Minimal SELECT policies.
-- Product decision: newspapers are visible in-app to authenticated users.
CREATE POLICY "newspapers_authenticated_read"
  ON public.newspapers
  FOR SELECT
  TO authenticated
  USING (true);

-- Membership is user-scoped from client perspective (own rows only).
-- Full member management/listing remains backend-only through service role.
CREATE POLICY "newspaper_members_read_own"
  ON public.newspaper_members
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- No INSERT/UPDATE/DELETE policy for anon/authenticated on these tables:
-- direct writes are intentionally blocked (fail-closed).
