# Factories

> **Navigation aid.** Route list and file locations extracted via AST. Read the source files listed below before implementing or modifying this subsystem.

The Factories subsystem handles **1 routes** and touches: auth, db.

## Routes

- `GET` `/api/factories` [auth, db] → middleware: authenticate
  `server.ts`

## Related Models

- **factories** (8 fields) → [database.md](./database.md)

## Source Files

Read these before implementing or modifying this subsystem:
- `server.ts`

---
_Back to [overview.md](./overview.md)_