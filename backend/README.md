# Backend

Express + Supabase backend for the GeoPolitical game.

## Quick Start

```bash
# Install dependencies
npm install --legacy-peer-deps

# Start development server (with hot reload)
npm run dev
```

## Testing

```bash
# Run all tests with coverage report
npm test

# Watch mode (re-runs on file changes)
npm run test:watch
```

## Building

```bash
# Build frontend (Vite)
npm run build

# TypeScript check (no emit)
./node_modules/.bin/tsc --noEmit
```

## Project Structure

| Directory | Purpose |
|---|---|
| `backend/routes/` | Express routers (18 domain groups) |
| `backend/handlers/` | Request handlers (17 files, ~193 endpoints) |
| `backend/services/` | Business logic (20 service files) |
| `backend/repositories/` | Data access layer |
| `backend/controllers/` | Complex request orchestration |
| `backend/errors/` | Error class hierarchy |
| `backend/middleware/` | Validation & error handling |
| `backend/types/` | TypeScript types & Zod schemas |
| `backend/utils/` | Logger, geography helpers |
| `backend/__tests__/` | Jest unit tests |

## Documentation

- **[ARCHITECTURE.md](./ARCHITECTURE.md)** — Full architecture guide, layer descriptions, patterns
- **[DEPLOYMENT.md](./DEPLOYMENT.md)** — Deployment procedures, rollback, monitoring
- **[CHECKLIST.md](./CHECKLIST.md)** — Code review checklist for PRs
