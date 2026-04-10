# RLS Hardening Guide — GeoPolitical-Game

**Ultimo aggiornamento:** 11 Aprile 2026  
**Status:** Script audit & template fix pronto per implementazione  

---

## 📋 Sommario

Questo documento spiega come eseguire l'audit delle RLS policy di Supabase e applicare le fix di sicurezza identificate nell'audit del 10 Aprile 2026.

**Problema:** 245+ occorrenze di `USING (true)` nelle policy RLS. Queste permettono a chiunque autenticato di bypassare i controlli di accesso su tabelle sensibili (users, regions, wars, articles, etc).

**Soluzione:** Rimpiazzare le policy permissive con **ownership-based policies** che controllano chi può leggere/modificare cosa.

---

## 🔧 Strumenti Necessari

- **Supabase Dashboard** (https://supabase.com/)
- **SQL Editor** di Supabase (dentro il progetto)
- **Questo repository** con lo script `supabase_rls_audit_and_fix.sql`

---

## 📊 STEP 1: Audit (Leggi-Only)

Nessun dato modificato, solo diagnosi.

### 1.1 Apri il SQL Editor di Supabase

1. Accedi a https://supabase.com/
2. Seleziona il progetto GeoPolitical-Game
3. Vai a **SQL Editor** (menu sinistra)
4. Nuovo query

### 1.2 Esegui la sezione AUDIT dello script

Copia e incolla da `supabase_rls_audit_and_fix.sql` **PARTE 1: AUDIT DELLE POLICY ATTUALI**:

```sql
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
```

**Cosa aspettarsi:** Lista di 245+ policy con `qual = 't'`

### 1.3 Salva i risultati

Copia i risultati in un file (per reference durante il tightening):

```
supabase_rls_audit_results_2026_04_11.txt
```

### 1.4 Esegui il conteggio per tabella

```sql
SELECT
  tablename,
  COUNT(*) as permissive_policies
FROM pg_policies
WHERE schemaname = 'public'
  AND qual = 't'
GROUP BY tablename
ORDER BY permissive_policies DESC;
```

Questo mostra quali tabelle hanno più policy permissive (le peggiori).

### 1.5 Audit Role Grants

Esegui PARTE 2 per vedere chi ha accesso a quale tabella:

```sql
SELECT
  table_name,
  grantee,
  string_agg(privilege_type, ', ') as privileges
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND grantee IN ('anon', 'authenticated', 'service_role')
GROUP BY table_name, grantee
ORDER BY table_name, grantee;
```

**Cosa cercare:**
- Se `authenticated` ha `SELECT`, `INSERT`, `UPDATE`, `DELETE` su tabelle sensibili
- Se `anon` (pubblico) ha qualche accesso alle tabelle

---

## 🛡️ STEP 2: Tightening (Modifche)

Dopo l'audit, inizia il tightening.

### 2.1 Disabilita RLS (Backup)

⚠️ **OPZIONALE** — Se vuoi velocemente togliere tutte le policy vecchie:

```sql
ALTER TABLE users DISABLE ROW LEVEL SECURITY;
ALTER TABLE regions DISABLE ROW LEVEL SECURITY;
ALTER TABLE wars DISABLE ROW LEVEL SECURITY;
-- ecc per ogni tabella
```

**NOTA:** Questo espone la tabella completamente. Usa solo per migrazione veloce, poi riabilita.

### 2.2 Abilitazione RLS su Tabelle Critiche

```sql
-- Per ogni tabella sensibile:
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE regions ENABLE ROW LEVEL SECURITY;
ALTER TABLE wars ENABLE ROW LEVEL SECURITY;
ALTER TABLE articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE parties ENABLE ROW LEVEL SECURITY;
ALTER TABLE laws ENABLE ROW LEVEL SECURITY;
ALTER TABLE elections ENABLE ROW LEVEL SECURITY;
```

### 2.3 DROP Delle Policy Permissive

Usa il template dello script **PARTE 5**. Per ogni tabella:

```sql
-- Esempio per 'users':
DROP POLICY IF EXISTS "allow_all" ON users;
DROP POLICY IF EXISTS "allow_authenticated" ON users;
-- (Adatta i nomi delle policy in base ai risultati dell'audit)
```

**Come trovare i nomi corretti:**

Nel SQL Editor, esegui:

```sql
SELECT policyname, cmd
FROM pg_policies
WHERE tablename = 'users'
  AND schemaname = 'public';
```

### 2.4 Crea Nuove Policy Ownership-Based

Per ogni tabella, rimpiazza con policy specifiche.

#### Esempio: **users** table

```sql
-- Chiunque autenticato può leggere il proprio profilo
CREATE POLICY "users_read_own" ON users
  FOR SELECT
  USING (auth.uid() = id);

-- Utente può aggiornare solo il suo profilo
CREATE POLICY "users_update_own" ON users
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Solo il server (service_role) può cancellare
CREATE POLICY "users_delete_admin" ON users
  FOR DELETE
  USING (current_setting('role') = 'service_role');
```

#### Esempio: **regions** table

```sql
-- Tutti possono leggere le regioni (informazione pubblica)
CREATE POLICY "regions_select_all" ON regions
  FOR SELECT
  USING (TRUE);

-- Solo il leader/owner può aggiornare
CREATE POLICY "regions_update_owner" ON regions
  FOR UPDATE
  USING (auth.uid() = owner_user_id)
  WITH CHECK (auth.uid() = owner_user_id);

-- Solo il server inserisce regioni (game-managed)
CREATE POLICY "regions_insert_admin" ON regions
  FOR INSERT
  WITH CHECK (current_setting('role') = 'service_role');
```

#### Esempio: **wars** table

```sql
-- Tutti possono leggere le guerre (pubblico)
CREATE POLICY "wars_select_all" ON wars
  FOR SELECT
  USING (TRUE);

-- Solo il server crea/aggiorna/cancella (backend-managed)
CREATE POLICY "wars_admin" ON wars
  FOR ALL
  USING (current_setting('role') = 'service_role');
```

#### Esempio: **articles** table

```sql
-- Tutti possono leggere articoli
CREATE POLICY "articles_select_all" ON articles
  FOR SELECT
  USING (TRUE);

-- Solo autore e giornale possono aggiornare
CREATE POLICY "articles_update_author_or_newspaper" ON articles
  FOR UPDATE
  USING (
    auth.uid() = author_id OR 
    EXISTS (
      SELECT 1 FROM newspaper_members 
      WHERE newspaper_id = articles.newspaper_id 
        AND user_id = auth.uid()
    )
  )
  WITH CHECK (
    auth.uid() = author_id OR 
    EXISTS (
      SELECT 1 FROM newspaper_members 
      WHERE newspaper_id = articles.newspaper_id 
        AND user_id = auth.uid()
    )
  );
```

---

## ✅ STEP 3: Verifica Post-Tightening

Dopo aver applicato tutte le policy, verifica che non ci siano regressioni.

### 3.1 Controlla che RLS è abilitato

```sql
SELECT
  tablename,
  rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('users', 'regions', 'wars', 'articles', 'parties', 'laws', 'elections')
ORDER BY tablename;
```

Dovrebbe mostrare `rowsecurity = TRUE` per tutte.

### 3.2 Verifica ZERO policy permissive

```sql
SELECT
  tablename,
  COUNT(*) as permissive_count
FROM pg_policies
WHERE schemaname = 'public'
  AND qual = 't'
GROUP BY tablename;
```

Dovrebbe ritornare **zero righe**.

### 3.3 Conta policy per tabella

```sql
SELECT
  tablename,
  COUNT(*) as policy_count
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('users', 'regions', 'wars', 'articles')
GROUP BY tablename
ORDER BY tablename;
```

Ogni tabella deve avere **almeno 1 policy** (meglio 2-3 per SELECT/UPDATE/DELETE).

---

## 🧪 STEP 4: Testing

Prima di applicare in produzione, testa su staging.

### 4.1 Testa Backend Express

1. Deploya il backend con le nuove policy
2. Esegui i test di integrazione:
   ```bash
   npm test
   npm run test:security-db-integration
   ```

3. Verifica che non ci sono "Permission denied" errori inaspettati

### 4.2 Testa Frontend

1. Accedi con diversi utenti
2. Prova a:
   - Leggere il proprio profilo (deve funzionare)
   - Leggere il profilo di un altro utente (dipende dalla policy)
   - Modificare il proprio profilo (deve funzionare)
   - Modificare il profilo di un altro utente (deve fallire con 403)

### 4.3 Testa Critical Flows

- Creare un articolo
- Modificare una legge (se sei il leader)
- Iniziare una guerra
- Accettare una candidatura (come ministro)

---

## 🚀 STEP 5: Rollback Plan

Se qualcosa va male, hai 2 opzioni:

### Opzione 1: Riabilita Policy Permissive (Quick Fix)

```sql
-- Disabilita RLS completamente (emergency mode)
ALTER TABLE users DISABLE ROW LEVEL SECURITY;
ALTER TABLE regions DISABLE ROW LEVEL SECURITY;
ALTER TABLE wars DISABLE ROW LEVEL SECURITY;
-- ecc
```

**Conseguenze:** App funziona ma senza RLS per ~1 ora mentre ri-abiliti tutto.

### Opzione 2: Ripristina Backup Supabase

Supabase ha backup automatici ogni 24 ore. Se il tightening rompe molte cose, ripristina il backup:

1. Supabase Dashboard → **Backups**
2. Seleziona il backup pre-tightening
3. **Restore**

**Tempo:** ~5-10 minuti, downtime minimo.

---

## 📋 Checklist Implementazione

```
AUDIT (Step 1):
[ ] Eseguito PARTE 1 (Identifica policy permissive)
[ ] Eseguito PARTE 2 (Audit role grants)
[ ] Eseguito PARTE 3 (Verifica RLS abilitato)
[ ] Salvati i risultati in file

TIGHTENING (Step 2):
[ ] Creato backup Supabase (manuale, non automatico)
[ ] Dropate le policy permissive per `users`
[ ] Create nuove policy ownership-based per `users`
[ ] Dropate le policy permissive per `regions`
[ ] Create nuove policy ownership-based per `regions`
[ ] Dropate le policy permissive per `wars`
[ ] Create nuove policy ownership-based per `wars`
[ ] Dropate le policy permissive per `articles`
[ ] Create nuove policy ownership-based per `articles`
[ ] (Ripeti per: parties, laws, elections, budgets, cooldowns)

VERIFICA (Step 3):
[ ] Eseguita verifica RLS abilitato
[ ] Eseguita verifica ZERO policy permissive
[ ] Eseguita verifica conteggio policy

TESTING (Step 4):
[ ] Backend tests passano (npm test)
[ ] Security tests passano (npm run test:security-db-integration)
[ ] Login funziona
[ ] Lettura profilo proprio funziona
[ ] Lettura profilo altrui è bloccata (403)
[ ] Modifica profilo proprio funziona
[ ] Modifica profilo altrui è bloccata (403)
[ ] Critical flows testati (articoli, guerre, leggi)

DEPLOYMENT:
[ ] Applicato in staging, testato per 1 giorno
[ ] Backup pre-production creato manualmente
[ ] Policy applicate in production
[ ] Monitorato per errori per 1 ora
[ ] Rollback plan comunicato al team
```

---

## 🔗 Risorse

- **Supabase RLS Docs:** https://supabase.com/docs/guides/auth/row-level-security
- **PostgreSQL RLS:** https://www.postgresql.org/docs/current/ddl-rowsecurity.html
- **GeoPolitical-Game Audit:** `AUDIT_REPORT_2026_04_10.md`
- **RLS Fix Script:** `supabase_rls_audit_and_fix.sql`

---

## 📞 Support

Se il tightening causa problemi:

1. **Verificare l'errore** — Quale policy è bloccata?
2. **Controllare il log** — Cosa sta cercando di fare l'utente?
3. **Adattare la policy** — Forse è troppo restrittiva
4. **Testare su staging** — Prima di reapplicare in prod

---

**Script creato:** 11 Aprile 2026  
**Repository:** https://github.com/mattialongi-lgtm/GeoPolitical-Game.git
