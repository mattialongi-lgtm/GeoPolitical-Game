# Actions

> **Navigation aid.** Route list and file locations extracted via AST. Read the source files listed below before implementing or modifying this subsystem.

The Actions subsystem handles **4 routes** and touches: auth, db.

## Routes

- `POST` `/api/actions/work` [auth, db] → middleware: authenticate
  `server.ts`
- `POST` `/api/actions/propaganda` [auth, db] → middleware: authenticate
  `server.ts`
- `POST` `/api/actions/invest` [auth, db] → middleware: authenticate
  `server.ts`
- `POST` `/api/actions/attack` [auth, db] → middleware: authenticate
  `server.ts`

## Related Models

- **work_auto_actions** (8 fields) → [database.md](./database.md)
- **training_auto_actions** (7 fields) → [database.md](./database.md)

## Source Files

Read these before implementing or modifying this subsystem:
- `server.ts`

---
_Back to [overview.md](./overview.md)_