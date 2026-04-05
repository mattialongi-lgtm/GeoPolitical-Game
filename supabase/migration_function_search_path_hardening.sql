-- Security hardening migration
-- Scope: fix "Function Search Path Mutable" warnings only.
-- Strategy: pin search_path on existing public functions without changing body,
-- signature, return type, grants, or business logic.

DO $$
DECLARE
  fn_signature TEXT;
BEGIN
  FOREACH fn_signature IN ARRAY ARRAY[
    'public.add_budget_transaction(text, text, text, text, bigint, jsonb, text, jsonb)',
    'public.add_budget_transaction(text, text, text, text, bigint, jsonb, uuid, jsonb)',
    'public.process_work_action(text, uuid, integer, bigint, bigint, text)',
    'public.process_work_action(uuid, uuid, integer, bigint, bigint, text)',
    'public.add_user_xp(text, integer)',
    'public.add_user_xp(uuid, integer)',
    'public.update_region_stability(text, integer)',
    'public.process_invest_action(text, integer, integer, integer)',
    'public.get_election_votes_count(text)',
    'public.execute_factory_work(text, uuid, bigint, text, integer, integer, text)',
    'public.execute_factory_work(uuid, uuid, bigint, text, integer, integer, uuid)',
    'public.increment_factory_storage(uuid, integer)',
    'public.create_market_offer(text, text, integer, bigint, text, integer, text)',
    'public.purchase_market_offer(text, text, integer, boolean, text)',
    'public.increment_candidate_votes(text, text)',
    'public.upgrade_factory(uuid, integer, uuid)',
    'public.safe_deduct_currency(uuid, numeric, numeric, numeric)',
    'public.upsert_factory_economy_log(uuid, bigint, bigint, bigint, bigint)',
    'public.transfer_factory_ownership(uuid, uuid, uuid, bigint, uuid)',
    'public.increment_factory_counters(uuid, integer, bigint, bigint, bigint, bigint)',
    'public.record_daily_work(uuid)',
    'public.claim_academy_reward(uuid, text, jsonb)',
    'public.update_mission_progress(uuid, text, date, integer)',
    'public.claim_mission_reward(uuid, uuid)',
    'public.resolve_war(text)',
    'public.calculate_war_damage(uuid, text, text, integer)'
  ]
  LOOP
    IF to_regprocedure(fn_signature) IS NOT NULL THEN
      EXECUTE format(
        'ALTER FUNCTION %s SET search_path = public, pg_temp',
        fn_signature
      );
    END IF;
  END LOOP;
END
$$;

-- ---------------------------------------------------------------------------
-- RLS hardening
-- Scope: fix "RLS Policy Always True" warnings only on report-targeted tables.
-- Strategy:
--   1) remove permissive policies whose USING / WITH CHECK resolves to true
--   2) recreate minimal read-only policies for anon/authenticated API roles
--   3) leave writes to backend service_role flows already used by server.ts
-- ---------------------------------------------------------------------------

DO $$
DECLARE
  target_table TEXT;
  policy_record RECORD;
BEGIN
  FOREACH target_table IN ARRAY ARRAY[
    'articles',
    'article_comments',
    'article_votes',
    'autonomy_history',
    'party_primaries',
    'perks',
    'player_resource_work_experience',
    'production_queue',
    'sanctions',
    'user_inventory',
    'blocs',
    'bloc_memberships',
    'bloc_applications',
    'bloc_regulations',
    'bloc_regulation_proposals',
    'bloc_votes',
    'war_auto_attacks',
    'war_departments',
    'war_deployments',
    'war_history',
    'war_military_agreements',
    'war_participants',
    'wars',
    'work_permits'
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

DROP POLICY IF EXISTS "Articles are viewable by everyone" ON public.articles;
DROP POLICY IF EXISTS "Server can manage articles" ON public.articles;
DROP POLICY IF EXISTS "Article comments are viewable by everyone" ON public.article_comments;
DROP POLICY IF EXISTS "Server can manage article comments" ON public.article_comments;
DROP POLICY IF EXISTS "Article votes are viewable by everyone" ON public.article_votes;
DROP POLICY IF EXISTS "Server can manage article votes" ON public.article_votes;
DROP POLICY IF EXISTS "Autonomy history public read" ON public.autonomy_history;
DROP POLICY IF EXISTS "Autonomy history server manage" ON public.autonomy_history;
DROP POLICY IF EXISTS "Party primaries public read" ON public.party_primaries;
DROP POLICY IF EXISTS "Party primaries server manage" ON public.party_primaries;
DROP POLICY IF EXISTS "Perks are viewable by everyone" ON public.perks;
DROP POLICY IF EXISTS "Server can manage perks" ON public.perks;
DROP POLICY IF EXISTS "prwe_select" ON public.player_resource_work_experience;
DROP POLICY IF EXISTS "prwe_insert" ON public.player_resource_work_experience;
DROP POLICY IF EXISTS "prwe_update" ON public.player_resource_work_experience;
DROP POLICY IF EXISTS "prwe_read" ON public.player_resource_work_experience;
DROP POLICY IF EXISTS "Production queue public read" ON public.production_queue;
DROP POLICY IF EXISTS "Production queue server manage" ON public.production_queue;
DROP POLICY IF EXISTS "Sanctions public read" ON public.sanctions;
DROP POLICY IF EXISTS "Sanctions server manage" ON public.sanctions;
DROP POLICY IF EXISTS "User inventory public read" ON public.user_inventory;
DROP POLICY IF EXISTS "User inventory server manage" ON public.user_inventory;
DROP POLICY IF EXISTS "Blocs public read" ON public.blocs;
DROP POLICY IF EXISTS "Blocs server manage" ON public.blocs;
DROP POLICY IF EXISTS "Bloc memberships public read" ON public.bloc_memberships;
DROP POLICY IF EXISTS "Bloc memberships server manage" ON public.bloc_memberships;
DROP POLICY IF EXISTS "Bloc applications public read" ON public.bloc_applications;
DROP POLICY IF EXISTS "Bloc applications server manage" ON public.bloc_applications;
DROP POLICY IF EXISTS "Bloc regulations public read" ON public.bloc_regulations;
DROP POLICY IF EXISTS "Bloc regulations server manage" ON public.bloc_regulations;
DROP POLICY IF EXISTS "Bloc regulation proposals public read" ON public.bloc_regulation_proposals;
DROP POLICY IF EXISTS "Bloc regulation proposals server manage" ON public.bloc_regulation_proposals;
DROP POLICY IF EXISTS "Bloc votes public read" ON public.bloc_votes;
DROP POLICY IF EXISTS "Bloc votes server manage" ON public.bloc_votes;
DROP POLICY IF EXISTS "Public read wars" ON public.wars;
DROP POLICY IF EXISTS "Server manage wars" ON public.wars;
DROP POLICY IF EXISTS "Public read war_participants" ON public.war_participants;
DROP POLICY IF EXISTS "Server manage war_participants" ON public.war_participants;
DROP POLICY IF EXISTS "Public read war_deployments" ON public.war_deployments;
DROP POLICY IF EXISTS "Server manage war_deployments" ON public.war_deployments;
DROP POLICY IF EXISTS "Public read war_auto_attacks" ON public.war_auto_attacks;
DROP POLICY IF EXISTS "Server manage war_auto_attacks" ON public.war_auto_attacks;
DROP POLICY IF EXISTS "Public read war_military_agreements" ON public.war_military_agreements;
DROP POLICY IF EXISTS "Server manage war_military_agreements" ON public.war_military_agreements;
DROP POLICY IF EXISTS "Public read war_departments" ON public.war_departments;
DROP POLICY IF EXISTS "Server manage war_departments" ON public.war_departments;
DROP POLICY IF EXISTS "Public read war_history" ON public.war_history;
DROP POLICY IF EXISTS "Server manage war_history" ON public.war_history;
DROP POLICY IF EXISTS "Work permits public read" ON public.work_permits;
DROP POLICY IF EXISTS "Work permits server manage" ON public.work_permits;

CREATE POLICY "Articles are viewable by everyone"
ON public.articles
FOR SELECT
TO anon, authenticated
USING (auth.role() IN ('anon', 'authenticated'));

CREATE POLICY "Server can manage articles"
ON public.articles
FOR ALL
TO service_role
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Article comments are viewable by everyone"
ON public.article_comments
FOR SELECT
TO anon, authenticated
USING (auth.role() IN ('anon', 'authenticated'));

CREATE POLICY "Server can manage article comments"
ON public.article_comments
FOR ALL
TO service_role
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Article votes are viewable by everyone"
ON public.article_votes
FOR SELECT
TO anon, authenticated
USING (auth.role() IN ('anon', 'authenticated'));

CREATE POLICY "Server can manage article votes"
ON public.article_votes
FOR ALL
TO service_role
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

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

CREATE POLICY "Party primaries public read"
ON public.party_primaries
FOR SELECT
TO anon, authenticated
USING (auth.role() IN ('anon', 'authenticated'));

CREATE POLICY "Party primaries server manage"
ON public.party_primaries
FOR ALL
TO service_role
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Perks are viewable by everyone"
ON public.perks
FOR SELECT
TO anon, authenticated
USING (auth.role() IN ('anon', 'authenticated'));

CREATE POLICY "Server can manage perks"
ON public.perks
FOR ALL
TO service_role
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "prwe_select"
ON public.player_resource_work_experience
FOR SELECT
TO anon, authenticated
USING (auth.role() IN ('anon', 'authenticated'));

CREATE POLICY "prwe_insert"
ON public.player_resource_work_experience
FOR INSERT
TO service_role
WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "prwe_update"
ON public.player_resource_work_experience
FOR UPDATE
TO service_role
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Production queue public read"
ON public.production_queue
FOR SELECT
TO anon, authenticated
USING (auth.role() IN ('anon', 'authenticated'));

CREATE POLICY "Production queue server manage"
ON public.production_queue
FOR ALL
TO service_role
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Sanctions public read"
ON public.sanctions
FOR SELECT
TO anon, authenticated
USING (auth.role() IN ('anon', 'authenticated'));

CREATE POLICY "Sanctions server manage"
ON public.sanctions
FOR ALL
TO service_role
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "User inventory public read"
ON public.user_inventory
FOR SELECT
TO anon, authenticated
USING (auth.role() IN ('anon', 'authenticated'));

CREATE POLICY "User inventory server manage"
ON public.user_inventory
FOR ALL
TO service_role
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Blocs public read"
ON public.blocs
FOR SELECT
TO anon, authenticated
USING (auth.role() IN ('anon', 'authenticated'));

CREATE POLICY "Blocs server manage"
ON public.blocs
FOR ALL
TO service_role
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Bloc memberships public read"
ON public.bloc_memberships
FOR SELECT
TO anon, authenticated
USING (auth.role() IN ('anon', 'authenticated'));

CREATE POLICY "Bloc memberships server manage"
ON public.bloc_memberships
FOR ALL
TO service_role
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Bloc applications public read"
ON public.bloc_applications
FOR SELECT
TO anon, authenticated
USING (auth.role() IN ('anon', 'authenticated'));

CREATE POLICY "Bloc applications server manage"
ON public.bloc_applications
FOR ALL
TO service_role
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Bloc regulations public read"
ON public.bloc_regulations
FOR SELECT
TO anon, authenticated
USING (auth.role() IN ('anon', 'authenticated'));

CREATE POLICY "Bloc regulations server manage"
ON public.bloc_regulations
FOR ALL
TO service_role
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Bloc regulation proposals public read"
ON public.bloc_regulation_proposals
FOR SELECT
TO anon, authenticated
USING (auth.role() IN ('anon', 'authenticated'));

CREATE POLICY "Bloc regulation proposals server manage"
ON public.bloc_regulation_proposals
FOR ALL
TO service_role
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Bloc votes public read"
ON public.bloc_votes
FOR SELECT
TO anon, authenticated
USING (auth.role() IN ('anon', 'authenticated'));

CREATE POLICY "Bloc votes server manage"
ON public.bloc_votes
FOR ALL
TO service_role
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Public read wars"
ON public.wars
FOR SELECT
TO anon, authenticated
USING (auth.role() IN ('anon', 'authenticated'));

CREATE POLICY "Server manage wars"
ON public.wars
FOR ALL
TO service_role
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Public read war_participants"
ON public.war_participants
FOR SELECT
TO anon, authenticated
USING (auth.role() IN ('anon', 'authenticated'));

CREATE POLICY "Server manage war_participants"
ON public.war_participants
FOR ALL
TO service_role
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Public read war_deployments"
ON public.war_deployments
FOR SELECT
TO anon, authenticated
USING (auth.role() IN ('anon', 'authenticated'));

CREATE POLICY "Server manage war_deployments"
ON public.war_deployments
FOR ALL
TO service_role
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Public read war_auto_attacks"
ON public.war_auto_attacks
FOR SELECT
TO anon, authenticated
USING (auth.role() IN ('anon', 'authenticated'));

CREATE POLICY "Server manage war_auto_attacks"
ON public.war_auto_attacks
FOR ALL
TO service_role
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Public read war_military_agreements"
ON public.war_military_agreements
FOR SELECT
TO anon, authenticated
USING (auth.role() IN ('anon', 'authenticated'));

CREATE POLICY "Server manage war_military_agreements"
ON public.war_military_agreements
FOR ALL
TO service_role
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Public read war_departments"
ON public.war_departments
FOR SELECT
TO anon, authenticated
USING (auth.role() IN ('anon', 'authenticated'));

CREATE POLICY "Server manage war_departments"
ON public.war_departments
FOR ALL
TO service_role
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Public read war_history"
ON public.war_history
FOR SELECT
TO anon, authenticated
USING (auth.role() IN ('anon', 'authenticated'));

CREATE POLICY "Server manage war_history"
ON public.war_history
FOR ALL
TO service_role
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Work permits public read"
ON public.work_permits
FOR SELECT
TO anon, authenticated
USING (auth.role() IN ('anon', 'authenticated'));

CREATE POLICY "Work permits server manage"
ON public.work_permits
FOR ALL
TO service_role
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');
