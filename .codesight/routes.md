# Routes

## CRUD Resources

- **`/api/articles`** GET | POST | GET/:id | PUT/:id | DELETE/:id → Article

## Other Routes

- `GET` `/test` params() ✓
- `POST` `/test` params() ✓
- `POST` `/api/register` params() [auth, db]
- `POST` `/api/login` params() [auth, db]
- `POST` `/api/logout` params() [auth, db]
- `POST` `/api/auth/firebase` params() [auth, db]
- `GET` `/api/me` params() [auth, db]
- `GET` `/api/regions` params() [auth, db]
- `GET` `/api/regions/:id` params(id) [auth, db]
- `POST` `/api/actions/work` params() [auth, db]
- `GET` `/api/factories` params() [auth, db]
- `POST` `/api/actions/propaganda` params() [auth, db]
- `POST` `/api/actions/invest` params() [auth, db]
- `POST` `/api/actions/attack` params() [auth, db]
- `GET` `/api/wars` params() [auth, db]
- `GET` `/api/wars/:id` params(id) [auth, db]
- `POST` `/api/profile/upgrade-perk` params() [auth, db]
- `GET` `/api/leaderboard` params() [auth, db]
