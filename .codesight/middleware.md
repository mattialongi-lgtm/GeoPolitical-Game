# Middleware

## logging
- errorHandler.middleware — `backend\middleware\errorHandler.middleware.ts`

## rate-limit
- rateLimiter.middleware — `backend\middleware\rateLimiter.middleware.ts`
- rateLimiter.test — `backend\__tests__\middleware\rateLimiter.test.ts`

## validation
- validation.middleware — `backend\middleware\validation.middleware.ts`
- validation.test — `backend\__tests__\middleware\validation.test.ts`

## custom
- contract-guards — `backend\observability\contract-guards.ts`
- migrate — `scripts\migrate.ts`
- migrate_resource_caps — `supabase\migrate_resource_caps.sql`
- migration_apply_atomic_pending_guard — `supabase\migration_apply_atomic_pending_guard.sql`

## error-handler
- errorHandler.test — `backend\__tests__\middleware\errorHandler.test.ts`
- errorHandler — `backend\app.ts`

## auth
- authClient — `src\api\authClient.ts`
- authenticate — `backend\routes\automation.routes.ts`
