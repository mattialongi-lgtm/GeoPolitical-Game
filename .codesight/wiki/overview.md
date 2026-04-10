# react-example — Overview

> **Navigation aid.** This article shows WHERE things live (routes, models, files). Read actual source files before implementing new features or making changes.

**react-example** is a typescript project built with express.

## Scale

23 API routes · 91 database models · 103 UI components · 13 middleware layers · 23 environment variables

## Subsystems

- **[Auth](./auth.md)** — 4 routes — touches: auth, db
- **[Actions](./actions.md)** — 4 routes — touches: auth, db
- **[Articles](./articles.md)** — 5 routes — touches: auth, db
- **[Factories](./factories.md)** — 1 routes — touches: auth, db
- **[Leaderboard](./leaderboard.md)** — 1 routes — touches: auth, db
- **[Me](./me.md)** — 1 routes — touches: auth, db
- **[Profile](./profile.md)** — 1 routes — touches: auth, db
- **[RateLimiter.test](./rateLimiter.test.md)** — 2 routes
- **[Regions](./regions.md)** — 2 routes — touches: auth, db
- **[Wars](./wars.md)** — 2 routes — touches: auth, db

**Database:** unknown, 91 models — see [database.md](./database.md)

**UI:** 103 components (react) — see [ui.md](./ui.md)

## High-Impact Files

Changes to these files have the widest blast radius across the codebase:

- `src\types.ts` — imported by **72** files
- `backend\utils\logger.ts` — imported by **16** files
- `src\hooks\usePollingTask.ts` — imported by **12** files
- `src\components\home\mockData.ts` — imported by **11** files
- `backend\middleware\rateLimiter.middleware.ts` — imported by **8** files
- `backend\services\service-result.ts` — imported by **8** files

## Required Environment Variables

- `BACKEND_BASE_URL` — `scripts\security-db-rls-validation.mjs`
- `DB_TEST_USER_PASSWORD` — `scripts\security-db-rls-validation.mjs`
- `DEBUG` — `backend\utils\logger.ts`
- `DISABLE_HMR` — `vite.config.ts`
- `ENABLE_DEV_ENDPOINTS` — `backend\app.ts`
- `FIREBASE_CLIENT_EMAIL` — `server.ts`
- `FIREBASE_PRIVATE_KEY` — `server.ts`
- `FIREBASE_PROJECT_ID` — `server.ts`
- `NODE_ENV` — `backend\app.ts`
- `PORT` — `backend\app.ts`
- `REQUIRE_BACKEND_FLOW_VALIDATION` — `scripts\security-db-rls-validation.mjs`
- `REQUIRE_DB_INTEGRATION` — `scripts\security-db-integration.mjs`
- _...4 more_

---
_Back to [index.md](./index.md) · Generated 2026-04-10_