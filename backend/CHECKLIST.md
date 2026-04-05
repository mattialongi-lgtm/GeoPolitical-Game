# Code Review Checklist

Use this checklist when reviewing PRs that touch the backend.

## Architecture

- [ ] Files placed in correct directory (`routes/`, `handlers/`, `services/`, etc.)
- [ ] Follows naming convention (`*.routes.ts`, `*.handler.ts`, `*.service.ts`)
- [ ] No circular imports between layers
- [ ] Services do not import from handlers or routes
- [ ] New services follow `ServiceResult<T>` pattern

## Type Safety

- [ ] TypeScript compiles without new errors (`./node_modules/.bin/tsc --noEmit`)
- [ ] Zod schema defined for new request bodies (`backend/types/schemas.ts`)
- [ ] `validateBody()` middleware applied to POST/PUT/PATCH routes
- [ ] No unnecessary `any` types introduced

## Error Handling

- [ ] Uses `AppError` or subclass for thrown errors
- [ ] Handlers use `try/catch` → `next(error)` pattern
- [ ] Services return `ServiceFailure` or throw `AppError` with context
- [ ] No sensitive data (SQL, API keys, stack traces) in error responses
- [ ] `errorHandler` middleware is registered last in `server.ts`

## Testing

- [ ] Unit tests added for new service methods
- [ ] Pure functions tested without mocks
- [ ] Supabase calls mocked (no real DB queries in tests)
- [ ] `npm test` passes
- [ ] Coverage ≥ 60% on changed files

## API Behavior

- [ ] No breaking changes to existing API response shapes
- [ ] HTTP status codes correct (200, 400, 401, 403, 404, 409, 500)
- [ ] Consistent error response format (`{ error: { code, message, ... } }`)
- [ ] Validation errors return 400 with clear messages

## Security

- [ ] Authentication middleware (`authenticate`) applied to protected routes
- [ ] Authorization checks in services/handlers (ownership, role)
- [ ] Input validated before use (no raw `req.body` in queries)
- [ ] No SQL injection vectors (parameterized queries / RPCs)

## Documentation

- [ ] `ARCHITECTURE.md` updated if structural changes made
- [ ] Complex logic has inline comments
- [ ] New endpoint documented in route file
