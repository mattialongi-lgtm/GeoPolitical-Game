# Project Context

This is a typescript project using express.

The API has 23 routes. See .codesight/routes.md for the full route map with methods, paths, and tags.
The database has 91 models. See .codesight/schema.md for the full schema with fields, types, and relations.
The UI has 103 components. See .codesight/components.md for the full list with props.
Middleware includes: logging, rate-limit, validation, custom, error-handler, auth.

High-impact files (most imported, changes here affect many other files):
- src\types.ts (imported by 72 files)
- backend\utils\logger.ts (imported by 16 files)
- src\hooks\usePollingTask.ts (imported by 12 files)
- src\components\home\mockData.ts (imported by 11 files)
- backend\middleware\rateLimiter.middleware.ts (imported by 8 files)
- backend\services\service-result.ts (imported by 8 files)
- backend\__tests__\setup.ts (imported by 8 files)
- backend\repositories\war.repository.ts (imported by 7 files)

Required environment variables (no defaults):
- BACKEND_BASE_URL (scripts\security-db-rls-validation.mjs)
- DB_TEST_USER_PASSWORD (scripts\security-db-rls-validation.mjs)
- DEBUG (backend\utils\logger.ts)
- DISABLE_HMR (vite.config.ts)
- ENABLE_DEV_ENDPOINTS (backend\app.ts)
- FIREBASE_CLIENT_EMAIL (backend\app.ts)
- FIREBASE_PRIVATE_KEY (backend\app.ts)
- FIREBASE_PROJECT_ID (backend\app.ts)
- NODE_ENV (backend\app.ts)
- PORT (backend\app.ts)
- REQUIRE_BACKEND_FLOW_VALIDATION (scripts\security-db-rls-validation.mjs)
- REQUIRE_DB_INTEGRATION (scripts\security-db-integration.mjs)
- REQUIRE_DB_RLS_VALIDATION (scripts\security-db-rls-validation.mjs)
- RUN_BACKEND_FLOW_VALIDATION (scripts\security-db-rls-validation.mjs)
- RUN_DB_INTEGRATION_TESTS (scripts\security-db-integration.mjs)

Read .codesight/wiki/index.md for orientation (WHERE things live). Then read actual source files before implementing. Wiki articles are navigation aids, not implementation guides.
Read .codesight/CODESIGHT.md for the complete AI context map including all routes, schema, components, libraries, config, middleware, and dependency graph.
