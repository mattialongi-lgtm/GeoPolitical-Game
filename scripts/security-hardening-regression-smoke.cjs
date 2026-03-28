const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');

function mustInclude(haystack, needle, message) {
  assert.equal(haystack.includes(needle), true, message);
}

function run() {
  const serverTs = readFileSync('server.ts', 'utf8');
  const applySql = readFileSync('supabase/migration_apply_atomic_pending_guard.sql', 'utf8');
  const resolveSql = readFileSync('supabase/migration_resolve_application_atomic.sql', 'utf8');
  const expireSql = readFileSync('supabase/migration_expire_revolution_lobby_atomic.sql', 'utf8');

  // 1) Regional/state read endpoints must gate with canReadRegionScopedData
  mustInclude(serverTs, 'app.get("/api/military-agreements/:stateId"', 'missing military-agreements endpoint');
  mustInclude(serverTs, 'app.get("/api/war-departments/:stateId"', 'missing war-departments endpoint');
  mustInclude(serverTs, 'app.get("/api/revolutions/:regionId"', 'missing revolutions endpoint');
  mustInclude(serverTs, 'app.get("/api/coups/:regionId"', 'missing coups endpoint');
  mustInclude(serverTs, 'const canRead = await canReadRegionScopedData(req.user, stateId);', 'state read authorization guard missing');
  mustInclude(serverTs, 'const canRead = await canReadRegionScopedData(req.user, regionId);', 'region read authorization guard missing');

  // 2) Newspaper role escalation guard (editor cannot self-escalate invites)
  mustInclude(serverTs, "const targetRole = normalizeNewspaperRole(role || 'writer');", 'newspaper role normalization missing');
  mustInclude(serverTs, 'if (!canAssignNewspaperRole(myMember.role, targetRole))', 'newspaper assignment guard missing');
  mustInclude(serverTs, "if (actorRole === 'editor') return targetRole === 'writer';", 'editor assignment matrix missing');

  // 3) Apply flow guarded by RPC + duplicate pending DB uniqueness
  mustInclude(serverTs, "supabase.rpc('create_application_atomic'", 'apply endpoint no longer uses atomic RPC');
  mustInclude(serverTs, 'duplicate_pending: 409,', 'apply duplicate pending HTTP mapping missing');
  mustInclude(applySql, 'CREATE UNIQUE INDEX IF NOT EXISTS applications_pending_unique_idx', 'pending duplicate unique index missing');
  mustInclude(applySql, 'WHEN unique_violation THEN', 'duplicate pending unique violation handling missing');

  // 4) Resolve flow idempotency guard
  mustInclude(serverTs, "supabase.rpc('resolve_application_atomic'", 'resolve endpoint no longer uses atomic RPC');
  mustInclude(resolveSql, "IF v_application.status <> 'pending' THEN", 'resolve idempotency branch missing');
  mustInclude(resolveSql, "'idempotent', true", 'resolve idempotent success response missing');

  // 5) GET lobbies must be read-only (no expire/refund side-effects)
  const lobbiesGetChunk = (serverTs.split('app.get("/api/lobbies/:regionId"')[1] || '').split('app.post("/api/lobbies/:id/expire"')[0] || '';
  assert.notEqual(lobbiesGetChunk.length, 0, 'unable to isolate lobbies GET chunk');
  assert.equal(/\.update\(/.test(lobbiesGetChunk), false, 'lobbies GET contains update side-effect');
  assert.equal(/from\('users'\)\.update/.test(lobbiesGetChunk), false, 'lobbies GET contains refund side-effect');

  // 6) Expire lobby RPC must be idempotent and refund-safe
  mustInclude(expireSql, "IF v_lobby.status = 'expired' THEN", 'expire lobby idempotent branch missing');
  mustInclude(expireSql, "'idempotent', true", 'expire lobby idempotent response missing');
  mustInclude(expireSql, 'WHERE id = v_lobby.id', 'expire lobby update target missing');
  mustInclude(expireSql, "AND status = 'pending';", 'expire lobby conditional update missing');

  console.log('security-hardening-regression-smoke: OK');
}

run();

