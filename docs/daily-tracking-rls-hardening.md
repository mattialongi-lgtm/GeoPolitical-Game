# Daily tracking RLS hardening review (incrementale, fail-closed)

## Scope
Tabelle in questa tranche:
- `public.work_streaks`
- `public.free_reward_claims`
- `public.daily_task_completions`

## 1) Che dati contengono

Definizioni da `supabase/migration_daily_gameplay.sql`:
- `work_streaks`: stato streak lavoro utente (`current_streak`, `longest_streak`, `last_work_date`).
- `free_reward_claims`: storico claim reward gratuite (`source`, `reward_type`, `amount`, `claimed_at`).
- `daily_task_completions`: completamenti task giornalieri (`task_id`, `completed_date`, `completed_at`).

Classificazione:
- dati progress/reward sensibili per utente; non pubblici.

## 2) Come vengono usate oggi

Review codice applicativo:
- nessuna query diretta trovata in `server.ts` verso queste 3 tabelle;
- UI daily usa dati mock per streak/free rewards e non effettua chiamate dirette a queste tabelle;
- i flussi reali daily attivi nel backend ruotano su `daily_missions` / `daily_mission_bonus_claims`, non su queste 3 tabelle.

Conclusione operativa attuale:
- nessun requisito dimostrato di accesso client-side diretto.

## 3) Accessi client-side necessari

Decisione minima sicura adesso:
- **backend-only** per tutte e 3.
- niente read/write client diretto finché non emerge un requisito verificato.

## 4) Policy scelta per tabella

### `work_streaks`
- Visibilità: backend-only.
- Policy/grants: RLS ON, revoke privilegi client, nessuna policy client.
- Motivazione: contiene stato progresso personale; nessun uso diretto provato.

### `free_reward_claims`
- Visibilità: backend-only.
- Policy/grants: RLS ON, revoke privilegi client, nessuna policy client.
- Motivazione: storico claim reward economico/gameplay; evitare esposizione prematura.

### `daily_task_completions`
- Visibilità: backend-only.
- Policy/grants: RLS ON, revoke privilegi client, nessuna policy client.
- Motivazione: tracking attività giornaliere utente; nessun bisogno client diretto osservato.

## Migration applicata

File: `supabase/migration_daily_tracking_rls_hardening.sql`

Contenuto:
1. `ENABLE ROW LEVEL SECURITY` sulle 3 tabelle.
2. `DROP POLICY IF EXISTS` per nomi legacy/permissivi noti.
3. `REVOKE ALL PRIVILEGES` a `anon` e `authenticated`.
4. nessuna policy `SELECT/INSERT/UPDATE/DELETE` lato client (fail-closed).

## Verifica post-deploy

### A) Regressione flussi
- Verificare che i flussi giornalieri attuali (missioni) continuino a funzionare:
  - `GET /api/daily/missions`
  - `POST /api/daily/missions/claim/:id`
  - `POST /api/daily/missions/claim-bonus`
- Verificare che la pagina daily carichi normalmente.

### B) Isolamento client
Con token `authenticated` (non service role):
- `SELECT/INSERT/UPDATE/DELETE` su `work_streaks`, `free_reward_claims`, `daily_task_completions` → denied.

### C) Security Advisor
Rieseguire Supabase Security Advisor e confermare che non segnali più `RLS Disabled in Public` sulle 3 tabelle target.

## Tradeoff documentato
Se successivamente serve esposizione client (es. storico personale), aggiungere solo policy owner-scoped esplicite (`auth.uid() = user_id`) e grants minimi necessari.

## Next best task
Review delle restanti tabelle `public` ancora segnalate per decidere:
- se il backlog RLS è ormai basso/rischio accettabile,
- oppure se resta un pacchetto finale ad alta priorità.
