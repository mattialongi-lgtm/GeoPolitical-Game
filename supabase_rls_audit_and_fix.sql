/**
 * RLS Policy Audit & Hardening Script for GeoPolitical-Game
 *
 * IMPORTANTE: Esegui questo script nel SQL Editor di Supabase, NON in produzione senza test
 *
 * Questo script:
 * 1. Audita le RLS policy attuali (identifica `USING (true)` permissive)
 * 2. Audita i role grants (chi ha accesso a quale tabella)
 * 3. Fornisce template SQL per tightening delle policy
 *
 * ISTRUZIONI:
 * - Esegui la sezione "AUDIT" prima di fare cambiamenti
 * - Tieni i risultati
 * - Usa la sezione "TEMPLATE FIXES" come guida per rimpiazzare le policy
 * - Testa su una copia del database prima di applicare in produzione
 */

-- ============================================================================
-- PARTE 1: AUDIT DELLE POLICY ATTUALI
-- ============================================================================

-- 1.1 Identifica TUTTE le policy permissive (USING (true))
SELECT
  schemaname,
  tablename,
  policyname,
  qual,
  permissive,
  roles,
  cmd
FROM pg_policies
WHERE schemaname = 'public'
  AND qual = 't'  -- USING (true) = sempre true
ORDER BY tablename, policyname;

-- Conteggio policy permissive per tabella
SELECT
  tablename,
  COUNT(*) as permissive_policies
FROM pg_policies
WHERE schemaname = 'public'
  AND qual = 't'
GROUP BY tablename
ORDER BY permissive_policies DESC;

-- ============================================================================
-- PARTE 2: AUDIT ROLE GRANTS (Chi ha accesso a quale tabella?)
-- ============================================================================

-- 2.1 Identifica chi ha accesso a tabelle sensibili
SELECT
  table_name,
  grantee,
  string_agg(privilege_type, ', ') as privileges
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND grantee IN ('anon', 'authenticated', 'service_role')
GROUP BY table_name, grantee
ORDER BY table_name, grantee;

-- 2.2 Tabelle accessibili da 'authenticated' (possibi rischio se RLS è permissivo)
SELECT
  table_name,
  string_agg(privilege_type, ', ') as privileges
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND grantee = 'authenticated'
ORDER BY table_name;

-- ============================================================================
-- PARTE 3: VERIFICA DELL'ABILITAZIONE RLS
-- ============================================================================

-- 3.1 Quali tabelle hanno RLS abilitato?
SELECT
  schemaname,
  tablename,
  rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;

-- 3.2 Tabelle SENZA RLS abilitato (⚠️ CRITICO se `authenticated` ha grant)
SELECT
  schemaname,
  tablename,
  rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND rowsecurity = FALSE
ORDER BY tablename;

-- ============================================================================
-- PARTE 4: TEMPLATE FIX PER POLICY PERMISSIVE
-- ============================================================================

/**
 * ESEMPI DI POLICY CORRETTE (Ownership-based)
 *
 * Pattern 1: Utente proprietario può leggere
 * CREATE POLICY "user_read_own" ON users
 *   FOR SELECT
 *   USING (auth.uid() = id);
 *
 * Pattern 2: Utente proprietario di una risorsa può modificarla
 * CREATE POLICY "region_update_owner" ON regions
 *   FOR UPDATE
 *   USING (auth.uid() = owner_user_id)
 *   WITH CHECK (auth.uid() = owner_user_id);
 *
 * Pattern 3: Admin (tramite service_role) può fare tutto
 * CREATE POLICY "admin_bypass" ON sensitive_table
 *   FOR ALL
 *   USING (current_setting('role') = 'service_role');
 */

-- ============================================================================
-- PARTE 5: SCRIPT PER TIGHTENING DELLE POLICY PRINCIPALI
-- ============================================================================

/**
 * ESEGUI QUESTI COMANDI UNO ALLA VOLTA dopo aver verificato l'output del PART 1-2
 *
 * Istruzioni:
 * 1. Esegui la sezione AUDIT (PART 1-3) e salva i risultati
 * 2. Per ogni tabella con policy permissive, identifica il pattern ownership
 * 3. DROPPA la policy permissiva e crea una nuova policy ownership-based
 * 4. TESTA su staging prima di applicare in produzione
 */

-- TEMPLATE: Fix per tabella "users"
-- DROP POLICY "allow_all_users" ON users;  -- Adatta il nome
-- CREATE POLICY "users_read_own" ON users
--   FOR SELECT
--   USING (auth.uid() = id);
-- CREATE POLICY "users_update_own" ON users
--   FOR UPDATE
--   USING (auth.uid() = id)
--   WITH CHECK (auth.uid() = id);

-- TEMPLATE: Fix per tabella "regions"
-- DROP POLICY "allow_all_regions" ON regions;
-- CREATE POLICY "regions_select_owned" ON regions
--   FOR SELECT
--   USING (auth.uid() = owner_user_id OR TRUE);  -- Tutti leggono, ma solo owner modifica
-- CREATE POLICY "regions_update_owner" ON regions
--   FOR UPDATE
--   USING (auth.uid() = owner_user_id)
--   WITH CHECK (auth.uid() = owner_user_id);

-- TEMPLATE: Fix per tabella "wars"
-- DROP POLICY "allow_all_wars" ON wars;
-- CREATE POLICY "wars_select_all" ON wars
--   FOR SELECT
--   USING (TRUE);  -- Tutti vedono le guerre
-- CREATE POLICY "wars_insert_attacker" ON wars
--   FOR INSERT
--   WITH CHECK (auth.uid() = initiator_user_id);
-- CREATE POLICY "wars_update_admin" ON wars
--   FOR UPDATE
--   USING (current_setting('role') = 'service_role');  -- Solo backend

-- ============================================================================
-- PARTE 6: VERIFICA POST-TIGHTENING
-- ============================================================================

/**
 * Dopo aver aplicato i fix, esegui questi comandi per verificare:
 */

-- 6.1 Verifica che RLS è abilitato su tutte le tabelle sensibili
SELECT
  tablename,
  rowsecurity,
  CASE
    WHEN rowsecurity THEN '✅ RLS ENABLED'
    ELSE '❌ RLS DISABLED'
  END as status
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('users', 'regions', 'wars', 'articles', 'parties', 'laws', 'elections')
ORDER BY tablename;

-- 6.2 Verifica che non ci sono più policy permissive
SELECT
  tablename,
  COUNT(*) as remaining_permissive_policies
FROM pg_policies
WHERE schemaname = 'public'
  AND qual = 't'
GROUP BY tablename;
-- Dovrebbe ritornare ZERO righe

-- 6.3 Verifica che ogni tabella sensibile ha almeno una policy
SELECT
  t.tablename,
  COUNT(p.policyname) as policy_count
FROM pg_tables t
LEFT JOIN pg_policies p ON t.tablename = p.tablename AND p.schemaname = 'public'
WHERE t.schemaname = 'public'
  AND t.tablename IN ('users', 'regions', 'wars', 'articles', 'parties', 'laws', 'elections')
GROUP BY t.tablename
ORDER BY t.tablename;

-- ============================================================================
-- PARTE 7: TABELLE SENSIBILI CONSIGLIATE CON RLS TIGHTENING
-- ============================================================================

/**
 * Priorità di tightening (da alta a bassa):
 *
 * ALTA (Blocca modifica diretta):
 * - users (solo il proprietario può modificare se stesso)
 * - regions (solo il leader/owner può modificare)
 * - wars (solo il server può creare/modificare)
 * - parties (solo il leader può modificare)
 * - laws (solo il server può modificare)
 *
 * MEDIA (Limita lettura):
 * - elections (tutti leggono, solo server modifica)
 * - articles (tutti leggono, solo autore/newspaper modifica)
 * - budgets (proprietario legge/modifica)
 *
 * BASSA (Informativo, meno critico):
 * - cooldowns (user-scoped)
 * - notifications (user-scoped)
 *
 * NOTA: Alcune tabelle potrebbero permettere SELECT public ma bloccare UPDATE/DELETE
 * (es. articles sono leggibili da tutti ma modificabili solo dall'autore/giornale)
 */

-- ============================================================================
-- PARTE 8: DISABILITAZIONE POSTGREST PER TABELLE CRITICHE (OPZIONALE)
-- ============================================================================

/**
 * Per ulteriore sicurezza, disabilita PostgREST diretto per tabelle critiche.
 * Gli endpoint backend useranno service_role che bypassa RLS.
 *
 * NOTA: Questo è un livello di protezione aggiuntivo, non un requisito.
 *
 * Come fare:
 * 1. Vai a Supabase Dashboard → SQL Editor
 * 2. Crea ruoli `postgrest_api` con permessi limitati
 * 3. Revoca SELECT/UPDATE/DELETE da 'anon' e 'authenticated' su tabelle critiche
 */

-- TEMPLATE: Revoca accesso a tabella critica dalla API PostgREST
-- REVOKE SELECT, INSERT, UPDATE, DELETE ON users FROM anon, authenticated;
-- REVOKE SELECT, INSERT, UPDATE, DELETE ON wars FROM anon, authenticated;
--
-- Nota: Il backend Express usa service_role che bypassa RLS,
--       quindi continuará a funzionare normalmente.

-- ============================================================================
-- FINE SCRIPT
-- ============================================================================

/**
 * CHECKLIST POST-IMPLEMENTAZIONE:
 *
 * [ ] Eseguire PART 1-3 (AUDIT)
 * [ ] Salvare i risultati su file
 * [ ] Identificare le policy permissive critiche
 * [ ] Creare nuove policy ownership-based per ogni tabella
 * [ ] Testare su database staging
 * [ ] Verificare con PART 6 che non ci sono policy permissive
 * [ ] Testare che il backend Express continua a funzionare
 * [ ] Deploy in produzione con rollback plan
 *
 * SUPPORTO:
 * - Supabase Docs: https://supabase.com/docs/guides/auth/row-level-security
 * - PostgreSQL RLS: https://www.postgresql.org/docs/current/ddl-rowsecurity.html
 */
