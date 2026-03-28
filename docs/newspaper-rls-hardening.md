# Newspaper RLS hardening review (incrementale, fail-closed)

## 1) Struttura tabelle coinvolte

Fonte migration dedicata:
- `public.newspapers`: anagrafica giornale (`id`, `name`, `description`, `owner_id`, `logo_url`, `created_at`).
- `public.newspaper_members`: membership (`newspaper_id`, `user_id`, `role`, `status`, `joined_at`) con vincolo unico per coppia giornale/utente.

Riferimento base: `supabase/migration_newspapers.sql`.

## 2) Come vengono lette/scritte oggi

Flussi backend (`server.ts`) usano client Supabase con **service role key**:
- elenco giornali: `GET /api/newspapers`
- dettaglio giornale + membri + articoli: `GET /api/newspapers/:id`
- miei giornali: `GET /api/my-newspapers`
- creazione/aggiornamento/cancellazione giornale
- aggiunta membri

Tutte le mutazioni passano da API server e non richiedono write client-side diretto su PostgREST.

## 3) Accessi client-side necessari (minimali)

Decisione esplicita per remediation minima:
- `newspapers`: visibilità **in-app per utenti autenticati** (non anon).
- `newspaper_members`: visibilità client limitata alla **propria membership**.
- write diretti client su entrambe le tabelle: **non necessari** (backend-only).

## 4) Policy minima sicura applicata subito

Migration: `supabase/migration_newspaper_rls_hardening.sql`.

Contenuto:
1. `ENABLE ROW LEVEL SECURITY` su entrambe le tabelle.
2. rimozione policy legacy permissive (`USING (true)` pubbliche).
3. `REVOKE` write grant (`INSERT/UPDATE/DELETE`) da `anon, authenticated`.
4. grant `SELECT` solo ad `authenticated`.
5. policy minime:
   - `newspapers_authenticated_read`: SELECT autenticati (`USING (true)`).
   - `newspaper_members_read_own`: SELECT solo righe con `user_id = auth.uid()`.
6. nessuna policy mutativa per ruoli client (default fail-closed).

## Verifica consigliata post-deploy

### A. Regressione flussi applicativi
1. utente autenticato apre pagina giornali (`/api/newspapers`) → OK.
2. crea giornale (`POST /api/newspapers`) → OK.
3. owner aggiorna/cancella giornale → OK.
4. owner/editor aggiunge membro (`POST /api/newspapers/:id/members`) → OK.

### B. Test isolamento/outsider
Con chiave `authenticated` (non service role):
1. `SELECT * FROM public.newspapers` → consentito.
2. `SELECT * FROM public.newspaper_members WHERE user_id <> auth.uid()` → 0 righe.
3. tentativi `INSERT/UPDATE/DELETE` su entrambe le tabelle → denied.

### C. Security Advisor
Rieseguire Security Advisor Supabase e verificare che:
- `RLS Disabled in Public` non segnali più `public.newspapers` e `public.newspaper_members`.

## Next best task
Applicare lo stesso approccio (classificazione + migration minima) a:
- `daily_damage_log`
- `military_academy_claims`
