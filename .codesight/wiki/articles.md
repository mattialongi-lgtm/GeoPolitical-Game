# Articles

> **Navigation aid.** Route list and file locations extracted via AST. Read the source files listed below before implementing or modifying this subsystem.

The Articles subsystem handles **5 routes** and touches: auth, db.

## Routes

- `GET` `/api/articles` [auth, db] → middleware: authenticate
  `server.ts`
- `GET` `/api/articles/:id` params(id) [auth, db] → middleware: authenticate
  `server.ts`
- `POST` `/api/articles` [auth, db] → middleware: authenticate
  `server.ts`
- `PUT` `/api/articles/:id` params(id) [auth, db] → middleware: authenticate
  `server.ts`
- `DELETE` `/api/articles/:id` params(id) [auth, db] → middleware: authenticate
  `server.ts`

## Related Models

- **articles** (7 fields) → [database.md](./database.md)

## Source Files

Read these before implementing or modifying this subsystem:
- `server.ts`

---
_Back to [overview.md](./overview.md)_