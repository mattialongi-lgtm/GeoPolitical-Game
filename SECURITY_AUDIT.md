# Deep Security & Stability Audit — GeoPolitical-Game

Audit date: 2026-03-14  
Scope: `server.ts`, `src/`, `supabase/*.sql`, env/config files, package/runtime setup.

---

## STEP 1 — Project understanding

### What the application does
This project is a geopolitical multiplayer game with:
- React frontend (Vite)
- Express backend API (`server.ts`)
- Supabase/Postgres as the primary data store
- Game systems for regions, wars, factories, laws, extraction, budgets, elections, and inventory.

### Main architecture
- **Frontend (`src/`)**: Authenticated UI and gameplay actions.
- **Backend (`server.ts`)**: Monolithic API with business logic and direct Supabase queries/RPC calls.
- **Database (`supabase/*.sql`)**: schema, migrations, policies, and RPC functions (`safe_deduct_currency`, `add_budget_transaction`, `process_work_action`, etc.).

### Data flow
1. Client authenticates with Supabase JWT.
2. JWT is sent to backend (`Authorization` header or cookie).
3. Backend verifies token and runs game logic.
4. Backend writes/reads game state in Supabase (tables + RPC).
5. API returns state updates to frontend.

### Trust boundaries
- **Untrusted**: Client request body/query params.
- **Partially trusted**: Authenticated users (must still be authorized per action).
- **Privileged**: Backend service-role Supabase client.
- **Persistent boundary**: DB constraints, RLS policies, and RPC security.

---

## STEP 2 + STEP 3 — Vulnerability scan and report

| Severity | File / Location | Problem | Why dangerous | Exploit scenario | Exact fix recommendation |
|---|---|---|---|---|---|
| **Critical** | `server.ts:66-69` | Backend previously allowed fallback from `SUPABASE_SERVICE_ROLE_KEY` to `VITE_SUPABASE_ANON_KEY`. | Misconfiguration could run backend with weaker privileges and break security assumptions around privileged ops. | Deployment missing service key silently starts with anon key, causing inconsistent authz behavior and possible policy bypass assumptions. | ✅ **Fixed in this branch**: service-role key is now mandatory; server throws on missing value. |
| **Critical** | `server.ts` persisted ID generation (e.g. `:673`, `:1902`, `:2420`, `:5344`, `:7719`) | Persisted object IDs were generated using `Math.random().toString(36)`. | `Math.random` is predictable and not suitable for security-sensitive IDs. | Attacker predicts IDs for offers/records and attempts unauthorized actions against guessable resources. | ✅ **Fixed in this branch**: replaced with `generateSecureId()` using `crypto.randomBytes`. |
| **High** | `server.ts:2206-2208` (`/api/government/transition`) | Authorization check allowed transitions when `leaderUserId` was null. | Region governance takeover risk. | Any authenticated user could transition an unclaimed/leaderless region government form. | ✅ **Fixed in this branch**: require `region.leaderUserId === user.id`. |
| **High** | `server.ts:6158-6310` (`/api/resources/work-extract`) | No per-user request throttling/cooldown before extraction. | Abuse can spam extraction and stress economy/API. | Bot sends high-frequency requests to drain/exhaust resources and gain unfair inventory growth. | ✅ **Fixed in this branch**: added cooldown check/update (`resource_extract_work`) returning HTTP 429 when too frequent. |
| **High** | `server.ts:6230-6292` (`/api/resources/work-extract`) | Multi-step writes (energy, region counters, player state, inventory, logs) are non-transactional. | Partial failure leads to inconsistent state and accounting mismatches. | Request fails mid-flow after energy deduction but before inventory/log update; user loses energy with no reward or vice-versa. | Move extraction flow into one DB transaction / RPC that atomically validates and applies all updates. |
| **High** | `supabase/full_schema.sql:1001-1056` (and similar in migrations) | Multiple `FOR ALL USING (true)` policies on sensitive tables. | If table privileges are exposed to `authenticated`/`anon`, this can permit broad unauthorized writes. | Token holder directly updates strategic tables (wars/laws/parties/etc.) through PostgREST if grants allow it. | Replace permissive policies with row-scoped ownership checks; verify grants for anon/authenticated roles; keep writes server-only. |
| **Medium** | `server.ts` many handlers (e.g. `:521`, `:989`, `:1074`, `:6315`, etc.) | Raw `err.message` returned to clients. | Leaks internal schema/runtime details useful for attackers. | Crafted bad payload triggers DB error and reveals table/column/function internals. | Standardize 5xx responses to generic message; keep detailed errors in server logs only. |
| **Medium** | `server.ts` global API setup | No centralized rate limiting / abuse controls on most endpoints. | Enables brute-force, scraping, and resource abuse. | Automated clients flood endpoints (`/api/*`) causing high DB load and degraded service. | Add IP + user token-bucket rate limiter; stricter per-endpoint caps for write operations. |
| **Medium** | `server.ts` monolithic API file (~7k+ lines, many direct DB calls) | Large shared mutable logic surface increases regression and authz mistakes. | Security-critical checks are easy to miss and hard to review at scale. | New endpoint copied without authz parity introduces privilege escalation. | Split by domain modules with shared authz guards and validation middleware. |
| **Low** | `server.ts` response/pagination patterns (many list endpoints with fixed `.limit(50)`) | Limited pagination strategy and repeated full object reads can degrade at scale. | Performance bottlenecks become availability risk under growth. | High concurrent traffic causes expensive repeated queries and increased latency. | Add cursor pagination + selective projection + indexes for hottest filters/sorts. |

---

## STEP 4 — Hidden / non-obvious problems

1. **Single privileged client dependency**: core logic depends on one global service-role client; compromise/misuse has very high blast radius.  
2. **Non-atomic game-economy flows**: several business actions are multi-query and can diverge under retries/failures.  
3. **Authorization drift risk**: many endpoints implement inline authorization logic rather than reusable centralized policy checks.  
4. **RLS policy ambiguity**: permissive patterns are hard to reason about when combined with role grants and server bypasses.  
5. **Operational observability gap**: no dedicated abuse telemetry/rate-limit audit trails visible in backend code.  

---

## STEP 5 — Top 20 hardening recommendations

1. Keep `SUPABASE_SERVICE_ROLE_KEY` mandatory in all environments.
2. Use cryptographic ID generation for all persisted entities.
3. Move all economy-changing multi-step actions into transactional RPCs.
4. Replace broad `FOR ALL USING (true)` policies with row-level ownership policies.
5. Re-audit table grants for `anon` and `authenticated` roles.
6. Add centralized request validation (schema-based) for body/query/params.
7. Add centralized authz guard utilities (leader/owner/minister checks).
8. Add global and endpoint-specific rate limiting.
9. Add anti-automation controls for resource and economy endpoints.
10. Replace client-facing raw error messages with generic 5xx responses.
11. Add structured security logging with request correlation IDs.
12. Add replay/idempotency controls for critical POST actions.
13. Use optimistic locking/version checks on contested resources.
14. Introduce audit trails for privileged actions (government, budget, war, laws).
15. Add integration tests for authorization negative cases.
16. Add race-condition tests for extraction/budget/factory flows.
17. Add DB constraints to backstop invariants in all economy tables.
18. Segment backend by domain modules to reduce authz regressions.
19. Add monitoring/alerts for anomaly patterns (request spikes, extraction bursts).
20. Run recurring dependency audits and patch high/critical findings quickly.

---

## STEP 6 — Final verdict

**Is the app safe for production today?**  
Not yet. It has improved with the fixes in this branch, but important risks remain.

**Biggest risks before launch**
1. Non-transactional multi-write economy flows.
2. Overly permissive RLS policy patterns (`USING (true)` in many places).
3. Broad error leakage and uneven endpoint abuse protection.

**Must-fix immediately**
1. Transactionalize extraction/economy-critical endpoints.
2. Tighten RLS + role grants for sensitive tables.
3. Implement centralized rate limiting and validation middleware.
4. Standardize secure error handling for all 5xx responses.

