# Auth

> **Navigation aid.** Route list and file locations extracted via AST. Read the source files listed below before implementing or modifying this subsystem.

The Auth subsystem handles **4 routes** and touches: auth, db.

## Routes

- `POST` `/api/register` [auth, db]
  `server.ts`
- `POST` `/api/login` [auth, db]
  `server.ts`
- `POST` `/api/logout` [auth, db]
  `server.ts`
- `POST` `/api/auth/firebase` [auth, db]
  `server.ts`

## Middleware

- **authClient** (auth) — `src\api\authClient.ts`
- **authenticate** (auth) — `backend\routes\automation.routes.ts`

## Source Files

Read these before implementing or modifying this subsystem:
- `server.ts`

---
_Back to [overview.md](./overview.md)_