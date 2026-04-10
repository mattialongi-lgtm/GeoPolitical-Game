# Wars

> **Navigation aid.** Route list and file locations extracted via AST. Read the source files listed below before implementing or modifying this subsystem.

The Wars subsystem handles **2 routes** and touches: auth, db.

## Routes

- `GET` `/api/wars` [auth, db] → middleware: authenticate
  `server.ts`
- `GET` `/api/wars/:id` params(id) [auth, db] → middleware: authenticate
  `server.ts`

## Related Models

- **wars** (11 fields) → [database.md](./database.md)

## Source Files

Read these before implementing or modifying this subsystem:
- `server.ts`

---
_Back to [overview.md](./overview.md)_