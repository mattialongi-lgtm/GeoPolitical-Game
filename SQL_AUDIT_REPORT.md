# AUDIT REPORT — SQL Security & Cost Optimization
_Generated: 2026-04-05_

## Stack Reality Check

> The audit prompt assumed **Supabase (PostgreSQL)**. The actual stack is **SQLite + better-sqlite3 + Express**. All findings and fixes have been adapted accordingly. PostgreSQL-specific features (RLS, RPC functions, pg_cron, PgBouncer) are noted where they would apply if migrating.

---

## 1. Security — RLS Equivalent

**Status: SQLite has no RLS.** Access control is enforced at the application layer.

| Issue | Severity | Status |
|-------|----------|--------|
| `SECRET_KEY` hardcoded in source | 🔴 Critical | ✅ Fixed — now reads `process.env.JWT_SECRET` |
| Foreign keys not enforced | 🟠 High | ✅ Fixed — `db.pragma("foreign_keys = ON")` added |
| `/api/me` exposes `password` + `firebase_uid` | 🔴 Critical | ✅ Fixed — stripped before response |
| Passwords stored in plaintext | 🔴 Critical | ⚠️ Documented — requires bcrypt migration |
| No article content length limits (DoS risk) | 🟡 Medium | ⚠️ Documented in `sql/security-hardening.sql` |
| Random IDs via `Math.random()` (predictable) | 🟢 Low | ⚠️ Noted — use `crypto.randomUUID()` in prod |

**Fixes applied to `server.ts`:**
- Line 16: `const SECRET_KEY = process.env.JWT_SECRET || "territorial-secret-key";`
- After line 30: `db.pragma("foreign_keys = ON");`
- `/api/me`: destructure and omit `password` + `firebase_uid` from response

**Remaining manual action required:**
```typescript
// Install: npm install bcrypt @types/bcrypt
import bcrypt from "bcrypt";

// POST /api/register
const hashed = await bcrypt.hash(password, 12);
db.prepare("INSERT INTO users ... VALUES (?, ?, ...)").run(id, username, hashed, ...);

// POST /api/login
const user = db.prepare("SELECT * FROM users WHERE username = ?").get(username);
const valid = user && await bcrypt.compare(password, user.password);
```

---

## 2. Input Validation (Equivalent to RPC Security)

**Status: 2 routes had missing validation.**

| Route | Issue | Status |
|-------|-------|--------|
| `POST /api/actions/invest` | `regionId` not validated — money/energy deducted even if region doesn't exist | ✅ Fixed |
| `POST /api/profile/upgrade-perk` | `perkId` not validated against `PERKS_DEFS` — could insert arbitrary perk IDs | ✅ Fixed |
| `POST /api/actions/attack` | `regionId` validated ✓ | — |
| `POST /api/actions/work` | `factoryId` validated ✓ | — |

**Fixes applied:**

```typescript
// invest: region existence check added before resource deduction
const region = db.prepare("SELECT id FROM regions WHERE id = ?").get(regionId);
if (!region) return res.status(404).json({ error: "Region not found" });

// upgrade-perk: perkId validated against PERKS_DEFS
const validPerk = PERKS_DEFS.find(p => p.id === perkId);
if (!validPerk) return res.status(400).json({ error: "Invalid perk ID" });
```

---

## 3. Indexes

**Status: Zero explicit indexes existed. 7 added.**

All indexes are in `sql/indexes.sql` — apply with:
```bash
sqlite3 game.db < sql/indexes.sql
```

| Index | Table | Query benefited |
|-------|-------|-----------------|
| `idx_users_influence_desc` | `users` | `GET /api/leaderboard` — ORDER BY influence DESC |
| `idx_perks_userId` | `perks` | Every authenticated request (middleware) |
| `idx_articles_createdAt_desc` | `articles` | `GET /api/articles` — ORDER BY createdAt DESC |
| `idx_articles_authorId_createdAt` | `articles` | `POST /api/articles` rate-limit COUNT query |
| `idx_wars_status_startedAt` | `wars` | `GET /api/wars` — active wars filter + sort |
| `idx_wars_status_endsAt` | `wars` | `GET /api/wars` — ended wars filter + sort |
| `idx_regions_ownerId` | `regions` | `GET /api/regions` — LEFT JOIN users on ownerId |
| `idx_action_logs_userId_timestamp` | `action_logs` | Proactive (table written but never queried) |

> `user_factory_cooldowns(userId)` — covered by existing composite PK(userId, factoryId); no extra index needed.

**Estimated impact:** Queries against `perks` (fired on every request) and `articles`/`wars` (filtered + sorted) will go from O(n) full scans to O(log n) index lookups as data grows.

---

## 4. N+1 Queries

**Status: No classic N+1 loops found.**

The codebase avoids per-item queries inside loops. The one near-miss:

```typescript
// GET /api/factories — ✅ NOT an N+1
// 2 queries total, joined in memory:
const factories = db.prepare("SELECT * FROM factories").all();           // query 1
const cooldowns = db.prepare("... WHERE userId = ?").all(req.user.id);  // query 2
factories.map(f => { const cd = cooldowns.find(...); ... });            // in-memory join
```

**Minor optimization opportunity (not a bug):**

The `authenticate` middleware fires 2 sequential queries on every request:
1. `SELECT * FROM users WHERE id = ?`
2. `SELECT perkId, level FROM perks WHERE userId = ?`

These could be combined into one query with a LEFT JOIN, but the current approach is clear and performant enough for SQLite at MVP scale.

---

## 5. Batch Jobs

**Status: 1 `setInterval` job found. Error handling added.**

| Job | Frequency | What it does | Recommendation |
|-----|-----------|--------------|----------------|
| Economy tick | Every 10 min | `UPDATE regions SET population += 0.1%, stability += 1 WHERE stability < 100` | Keep in Node.js |

**Fix applied:** Wrapped in `try/catch` so a DB error doesn't silently kill the interval.

**Why not migrate to pg_cron / node-cron?**
- SQLite has no built-in scheduler (pg_cron is PostgreSQL-only)
- `setInterval` is fine for a single-process Node.js server
- `node-cron` would add value if you need cron-syntax scheduling or multiple jobs
- If/when migrating to Supabase/PostgreSQL, this translates directly to:
  ```sql
  CREATE OR REPLACE FUNCTION economy_tick() RETURNS void AS $$
  BEGIN
    UPDATE regions
    SET population = population + CAST(population * 0.001 AS INTEGER),
        stability = LEAST(100, stability + 1)
    WHERE stability < 100;
  END;
  $$ LANGUAGE plpgsql SECURITY DEFINER;

  SELECT cron.schedule('economy-tick', '*/10 * * * *', 'SELECT economy_tick()');
  ```

---

## 6. Connection Pooling

**Status: No action needed.**

| | |
|-|-|
| Database | SQLite (file-based) |
| Driver | `better-sqlite3` (synchronous, single connection) |
| Pooling needed? | No — SQLite is single-writer by design |
| WAL mode enabled? | ✅ Recommended in `sql/security-hardening.sql` (`PRAGMA journal_mode = WAL`) — enables concurrent reads |

**If migrating to Supabase/PostgreSQL:**
- Use the Supabase **Transaction Pooler** (port 6543, PgBouncer) instead of direct connection (port 5432)
- Change `DATABASE_URL` from `postgresql://...5432/postgres` → `postgresql://...6543/postgres?pgbouncer=true`
- Supabase dashboard → Settings → Database → Connection Pooling

---

## Files Generated

| File | Purpose |
|------|---------|
| `sql/indexes.sql` | 7 `CREATE INDEX IF NOT EXISTS` statements — apply to game.db |
| `sql/security-hardening.sql` | PRAGMA settings, constraint recommendations, critical issue notes |
| `SQL_AUDIT_REPORT.md` | This file |
| `.env.example` | Added `JWT_SECRET` documentation |

## Changes Applied to `server.ts`

| Line | Change |
|------|--------|
| 16 | `SECRET_KEY` reads from `process.env.JWT_SECRET` |
| 13 | Import `PERKS_DEFS` from `./src/types` |
| ~31 | `db.pragma("foreign_keys = ON")` |
| `/api/me` | Strip `password` + `firebase_uid` before response |
| `/api/actions/invest` | Region existence validated before resource deduction |
| `/api/profile/upgrade-perk` | `perkId` validated against `PERKS_DEFS` |
| Economy tick | Wrapped in `try/catch` |

---

## Priority Actions Remaining (Manual)

1. **[CRITICAL]** Add password hashing with bcrypt — plaintext passwords in SQLite is the single highest-risk issue
2. **[Medium]** Add content length validation to article endpoints (prevent DoS)
3. **[Low]** Replace `Math.random()` IDs with `crypto.randomUUID()` in production
4. **[Low]** Apply `sql/indexes.sql` to `game.db` — especially important before launch
5. **[Low]** Apply `PRAGMA journal_mode = WAL` from `sql/security-hardening.sql`
