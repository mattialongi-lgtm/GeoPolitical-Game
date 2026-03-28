# Security DB Integration Tests (Mini-suite)

Questa mini-suite verifica **comportamento runtime** (DB state/transazioni/idempotenza) sui flussi più critici:

- apply concorrente (`create_application_atomic`)
- replay resolve (`resolve_application_atomic`)
- doppio trigger expire lobby (`expire_revolution_lobby_atomic`)

Script: `scripts/security-db-integration.mjs`.

## Validazione RLS / grants post-hardening

Per la migration di defense-in-depth su `applications` / `revolution_lobbies` / RPC grants,
è disponibile anche:

- Script: `scripts/security-db-rls-validation.mjs`
- Obiettivi:
  - verificare che il ruolo `authenticated` **non** possa eseguire direttamente:
    - `create_application_atomic`
    - `resolve_application_atomic`
    - `expire_revolution_lobby_atomic`
  - verificare lettura scoped su:
    - `applications` (solo owner domanda o governance regione)
    - `revolution_lobbies` (solo creator/partecipanti/scope regione)

Esecuzione locale:

```bash
RUN_DB_RLS_VALIDATION_TESTS=true \
VITE_SUPABASE_URL=... \
VITE_SUPABASE_ANON_KEY=... \
SUPABASE_SERVICE_ROLE_KEY=... \
DB_TEST_USER_PASSWORD='...' \
npm run test:security-db-rls-validation
```

Esecuzione CI strict:

```bash
npm run test:security-db-rls-validation:ci
```

Nota: lo script crea utenti `auth.users` temporanei via service-role (`auth.admin.createUser`),
verifica accessi con sessioni `authenticated`, poi esegue cleanup best-effort.

## Validazione flussi backend ufficiali (opzionale ma consigliata in staging)

Lo stesso script può verificare anche gli endpoint API:

- `POST /api/actions/apply`
- `POST /api/actions/resolve-application`
- `GET /api/applications/:regionId`
- `GET /api/lobbies/:regionId`
- `POST /api/lobbies/:id/expire`

Env aggiuntive:

- `RUN_BACKEND_FLOW_VALIDATION=true`
- `BACKEND_BASE_URL` (default: `http://127.0.0.1:3000`)

Comando locale:

```bash
RUN_DB_RLS_VALIDATION_TESTS=true \
RUN_BACKEND_FLOW_VALIDATION=true \
VITE_SUPABASE_URL=... \
VITE_SUPABASE_ANON_KEY=... \
SUPABASE_SERVICE_ROLE_KEY=... \
BACKEND_BASE_URL='https://staging-api.example.com' \
DB_TEST_USER_PASSWORD='...' \
npm run test:security-db-rls-validation:backend
```

Comando CI strict (RLS + backend flows):

```bash
npm run test:security-db-rls-validation:backend:ci
```

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
