TASK
Review RLS/defense-in-depth on already hardened sensitive flows (applications + revolution lobbies + atomic RPC), identify backend-only trust points, and propose minimal DB-side hardening.

DIAGNOSI
1) Tabelle realmente sensibili
- `public.applications`: contiene richieste residence/work-permit e guida aggiornamenti su `users.residenceId` / `users.workPermitId`.
- `public.revolution_lobbies`: controlla lo stato lobby rivoluzione/colpo di stato, partecipanti e possibili refund gold.
- `public.users`: contiene bilanci (`gold`, `money`) e attributi di autorizzazione (`residenceId`, `workPermitId`).
- `public.regions`: fonte autoritativa per ruoli di governance (`ownerUserId`, `leaderUserId`) usati per autorizzazione.

2) Accessi oggi protetti soprattutto dal backend
- Le route `POST /api/actions/apply`, `POST /api/actions/resolve-application` e `POST /api/lobbies/:id/expire` demandano l’autorizzazione al backend e poi chiamano RPC.
- `GET /api/applications/:regionId` e `GET /api/lobbies/:regionId` applicano controlli in Node (`canManageRegion` / `canReadRegionScopedData`) ma le tabelle avevano policy DB deboli o assenti.
- In particolare:
  - `applications`: nessuna policy RLS dedicata trovata nei migration correnti.
  - `revolution_lobbies`: policy originarie `USING (true)` / `WITH CHECK (true)` (lettura/scrittura ampie).

3) Blast-radius riducibile via RLS
- Se una key client/edge con privilegi `authenticated` venisse abusata, policy ampie su `revolution_lobbies` permetterebbero letture/scritture troppo estese.
- Mancanza RLS mirata su `applications` lascia la difesa concentrata sui soli guard applicativi.

4) RPC: execution mode, grants, search_path
- RPC `create_application_atomic`, `resolve_application_atomic`, `expire_revolution_lobby_atomic` sono `SECURITY INVOKER` (default): bene per evitare escalation implicita da function owner.
- Senza hardening grants, la superficie EXECUTE può restare più ampia del necessario.
- Mancava pinning esplicito del `search_path` sulle tre funzioni: rischio basso ma evitabile (hardening standard).

FILES COINVOLTI
- `server.ts` (uso dei flow e dei guard applicativi).
- `supabase/migration_apply_atomic_pending_guard.sql` (RPC create + unique pending index).
- `supabase/migration_resolve_application_atomic.sql` (RPC resolve).
- `supabase/migration_expire_revolution_lobby_atomic.sql` (RPC expire).
- `supabase/migration_bugfixes_v4.sql` (tabella/policy originarie `revolution_lobbies`).
- `supabase/migration_rls_defense_depth_sensitive_flows.sql` (nuova patch DB-side).

PIANO DI FIX
1) `applications`
- Abilitare RLS e introdurre solo SELECT scoped:
  - owner della domanda (`auth.uid() = userId`), oppure
  - owner/leader della regione associata.
- Nessuna policy mutativa client-side (INSERT/UPDATE/DELETE): mutazioni restano via backend/service role.

2) `revolution_lobbies`
- Rimuovere policy permissive esistenti (`true/true`).
- Introdurre SELECT scoped a:
  - creator,
  - partecipanti,
  - owner/leader regione,
  - utenti con residence/work permit sulla regione.
- Nessuna policy mutativa client-side per ridurre abuso diretto.

3) RPC surface
- Revoke `EXECUTE` da `PUBLIC`, `anon`, `authenticated` sulle 3 RPC critiche.
- Grant `EXECUTE` solo a `service_role`.
- Pin `search_path = public, pg_temp` su tutte e tre.

PATCH PROPOSTA
Implementata migration idempotente:
- `supabase/migration_rls_defense_depth_sensitive_flows.sql`

VERIFICA
- Verifica statica SQL della migration (sintassi + idempotenza logica con `DROP POLICY IF EXISTS` e grant/revoke espliciti).
- Verifica d’impatto architetturale:
  - il backend usa Supabase con `SUPABASE_SERVICE_ROLE_KEY`, quindi i flussi API correnti restano operativi;
  - si riduce la dipendenza da “solo backend checks” per letture dirette client role.

RISCHI / NOTE
- Trade-off intenzionale: niente policy di scrittura `authenticated` su `applications`/`revolution_lobbies`; eventuali flussi futuri client-direct dovranno passare da API o aggiungere policy dedicate.
- Le route backend già esistenti restano la via ufficiale di mutazione, quindi rischio regressione basso.
- Se in ambienti esterni erano volutamente usate RPC da `authenticated`, il revoke richiede allineamento (voluto per hardening).

NEXT BEST TASK
Hardening incrementale su tabelle state-sensitive adiacenti (`wars`, `war_participants`, `revolutions`, `coups`) seguendo lo stesso pattern:
- lettura scoped per attori rilevanti,
- no write client-direct dove non necessario,
- grants EXECUTE minimi su RPC critiche.
