# RLS Medium-Priority Table Analysis

Scope reviewed:
- `cooldowns`
- `user_factory_cooldowns`
- `budget_transactions`

Assumption used: current runtime backend is `backend/app.ts` + extracted route/handler modules; `server.ts` is legacy but still audited as requested.

## Table: `cooldowns`

### 1) Backend files that read/write it
- `backend/app.ts`
  - defines `checkCooldown()` (SELECT from `cooldowns`) and `updateCooldown()` (UPSERT into `cooldowns`) using backend Supabase client.
  - these helpers are injected into route handlers via `setupRoutes(...)`.
- `backend/handlers/actions.handler.ts`
  - direct read/write (`.from('cooldowns')`) in:
    - helper methods inside handler factory,
    - `POST /api/actions/propaganda`,
    - `POST /api/actions/attack`.
- `backend/handlers/resources.handler.ts`
  - `POST /api/resources/work-extract` calls injected `checkCooldown/updateCooldown` (indirect read/write to `cooldowns`).
- `server.ts` (legacy SQLite backend)
  - creates/reads/writes `cooldowns` in legacy `checkCooldown/updateCooldown` and action routes.

### 2) Write path type (service-role vs direct PostgREST)
- Application writes are backend-mediated through service-role client (`SUPABASE_SERVICE_ROLE_KEY` in `backend/app.ts`).
- No frontend code writes `cooldowns` directly.
- Without RLS/grant hardening, authenticated clients could still attempt direct PostgREST access outside app flows.

### 3) Frontend endpoint usage that ultimately touches this table
- `src/components/resources/ResourceExtractView.tsx`
  - calls `POST /api/resources/work-extract` -> uses cooldown helper -> touches `cooldowns`.
- No explicit current frontend call to `POST /api/actions/propaganda` / `POST /api/actions/attack` was found in `src/`.

### 4) Conclusion
- **backend-only safe to fail-close**.

---

## Table: `user_factory_cooldowns`

### 1) Backend files that read/write it
- `backend/app.ts`
  - `performWorkActionV3(...)`: SELECT cooldown + UPSERT cooldown.
  - legacy work implementation path in same file also contains UPSERT/SELECT touches.
  - auto-work scheduler path calls `performWorkAction(...)`, therefore also reaches this table.
- `backend/handlers/actions.handler.ts`
  - contains direct SELECT/UPSERT against `user_factory_cooldowns` in work flow code paths.
- `backend/handlers/factories.handler.ts`
  - `GET /api/factories`: SELECT cooldown rows for user to compute `remainingCooldown`.
- `server.ts` (legacy SQLite backend)
  - creates/reads/writes `user_factory_cooldowns` in work/factory list flows.

### 2) Write path type (service-role vs direct PostgREST)
- Application writes are backend-mediated through service-role client.
- No frontend direct table write found.
- Without RLS/grant hardening, authenticated clients could still attempt direct PostgREST access outside backend endpoints.

### 3) Frontend endpoint usage that ultimately touches this table
- `src/components/factories/PlayerFactoriesView.tsx`
  - `POST /api/work` -> work flow -> reads/writes `user_factory_cooldowns`.
  - `GET /api/factories?regionId=...` -> reads cooldown rows (remaining cooldown in response).
- `src/components/FactoryDetail.tsx`
  - `POST /api/actions/work` -> work flow -> reads/writes `user_factory_cooldowns`.
- `src/components/country/CountryDetailView.tsx`
  - `GET /api/factories?regionId=...` -> cooldown-enriched factory list.

### 4) Conclusion
- **backend-only safe to fail-close**.

---

## Table: `budget_transactions`

### 1) Backend files that read/write it
- `backend/handlers/governance.handler.ts`
  - direct SELECT from `budget_transactions` in `GET /api/budget/:ownerType/:ownerId`.
  - multiple writes via `rpc('add_budget_transaction')` in budget mutation endpoints.
- `backend/handlers/actions.handler.ts`
  - writes via `rpc('add_budget_transaction')` in work/tax and travel-fee flows.
- `backend/handlers/resources.handler.ts`
  - writes via `rpc('add_budget_transaction')` in recharge/deep-exploration flows.
- `backend/handlers/state.handler.ts`
  - direct INSERT into `budget_transactions` in `POST /api/state/:id/donate`.
- `backend/app.ts`
  - `addBudgetTransaction(...)` wrapper around `rpc('add_budget_transaction')`.
  - many internal flows (work/economy/governance/war/automation paths) call RPC helper and therefore write ledger rows.
- `backend/services/economy.service.ts`
  - service wrapper `addBudgetTransaction(...)` calls `rpc('add_budget_transaction')`.
- `server.ts` (legacy)
  - no `budget_transactions` touch found.

### 2) Write path type (service-role vs direct PostgREST)
- Main application writes are backend-mediated through service-role client.
- No frontend direct table access found.
- `add_budget_transaction` RPC exists and no explicit EXECUTE revocation for `authenticated`/`anon` was found in migrations; so direct PostgREST RPC invocation is a potential separate hardening surface.

### 3) Frontend endpoint usage that ultimately touches this table
- `src/components/budget/BudgetView.tsx`
  - `GET /api/budget/REGION/:regionId` (reads transactions)
  - `POST /api/budget/donate`, `/api/budget/explore`, `/api/budget/clean-radiation` (writes via RPC)
- `src/components/state/StatePage.tsx`
  - `POST /api/state/:id/donate` (direct insert path)
- `src/components/resources/RechargeResourcePanel.tsx`
  - `POST /api/resources/recharge` (writes via RPC)
- `src/components/resources/DeepExplorationPanel.tsx`
  - `POST /api/resources/deep-exploration/activate` (writes via RPC)
- `src/components/factories/PlayerFactoriesView.tsx` and `src/components/FactoryDetail.tsx`
  - work endpoints (`/api/work`, `/api/actions/work`) trigger tax ledger writes via RPC.

### 4) Conclusion
- **backend-only safe to fail-close** (table-level RLS/grants).
- Note: RPC EXECUTE hardening for `add_budget_transaction` should be tracked separately if direct client RPC abuse is in scope.
