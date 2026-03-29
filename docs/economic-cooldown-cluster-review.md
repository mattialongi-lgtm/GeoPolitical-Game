# Economic/Cooldown cluster review baseline (cooldowns, user_factory_cooldowns, budget_transactions)

## Scope and intent

This note is an operational baseline for a **safe next hardening tranche**. It maps real read/write paths before any RLS or grant tightening on:

- `cooldowns`
- `user_factory_cooldowns`
- `budget_transactions`

The goal is to prevent blind fail-closed changes on runtime paths that are still backend-mediated.

## Real usage map (current code)

### `cooldowns`

**Direct reads/writes in backend (`server.ts`)**

- Read helper: `checkCooldown(userId, actionType, cooldownTime)` reads `last_used`. (Defined but currently not used by routes.)
- Write helper: `updateCooldown(userId, actionType)` upserts `(user_id, action_type, last_used)`. (Defined but currently not used by routes.)
- `/api/actions/propaganda`: reads cooldown for `(user_id, propaganda)` then upserts same key.
- `/api/actions/attack`: reads cooldown for `(user_id, attack)` then upserts same key.

**Client-side direct access**

- None found. Access is backend endpoint mediated.

---

### `user_factory_cooldowns`

**Direct reads/writes in backend (`server.ts`)**

- `/api/actions/work`:
  - reads `(userId, factoryId)` to enforce per-factory cooldown,
  - upserts cooldown after successful work execution.
- `/api/factories`:
  - reads all cooldown rows for `req.user.id` to compute `remainingCooldown` on factory list payload.
- Legacy `/api/work`:
  - reads cooldown pre-check,
  - upserts cooldown in both resource mode and salary fallback path.

**Writes via SQL RPC (`supabase/schema.sql`)**

- `process_work_action` inserts/upserts `user_factory_cooldowns` atomically inside work transaction.
- `execute_factory_work` inserts/upserts `user_factory_cooldowns` atomically inside work transaction.

**Client-side direct access**

- None found. Cooldown info is exposed through backend responses only.

---

### `budget_transactions`

**Direct reads in backend (`server.ts`)**

- `/api/budget/:ownerType/:ownerId`:
  - validates `ownerType === REGION`,
  - checks region ownership (`region.ownerUserId === req.user.id`),
  - reads latest 50 `budget_transactions` rows for the resolved budget.

**Direct writes in backend**

- None found.

**Writes via SQL RPC (`supabase/schema.sql`)**

- `add_budget_transaction` inserts into `budget_transactions` after atomic budget checks/updates.
- `add_budget_transaction` is called from multiple backend flows via `supabase.rpc(...)`.

**Client-side direct access**

- None found; frontend uses `/api/budget/REGION/:regionId` endpoint.

## Immediate fail-closed risk if applied blindly

- `cooldowns`: blocking table read/write without route/RPC migration would break `attack` and `propaganda` cooldown enforcement (either always blocked or always bypassed depending on failure handling).
- `user_factory_cooldowns`: blocking reads would remove/alter cooldown UX and server checks; blocking writes would allow spam work actions or cause hard failures in work flow.
- `budget_transactions`: blocking read would break region leader budget history UI/API; blocking write (inside RPC) would break budget mutation flows that currently rely on atomic ledger logging.

## Existing test coverage status

Current hardening suites in `scripts/` do **not** directly assert access-surface contracts for these three tables.

This patch adds one focused smoke contract:

- `scripts/security-economic-cooldown-surface.cjs`
  - asserts bounded direct touch-points in `server.ts`,
  - asserts `budget_transactions` remains read-only from server code,
  - asserts critical SQL RPCs still own writes for `budget_transactions` and `user_factory_cooldowns`.
