-- Residual Supabase linter security fixes
-- Scope: only the remaining warnings explicitly listed by the user.

-- 1) Function Search Path Mutable: public.upgrade_factory
DO $$
BEGIN
  IF to_regprocedure('public.upgrade_factory(uuid, integer, uuid)') IS NOT NULL THEN
    ALTER FUNCTION public.upgrade_factory(uuid, integer, uuid)
      SET search_path = public, pg_temp;
  END IF;
END
$$;

-- 2) RLS Policy Always True: residual tables only
DO $$
DECLARE
  target_table TEXT;
  policy_record RECORD;
BEGIN
  FOREACH target_table IN ARRAY ARRAY[
    'chat_messages',
    'coups',
    'election_votes',
    'elections',
    'factory_economy_logs',
    'factory_upgrade_log',
    'factory_worker_logs',
    'law_votes',
    'laws',
    'leader_candidates',
    'leader_votes',
    'market_transactions_log',
    'military_agreements',
    'ministers',
    'nations',
    'parliament_members',
    'parties',
    'party_invites',
    'party_logs',
    'party_members',
    'regional_budget_transactions',
    'regional_buildings',
    'regional_law_votes',
    'regional_laws',
    'regional_parliament_members',
    'revolutions'
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

DROP POLICY IF EXISTS "Chat messages are viewable by everyone" ON public.chat_messages;
DROP POLICY IF EXISTS "Server can manage chat" ON public.chat_messages;
DROP POLICY IF EXISTS "Public read coups" ON public.coups;
DROP POLICY IF EXISTS "Server manage coups" ON public.coups;
DROP POLICY IF EXISTS "Election votes public read" ON public.election_votes;
DROP POLICY IF EXISTS "Election votes server manage" ON public.election_votes;
DROP POLICY IF EXISTS "Elections public read" ON public.elections;
DROP POLICY IF EXISTS "Elections server manage" ON public.elections;
DROP POLICY IF EXISTS "factory_econ_read" ON public.factory_economy_logs;
DROP POLICY IF EXISTS "factory_econ_write" ON public.factory_economy_logs;
DROP POLICY IF EXISTS "Service role can insert upgrade logs" ON public.factory_upgrade_log;
DROP POLICY IF EXISTS "factory_worker_read" ON public.factory_worker_logs;
DROP POLICY IF EXISTS "factory_worker_write" ON public.factory_worker_logs;
DROP POLICY IF EXISTS "Law votes public read" ON public.law_votes;
DROP POLICY IF EXISTS "Law votes server manage" ON public.law_votes;
DROP POLICY IF EXISTS "Laws public read" ON public.laws;
DROP POLICY IF EXISTS "Laws server manage" ON public.laws;
DROP POLICY IF EXISTS "Leader candidates public read" ON public.leader_candidates;
DROP POLICY IF EXISTS "Leader candidates server manage" ON public.leader_candidates;
DROP POLICY IF EXISTS "Leader votes public read" ON public.leader_votes;
DROP POLICY IF EXISTS "Leader votes server manage" ON public.leader_votes;
DROP POLICY IF EXISTS "Market transactions log public read" ON public.market_transactions_log;
DROP POLICY IF EXISTS "Market transactions log server manage" ON public.market_transactions_log;
DROP POLICY IF EXISTS "Military agreements public read" ON public.military_agreements;
DROP POLICY IF EXISTS "Military agreements server manage" ON public.military_agreements;
DROP POLICY IF EXISTS "Ministers public read" ON public.ministers;
DROP POLICY IF EXISTS "Ministers server manage" ON public.ministers;
DROP POLICY IF EXISTS "Nations public read" ON public.nations;
DROP POLICY IF EXISTS "Nations server manage" ON public.nations;
DROP POLICY IF EXISTS "Parliament members public read" ON public.parliament_members;
DROP POLICY IF EXISTS "Parliament members server manage" ON public.parliament_members;
DROP POLICY IF EXISTS "Parties public read" ON public.parties;
DROP POLICY IF EXISTS "Parties server manage" ON public.parties;
DROP POLICY IF EXISTS "Party invites public read" ON public.party_invites;
DROP POLICY IF EXISTS "Party invites server manage" ON public.party_invites;
DROP POLICY IF EXISTS "Party logs public read" ON public.party_logs;
DROP POLICY IF EXISTS "Party logs server manage" ON public.party_logs;
DROP POLICY IF EXISTS "Party members public read" ON public.party_members;
DROP POLICY IF EXISTS "Party members server manage" ON public.party_members;
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
DROP POLICY IF EXISTS "Public read revolutions" ON public.revolutions;
DROP POLICY IF EXISTS "Server manage revolutions" ON public.revolutions;

CREATE POLICY "Chat messages are viewable by everyone"
ON public.chat_messages
FOR SELECT
TO anon, authenticated
USING (auth.role() IN ('anon', 'authenticated'));

CREATE POLICY "Server can manage chat"
ON public.chat_messages
FOR ALL
TO service_role
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Public read coups"
ON public.coups
FOR SELECT
TO anon, authenticated
USING (auth.role() IN ('anon', 'authenticated'));

CREATE POLICY "Server manage coups"
ON public.coups
FOR ALL
TO service_role
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Election votes public read"
ON public.election_votes
FOR SELECT
TO anon, authenticated
USING (auth.role() IN ('anon', 'authenticated'));

CREATE POLICY "Election votes server manage"
ON public.election_votes
FOR ALL
TO service_role
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Elections public read"
ON public.elections
FOR SELECT
TO anon, authenticated
USING (auth.role() IN ('anon', 'authenticated'));

CREATE POLICY "Elections server manage"
ON public.elections
FOR ALL
TO service_role
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "factory_econ_read"
ON public.factory_economy_logs
FOR SELECT
TO anon, authenticated
USING (auth.role() IN ('anon', 'authenticated'));

CREATE POLICY "factory_econ_write"
ON public.factory_economy_logs
FOR ALL
TO service_role
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Service role can insert upgrade logs"
ON public.factory_upgrade_log
FOR INSERT
TO service_role
WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "factory_worker_read"
ON public.factory_worker_logs
FOR SELECT
TO anon, authenticated
USING (auth.role() IN ('anon', 'authenticated'));

CREATE POLICY "factory_worker_write"
ON public.factory_worker_logs
FOR ALL
TO service_role
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Law votes public read"
ON public.law_votes
FOR SELECT
TO anon, authenticated
USING (auth.role() IN ('anon', 'authenticated'));

CREATE POLICY "Law votes server manage"
ON public.law_votes
FOR ALL
TO service_role
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Laws public read"
ON public.laws
FOR SELECT
TO anon, authenticated
USING (auth.role() IN ('anon', 'authenticated'));

CREATE POLICY "Laws server manage"
ON public.laws
FOR ALL
TO service_role
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Leader candidates public read"
ON public.leader_candidates
FOR SELECT
TO anon, authenticated
USING (auth.role() IN ('anon', 'authenticated'));

CREATE POLICY "Leader candidates server manage"
ON public.leader_candidates
FOR ALL
TO service_role
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Leader votes public read"
ON public.leader_votes
FOR SELECT
TO anon, authenticated
USING (auth.role() IN ('anon', 'authenticated'));

CREATE POLICY "Leader votes server manage"
ON public.leader_votes
FOR ALL
TO service_role
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Market transactions log public read"
ON public.market_transactions_log
FOR SELECT
TO anon, authenticated
USING (auth.role() IN ('anon', 'authenticated'));

CREATE POLICY "Market transactions log server manage"
ON public.market_transactions_log
FOR ALL
TO service_role
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Military agreements public read"
ON public.military_agreements
FOR SELECT
TO anon, authenticated
USING (auth.role() IN ('anon', 'authenticated'));

CREATE POLICY "Military agreements server manage"
ON public.military_agreements
FOR ALL
TO service_role
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Ministers public read"
ON public.ministers
FOR SELECT
TO anon, authenticated
USING (auth.role() IN ('anon', 'authenticated'));

CREATE POLICY "Ministers server manage"
ON public.ministers
FOR ALL
TO service_role
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Nations public read"
ON public.nations
FOR SELECT
TO anon, authenticated
USING (auth.role() IN ('anon', 'authenticated'));

CREATE POLICY "Nations server manage"
ON public.nations
FOR ALL
TO service_role
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Parliament members public read"
ON public.parliament_members
FOR SELECT
TO anon, authenticated
USING (auth.role() IN ('anon', 'authenticated'));

CREATE POLICY "Parliament members server manage"
ON public.parliament_members
FOR ALL
TO service_role
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Parties public read"
ON public.parties
FOR SELECT
TO anon, authenticated
USING (auth.role() IN ('anon', 'authenticated'));

CREATE POLICY "Parties server manage"
ON public.parties
FOR ALL
TO service_role
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Party invites public read"
ON public.party_invites
FOR SELECT
TO anon, authenticated
USING (auth.role() IN ('anon', 'authenticated'));

CREATE POLICY "Party invites server manage"
ON public.party_invites
FOR ALL
TO service_role
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Party logs public read"
ON public.party_logs
FOR SELECT
TO anon, authenticated
USING (auth.role() IN ('anon', 'authenticated'));

CREATE POLICY "Party logs server manage"
ON public.party_logs
FOR ALL
TO service_role
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Party members public read"
ON public.party_members
FOR SELECT
TO anon, authenticated
USING (auth.role() IN ('anon', 'authenticated'));

CREATE POLICY "Party members server manage"
ON public.party_members
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

CREATE POLICY "Public read revolutions"
ON public.revolutions
FOR SELECT
TO anon, authenticated
USING (auth.role() IN ('anon', 'authenticated'));

CREATE POLICY "Server manage revolutions"
ON public.revolutions
FOR ALL
TO service_role
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');
