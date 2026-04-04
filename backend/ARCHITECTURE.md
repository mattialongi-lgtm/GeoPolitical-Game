# Backend Architecture

## Overview

The backend is an **Express** server (`server.ts`) backed by **Supabase**
(PostgreSQL + PostgREST + Auth).  The codebase is being progressively
modularised from a monolithic `server.ts` (~500 KB) into a layered
architecture under `backend/`.

### Request Flow

```
Client Request
  → Express Router (backend/routes/*.routes.ts)
    → Zod Validation Middleware (backend/middleware/validation.middleware.ts)
      → Handler / Controller (backend/handlers/*.handler.ts | backend/controllers/)
        → Service (backend/services/*.service.ts)
          → Repository (backend/repositories/*.repository.ts)
            → Supabase Client (DB / RPC)
              → Response
```

### Error Flow

```
Service throws AppError
  → Handler catches → next(error)
    → errorHandler middleware (backend/middleware/errorHandler.middleware.ts)
      → Structured JSON error response
```

---

## Directory Structure

```
backend/
├── __tests__/              # Jest unit tests (mirrors source structure)
│   ├── errors/
│   ├── middleware/
│   ├── services/
│   └── utils/
├── controllers/            # Higher-level request orchestration
│   └── war.controller.ts
├── errors/                 # Error class hierarchy
│   └── AppError.ts
├── handlers/               # Route handlers (17 files, ~193 endpoints)
│   ├── user.handler.ts
│   ├── actions.handler.ts
│   ├── wars-legacy.handler.ts
│   └── ...
├── middleware/              # Express middleware
│   ├── errorHandler.middleware.ts
│   └── validation.middleware.ts
├── observability/           # Response contract guards
│   └── contract-guards.ts
├── repositories/            # Data-access layer (Supabase queries)
│   ├── daily-reward.repository.ts
│   ├── factory-create.repository.ts
│   └── ...
├── routes/                  # Express routers (18 files)
│   ├── user.routes.ts
│   ├── war.routes.ts
│   └── index.ts
├── services/                # Business logic layer (20 files)
│   ├── service-result.ts
│   ├── http-result.mapper.ts
│   ├── extraction.service.ts
│   ├── economy.service.ts
│   ├── governance.service.ts
│   ├── user.service.ts
│   ├── war.service.ts
│   ├── factory-create.service.ts
│   ├── production.service.ts
│   └── index.ts
├── types/                   # TypeScript types & Zod schemas
│   ├── index.ts
│   └── schemas.ts
└── utils/                   # Shared utilities
    ├── logger.ts
    └── geography.ts
```

---

## Layers

### 1. Routes (`backend/routes/`)

Express routers grouped by domain.  Each file exports a
`registerXRoutes(deps)` function that receives shared dependencies
(Supabase client, auth middleware, helpers) and registers all
endpoints for that domain.

**Registration pattern:**
```typescript
export function registerUserRoutes(deps: RouteDeps) {
  const h = createUserHandlers(deps);
  const { app, authenticate } = deps;
  app.get('/api/user/profile', authenticate, h.getProfile);
}
```

All 18 route groups are aggregated in `backend/routes/index.ts`
via `setupRoutes(deps)`.

### 2. Handlers (`backend/handlers/`)

Thin functions that parse HTTP request data, call services, and
send the HTTP response.  They use a **factory function** pattern:
`createXHandlers(deps)` returns an object of handler methods.

**Pattern:**
```typescript
export function createUserHandlers(deps: RouteDeps) {
  return {
    getProfile: async (req, res) => {
      const user = req.user;
      res.json({ user });
    },
  };
}
```

### 3. Controllers (`backend/controllers/`)

Optional layer for complex domains (war).  Controllers orchestrate
multiple service calls, validate responses with contract guards, and
map `ServiceResult` to HTTP.

### 4. Services (`backend/services/`)

Business logic, stateless.  Two patterns coexist:

- **Simple services** (`ExtractionService`, `EconomyService`, etc.):
  Take a Supabase client in the constructor.  Instantiated via
  `createServices(supabase)` factory.

- **Repository-backed services** (`WarService`, `FactoryCreateService`,
  `ProductionService`):  Take a repository + domain dependencies.
  Instantiated at route-registration level.

**Return type:** `ServiceResult<T>` — a discriminated union:
```typescript
type ServiceResult<T> = ServiceSuccess<T> | ServiceFailure;
// ServiceSuccess: { type: 'success', statusCode, payload }
// ServiceFailure: { type: 'validation_error' | 'forbidden' | ... , statusCode, message }
```

Helpers: `serviceSuccess()`, `validationError()`, `forbiddenError()`,
`notFoundError()`, `conflictError()`, `systemError()`.

### 5. Repositories (`backend/repositories/`)

Data-access layer — thin wrappers around Supabase `.from()` and
`.rpc()` calls.  Isolate query details from business logic.

### 6. Types (`backend/types/`)

- `types/index.ts` — re-exports `AuthenticatedRequest`, `RouteHandler`,
  `RouteDeps`, `ApiErrorResponse`, `PaginatedResponse<T>`.
- `types/schemas.ts` — Zod v4 validation schemas for request bodies
  (25 schemas across all domains).

### 7. Errors (`backend/errors/`)

`AppError` hierarchy:
| Class | Code | HTTP |
|---|---|---|
| `AppError` | (custom) | (custom) |
| `ValidationError` | `VALIDATION_ERROR` | 400 |
| `AuthError` | `AUTH_ERROR` | 401 |
| `ForbiddenError` | `FORBIDDEN` | 403 |
| `NotFoundError` | `NOT_FOUND` | 404 |
| `ConflictError` | `CONFLICT` | 409 |
| `ServiceError` | `SERVICE_ERROR` | 500 |

### 8. Middleware (`backend/middleware/`)

- `validation.middleware.ts` — `validateBody(schema)` and
  `validateQuery(schema)` middleware factories using Zod.
- `errorHandler.middleware.ts` — global error handler (registered
  last).

### 9. Utils (`backend/utils/`)

- `logger.ts` — structured logger (`info`, `warn`, `error`, `debug`).
  Drop-in swap for Winston/Pino.

---

## Adding a New Endpoint

1. **Define Zod schema** in `backend/types/schemas.ts`.
2. **Add service method** in the appropriate `backend/services/*.service.ts`.
3. **Add handler** in `backend/handlers/*.handler.ts` (inside
   `createXHandlers()`).
4. **Register route** in `backend/routes/*.routes.ts` with
   `validateBody(schema)` middleware.
5. **Write unit test** in `backend/__tests__/services/*.test.ts`.
6. **Verify:** `npm test && npm run build`.

---

## RPC Best Practices

- **Never** call `supabase.rpc()` directly in handlers.
- **Always** wrap in a service method with proper error handling.
- Services throw `AppError` (or return `ServiceFailure`) on RPC
  failure.
- Every RPC call should log operation, inputs, and result.

---

## Testing

```bash
npm test                    # Run all tests with coverage
npm run test:watch          # Watch mode for development
```

Test infrastructure:
- **Jest** + **ts-jest** with CommonJS tsconfig (`tsconfig.jest.json`).
- `backend/__tests__/setup.ts` — chainable Supabase mock factory.
- Coverage tracked on errors, middleware, utils, and simple services.

See also: `backend/DEPLOYMENT.md` for deployment procedures.
