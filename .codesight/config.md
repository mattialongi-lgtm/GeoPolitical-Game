# Config

## Environment Variables

- `BACKEND_BASE_URL` **required** — scripts\security-db-rls-validation.mjs
- `DB_TEST_USER_PASSWORD` **required** — scripts\security-db-rls-validation.mjs
- `DEBUG` **required** — backend\utils\logger.ts
- `DISABLE_HMR` **required** — vite.config.ts
- `ENABLE_DEV_ENDPOINTS` **required** — backend\app.ts
- `FIREBASE_CLIENT_EMAIL` **required** — server.ts
- `FIREBASE_PRIVATE_KEY` **required** — server.ts
- `FIREBASE_PROJECT_ID` **required** — server.ts
- `GEMINI_API_KEY` (has default) — .env.example
- `JWT_SECRET` (has default) — .env.example
- `NODE_ENV` **required** — backend\app.ts
- `PORT` **required** — backend\app.ts
- `REQUIRE_BACKEND_FLOW_VALIDATION` **required** — scripts\security-db-rls-validation.mjs
- `REQUIRE_DB_INTEGRATION` **required** — scripts\security-db-integration.mjs
- `REQUIRE_DB_RLS_VALIDATION` **required** — scripts\security-db-rls-validation.mjs
- `RUN_BACKEND_FLOW_VALIDATION` **required** — scripts\security-db-rls-validation.mjs
- `RUN_DB_INTEGRATION_TESTS` **required** — scripts\security-db-integration.mjs
- `RUN_DB_RLS_VALIDATION_TESTS` **required** — scripts\security-db-rls-validation.mjs
- `SUPABASE_ANON_KEY` (has default) — supabase\.env
- `SUPABASE_SERVICE_ROLE_KEY` (has default) — .env.example
- `SUPABASE_URL` (has default) — supabase\.env
- `VITE_SUPABASE_ANON_KEY` (has default) — .env.example
- `VITE_SUPABASE_URL` (has default) — .env.example

## Config Files

- `.env.example`
- `tsconfig.json`
- `vite.config.ts`

## Key Dependencies

- @supabase/supabase-js: ^2.99.0
- better-sqlite3: ^12.8.0
- express: ^4.22.1
- react: ^19.0.0
- zod: ^4.3.6
