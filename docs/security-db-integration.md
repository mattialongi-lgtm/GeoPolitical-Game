# Security DB Integration Tests (Mini-suite)

Questa mini-suite verifica **comportamento runtime** (DB state/transazioni/idempotenza) sui flussi più critici:

- apply concorrente (`create_application_atomic`)
- replay resolve (`resolve_application_atomic`)
- doppio trigger expire lobby (`expire_revolution_lobby_atomic`)

Script: `scripts/security-db-integration.mjs`.

## Prerequisiti

- DB di test dedicato (mai produzione).
- Env:
  - `VITE_SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `RUN_DB_INTEGRATION_TESTS=true`

## Esecuzione locale

```bash
RUN_DB_INTEGRATION_TESTS=true \
VITE_SUPABASE_URL=... \
SUPABASE_SERVICE_ROLE_KEY=... \
npm run test:security-db-integration
```

Comportamento:

- se prerequisiti mancanti -> `SKIPPED` (exit 0) per evitare attrito locale.

## Esecuzione CI (strict)

Usare:

```bash
npm run test:security-db-integration:ci
```

Questo comando imposta `REQUIRE_DB_INTEGRATION=true` e fallisce se env/dependency mancano, evitando falsi verdi in pipeline.

## Quando va lanciata (policy minima)

Lanciare obbligatoriamente su PR che toccano almeno uno di questi ambiti:

- `server.ts` in sezioni authorization/regional flows
- `supabase/migration_*` con RPC o vincoli
- endpoint/app logic di:
  - apply
  - resolve-application
  - lobby expire

### Override per PR borderline / ad alto rischio

Se una PR è potenzialmente critica ma non tocca i path monitorati:

- aggiungere label PR: `needs-db-integration`
  - forza il workflow DB integration in modalità strict;
  - se i secrets DB non sono configurati, il workflow fallisce esplicitamente (no falso verde).

In alternativa è disponibile il trigger manuale:

- `workflow_dispatch` con input `force_db_integration=true`.

In review, usare la checklist breve nel PR template (`.github/pull_request_template.md`) per decidere rapidamente se forzare il run DB integration.

## Limiti noti

- Script best-effort cleanup: in caso di crash brutale possono restare record di test.
- Non sostituisce una suite E2E completa: è una protezione anti-regressione mirata e leggera.
