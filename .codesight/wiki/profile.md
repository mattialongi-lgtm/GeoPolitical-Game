# Profile

> **Navigation aid.** Route list and file locations extracted via AST. Read the source files listed below before implementing or modifying this subsystem.

The Profile subsystem handles **1 routes** and touches: auth, db.

## Routes

- `POST` `/api/profile/upgrade-perk` [auth, db] → middleware: authenticate
  `server.ts`

## Source Files

Read these before implementing or modifying this subsystem:
- `server.ts`

---
_Back to [overview.md](./overview.md)_