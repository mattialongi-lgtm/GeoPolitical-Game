# RLS Medium-Priority Tables — Endpoint-by-Endpoint Analysis

> Generated as part of the RLS hardening sprint.
> Scope: `cooldowns`, `user_factory_cooldowns`, `budget_transactions`.

---

## 1. Table: `cooldowns`

### 1.1 Backend files that read or write

| File | Operation | Lines (approx.) | Details |
|------|-----------|------------------|---------|
| `backend/app.ts` | READ (`.select`) | 763–773 | `checkCooldown()` helper — `.from('cooldowns').select('last_used').eq(…).maybeSingle()` |
| `backend/app.ts` | WRITE (`.upsert`) | 776 | `updateCooldown()` helper — `.from('cooldowns').upsert({…})` |
| `backend/handlers/actions.handler.ts` | READ (`.select`) | 127 | `checkCooldown()` helper inside `createActionsHandlers` |
| `backend/handlers/actions.handler.ts` | WRITE (`.upsert`) | 138 | `updateCooldown()` helper inside `createActionsHandlers` |
| `backend/handlers/actions.handler.ts` | READ (`.select`) | 537 | Propaganda action — cooldown check |
| `backend/handlers/actions.handler.ts` | WRITE (`.upsert`) | 557 | Propaganda action — cooldown update |
| `backend/handlers/actions.handler.ts` | READ (`.select`) | 802 | Attack action — cooldown check |
| `backend/handlers/actions.handler.ts` | WRITE (`.upsert`) | 865 | Attack action — cooldown update |
| `server.ts` | READ / WRITE (SQLite) | 391–400 | Legacy SQLite implementation (local `better-sqlite3`) |

### 1.2 Service-role vs. authenticated client

All Supabase calls use the **service-role key** initialised in `backend/app.ts` (line 138:
`SUPABASE_SERVICE_ROLE_KEY`). The `server.ts` references are SQLite-only (local DB, no
PostgREST surface).

**No authenticated-role or anon-role access path exists.**

### 1.3 Frontend surface

No frontend file (`src/`) calls `supabase.from('cooldowns')` directly.

Frontend components reach this table **indirectly** through backend API endpoints:

| Frontend file | Endpoint called | HTTP method |
|---------------|----------------|-------------|
| `src/hooks/useAppActions.ts` | `/api/actions/{action}` | POST |
| `src/components/wars/WarsView.tsx` | `/api/actions/train` | POST |
| `src/components/FactoryDetail.tsx` | `/api/actions/work` | POST |
| `src/components/market/MarketView.tsx` | `/api/actions/craft-drink` | POST |
| `src/hooks/useAppActions.ts` | `/api/actions/use-drink` | POST |
| `src/components/nation/NationView.tsx` | `/api/actions/change-displayed-nation` | POST |
| `src/components/nation/NationView.tsx` | `/api/actions/change-original-nation` | POST |

### 1.4 Conclusion

**Backend-only safe to fail-close.**

All reads and writes go through service-role on the backend. The frontend Supabase
client (anon key) never touches this table. A fail-closed posture (RLS ON, REVOKE ALL
from `anon`/`authenticated`, no client policies) matches the established pattern.

---

## 2. Table: `user_factory_cooldowns`

### 2.1 Backend files that read or write

| File | Operation | Lines (approx.) | Details |
|------|-----------|------------------|---------|
| `backend/app.ts` | WRITE (`.upsert`) | 1501–1505 | Factory work completion — cooldown stamp |
| `backend/app.ts` | READ (`.select`) | 1574–1578 | Factory work gate — cooldown check |
| `backend/app.ts` | WRITE (`.upsert`) | 1791–1795 | Extraction work completion — cooldown stamp |
| `backend/handlers/factories.handler.ts` | READ (`.select`) | 60 | `GET /api/factories` — returns cooldown list for user |
| `backend/handlers/actions.handler.ts` | READ (`.select`) | 277–281 | Work action — cooldown check |
| `backend/handlers/actions.handler.ts` | WRITE (`.upsert`) | 465–469 | Work action — cooldown update |
| `server.ts` | READ / WRITE (SQLite) | 413–441 | Legacy SQLite implementation (local `better-sqlite3`) |
| `supabase/full_schema.sql` | WRITE (PL/pgSQL) | 789, 848 | `INSERT … ON CONFLICT` inside DB functions |

### 2.2 Service-role vs. authenticated client

All Supabase JS calls use the **service-role key** (`backend/app.ts` line 138). The
PL/pgSQL functions execute server-side, not via PostgREST.

**No authenticated-role or anon-role access path exists.**

### 2.3 Frontend surface

No frontend file (`src/`) calls `supabase.from('user_factory_cooldowns')` directly.

Frontend components reach this table **indirectly**:

| Frontend file | Endpoint called | HTTP method |
|---------------|----------------|-------------|
| `src/components/factories/PlayerFactoriesView.tsx` | `/api/work` | POST |
| `src/components/factories/PlayerFactoriesView.tsx` | `/api/factories?regionId=…` | GET |
| `src/components/FactoryDetail.tsx` | `/api/extraction/work` | POST |
| `src/components/FactoryDetail.tsx` | `/api/actions/work` | POST |
| `src/components/FactoryDetail.tsx` | `/api/factories/{id}` | GET |

### 2.4 Conclusion

**Backend-only safe to fail-close.**

Same rationale as `cooldowns`. All operations are service-role only. Fail-closed RLS
with no client policies is safe.

---

## 3. Table: `budget_transactions`

### 3.1 Backend files that read or write

| File | Operation | Lines (approx.) | Details |
|------|-----------|------------------|---------|
| `backend/handlers/governance.handler.ts` | READ (`.select`) | 230–234 | `GET /api/budget/:ownerType/:ownerId` — fetches transactions with user join |
| `backend/handlers/state.handler.ts` | WRITE (`.insert`) | 453–463 | `POST /api/state/:id/donate` — logs donation as budget transaction |
| `supabase/full_schema.sql` (RPC) | WRITE (`INSERT`) | ~762 | `add_budget_transaction()` PL/pgSQL function — atomic budget + tx insert |

### 3.2 Service-role vs. authenticated client

All Supabase JS calls use the **service-role key**. The `add_budget_transaction()` RPC
function executes server-side.

The `scripts/security-economic-cooldown-surface.cjs` audit script explicitly asserts that
no direct `.from('budget_transactions').insert` or `.update` exists in `server.ts`,
enforcing that writes go through the RPC.

**No authenticated-role or anon-role access path exists.**

### 3.3 Frontend surface

No frontend file (`src/`) calls `supabase.from('budget_transactions')` directly.

The frontend Supabase client (`src/lib/supabase.ts`) uses the **anon key**, but it is
never used to query `budget_transactions`.

Frontend components reach this table **indirectly**:

| Frontend file | Endpoint called | HTTP method |
|---------------|----------------|-------------|
| `src/components/budget/BudgetView.tsx` | `/api/budget/REGION/{regionId}` | GET |
| `src/components/budget/BudgetView.tsx` | `/api/budget/donate` | POST |
| `src/components/state/StatePage.tsx` | `/api/state/{stateId}/donate` | POST |

### 3.4 Conclusion

**Backend-only safe to fail-close.**

Reads are leader-gated on the backend (governance handler checks ownership). Writes go
exclusively through the `add_budget_transaction()` RPC or the service-role insert in
`state.handler.ts`. No client-role path exists. Fail-closed posture is safe.

---

## Summary

| Table | Reads | Writes | Client-role path | Verdict |
|-------|-------|--------|-----------------|---------|
| `cooldowns` | backend service-role | backend service-role (upsert) | None | **Backend-only safe to fail-close** |
| `user_factory_cooldowns` | backend service-role | backend service-role (upsert) + PL/pgSQL | None | **Backend-only safe to fail-close** |
| `budget_transactions` | backend service-role | backend service-role (insert) + RPC | None | **Backend-only safe to fail-close** |

All three tables can be hardened with the same pattern used for previous tranches:
`ALTER TABLE … ENABLE ROW LEVEL SECURITY` + `REVOKE ALL … FROM anon, authenticated` +
no client policies.
