# Daily gameplay RLS hardening review (incrementale, fail-closed)

## Scope
Tabelle target in questa tranche:
- `public.daily_damage_log`
- `public.military_academy_claims`

## 1) Che dati contengono

Le due tabelle sono definite in `supabase/migration_daily_gameplay.sql`:
- `daily_damage_log`: log del danno giornaliero (`user_id`, `target_type`, `target_id`, `damage_dealt`, `xp_gained`, `created_at`).
- `military_academy_claims`: claim giornalieri accademia (`user_id`, `region_id`, `claimed_date`, `rewards`, `created_at`) con vincolo unico `(user_id, claimed_date)`.

Classificazione:
- **operational/gameplay-sensitive** (telemetria utente + reward claims).

## 2) Come vengono lette/scritte oggi

Nel codice applicativo attuale:
- non risultano query dirette a `daily_damage_log` e `military_academy_claims` in `server.ts`;
- la UI daily attuale usa principalmente mock data per military training/academy, senza fetch diretti a queste tabelle;
- esiste la funzione DB `claim_academy_reward(...)` che inserisce in `military_academy_claims` lato DB.

Conclusione: al momento non ci sono flussi client-side diretti necessari su queste due tabelle.

## 3) Accessi client-side necessari

Decisione minima sicura **ora**:
- nessun accesso diretto client (né read né write);
- accesso solo backend/service role o RPC controllate lato server.

## 4) Policy minima scelta + motivazione

Migration dedicata: `supabase/migration_daily_gameplay_rls_hardening.sql`.

Scelte applicate:
1. `ENABLE ROW LEVEL SECURITY` su entrambe le tabelle.
2. rimozione eventuali policy legacy/permissive note.
3. `REVOKE ALL PRIVILEGES` a `anon` e `authenticated` (deny-all client-side).
4. nessuna policy `SELECT/INSERT/UPDATE/DELETE` per ruoli client.

Motivazione:
- approccio fail-closed con blast radius minimo;
- non rompe flussi esistenti, perché non ci sono dipendenze client dirette osservate;
- evita esposizione prematura di dati gameplay/economici sensibili.

## Verifica post-deploy

### A) Regressione flussi app
- verificare login/navigation giornaliera (`DailyTasksPage`) e missioni giornaliere esistenti: devono continuare a funzionare.
- verificare endpoint backend non collegati a queste tabelle: nessun impatto atteso.

### B) Isolamento outsider
Con token `authenticated` (non service role):
- `SELECT * FROM public.daily_damage_log` → denied.
- `SELECT * FROM public.military_academy_claims` → denied.
- `INSERT/UPDATE/DELETE` su entrambe → denied.

Con service role:
- operazioni backend continuano a funzionare (bypass RLS previsto).

### C) Security Advisor
Rieseguire Supabase Security Advisor e verificare la rimozione del finding `RLS Disabled in Public` per:
- `public.daily_damage_log`
- `public.military_academy_claims`

## Tradeoff documentato
Se in futuro servirà accesso client diretto (es. storico personale), aggiungere solo policy owner-scoped esplicite (`auth.uid() = user_id`) e grants minimi necessari.

## Next best task
Prossima tranche con stesso metodo di classificazione + migration minima:
- `work_streaks`
- `free_reward_claims`
- `daily_task_completions`
