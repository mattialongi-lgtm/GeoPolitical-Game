# Deployment Guide

## Pre-Deployment Checklist

### Build & Tests

- [ ] `npm test` — all unit tests pass
- [ ] `npm run build` (`npx vite build`) — frontend build succeeds
- [ ] `./node_modules/.bin/tsc --noEmit` — no new TypeScript errors
  - *Note:* 22 pre-existing errors in test/diag files are expected

### Code Quality

- [ ] No circular imports between layers (services ← handlers ← routes)
- [ ] All new endpoints have Zod validation schema
- [ ] Error handling uses `AppError` hierarchy (no raw `res.status()`)
- [ ] Sensitive data not exposed in error responses

### Behavior Verification

- [ ] Refactored endpoints return identical response shapes
- [ ] HTTP status codes unchanged
- [ ] Error messages consistent with existing client expectations

---

## Deployment Steps

### Step 1: Local Verification (30 min)

```bash
# Install dependencies
npm install --legacy-peer-deps

# Run full test suite
npm test

# TypeScript check
./node_modules/.bin/tsc --noEmit

# Build frontend
npx vite build

# Start dev server
npm run dev

# Smoke test (in another terminal)
curl -s http://localhost:3000/api/user/profile | head -c 200
curl -s http://localhost:3000/api/countries/all | head -c 200
curl -s http://localhost:3000/api/regions | head -c 200
```

### Step 2: Code Review

```bash
# Create PR
git push origin feature/my-changes

# Review against CHECKLIST.md
# Ensure no breaking changes
```

### Step 3: Production Deployment

```bash
# Merge approved PR
git merge feature/my-changes

# Deploy (platform-specific)
# Monitor error logs for 30 minutes post-deploy
```

### Step 4: Rollback (if needed)

```bash
# Revert the merge commit
git revert HEAD --no-edit
git push origin main

# Re-deploy
# Verify rollback with smoke tests
```

---

## Monitoring

### Post-Deployment Checks (30 min window)

1. **Error rate** — watch for spike in 500 responses
2. **Response times** — no significant latency increase
3. **RPC failures** — check Supabase dashboard for failing RPCs
4. **Client errors** — browser console for unexpected 4xx responses

### Key Metrics to Watch

- API error rate (should stay < 1%)
- Average response time (should stay < 500ms)
- Supabase RPC success rate
- Active user count (should not drop)

### Supabase Dashboard Queries

```sql
-- Recent errors (last 30 minutes)
SELECT
  status,
  COUNT(*) as count
FROM auth.audit_log_entries
WHERE created_at > now() - interval '30 minutes'
GROUP BY status
ORDER BY count DESC;
```

---

## Architecture Notes

- Refactored code is **additive** — no handler behavior changed
- Services are **stateless** — safe to deploy without session concerns
- Error middleware is **last** — registered after all routes in `backend/app.ts`
- See `backend/ARCHITECTURE.md` for full architecture documentation
