# RLS backlog finale (schema `public`) — review di chiusura sprint

## Obiettivo
Valutare cosa resta nel backlog Security Advisor dopo le tranche già chiuse, classificare il rischio residuo e decidere una chiusura sprint realistica.

## Tranche già chiuse in questo sprint
Già bonificate con migration incrementali dedicate:
- `applications`, `revolution_lobbies`
- `newspapers`, `newspaper_members`
- `daily_damage_log`, `military_academy_claims`
- `work_streaks`, `free_reward_claims`, `daily_task_completions`

## Metodo usato per inventario residuo
1. scansione statica migrations (`CREATE TABLE IF NOT EXISTS` vs `ALTER TABLE ... ENABLE ROW LEVEL SECURITY`);
2. verifica d’uso applicativo in `server.ts`/frontend per distinguere client-facing vs backend-only;
3. evidenziazione separata dei casi "ambigui" (es. RLS abilitata dinamicamente in blocchi `DO ... EXECUTE`).

> Nota: senza interrogare direttamente il database di staging/prod, questa è una classificazione **code-based** da confermare con Security Advisor post-deploy.

## Inventario residuo (post-tranche attuali)

### A) Alta priorità (stesso dominio daily/progress, rischio basso di regressione)
1. `daily_auto_work`
2. `periodic_reward_progress`
3. `streak_milestone_claims`

Perché alta:
- sono nello stesso cluster daily/rewards già trattato;
- non risultano accessi client diretti attivi nel codice applicativo corrente;
- quindi approccio backend-only fail-closed è coerente e a basso rischio.

Azione proposta: **ultima tranche immediata** (migration dedicata, piccola).

### B) Media priorità (richiede analisi funzionale più ampia)
1. `cooldowns`
2. `user_factory_cooldowns`
3. `budget_transactions`

Perché media:
- tabelle usate in flussi backend critici/frequenti (economia, cooldown, factory);
- una stretta DB-side senza mappatura completa dei percorsi potrebbe creare regressioni non banali.

Azione proposta: backlog sprint successivo con review endpoint-by-endpoint e test integrazione DB mirati.

### C) Warning bassa priorità / da validare con attenzione
- set tabelle war (`war_participants`, `war_deployments`, `war_auto_attacks`, `revolutions`, `coups`, `war_military_agreements`, `war_departments`, `war_history`) compare come "possibile residuo" in scansione statica semplice,
  ma la migration war usa `DO ... FOREACH ... EXECUTE 'ALTER TABLE ... ENABLE ROW LEVEL SECURITY'`, quindi è probabile che RLS sia già abilitata.

Azione proposta:
- non aprire nuove migration ora su questo cluster solo da inferenza statica;
- confermare con output reale Security Advisor/DB metadata.

## Decisione pratica di chiusura sprint

### ✅ Fare subito (ultima tranche immediata)
Applicare una migration finale e mirata su:
- `daily_auto_work`
- `periodic_reward_progress`
- `streak_milestone_claims`

Pattern: RLS ON + revoca privilegi client + nessuna policy client-side (backend-only, fail-closed).

### 📌 Rinviare al prossimo sprint (backlog documentato)
- `cooldowns`, `user_factory_cooldowns`, `budget_transactions` (review approfondita prima di policy/grants).
- cluster war solo dopo conferma oggettiva di eventuale finding residuo reale.

## Verifica consigliata

1. **Security Advisor**
   - rieseguire dopo deploy migration finale;
   - confrontare lista `RLS Disabled in Public` prima/dopo;
   - verificare che i tre target della tranche finale escano dal finding.

2. **Regressioni funzionali**
   - smoke test flussi giornalieri/missioni;
   - smoke test economia/factory (cooldown + transazioni budget) per assicurare assenza impatti collaterali.

3. **Correttezza classificazione**
   - per backlog media priorità: mappare endpoint ↔ tabella ↔ attore;
   - solo dopo introdurre owner-only/read-only dove c’è evidenza reale.

## Retro finale sprint (proposta)

### Cosa è stato chiuso
- hardening incrementale delle aree sensibili prioritarie (applications/revolution/newspaper/daily tracking core).

### Cosa resta residuo
- pacchetto medio priorità su cooldown/economia;
- eventuali warning war da validazione oggettiva (non da sola scansione testuale).

### Piano prossimo sprint
1. estrarre output Security Advisor aggiornato e snapshot DB catalog (RLS enabled + policies + grants);
2. affrontare `cooldowns`, `user_factory_cooldowns`, `budget_transactions` con mini-tranche dedicate;
3. chiudere eventuali falsi positivi/inconsistenze documentali nelle migration storiche.
