const assert = require('node:assert/strict');
const fs = require('node:fs');

function count(source, token) {
  let n = 0;
  let idx = source.indexOf(token);
  while (idx !== -1) {
    n += 1;
    idx = source.indexOf(token, idx + token.length);
  }
  return n;
}

function mustIncludeOrdered(source, markers, label) {
  let cursor = 0;
  for (const marker of markers) {
    const idx = source.indexOf(marker, cursor);
    assert.ok(idx >= 0, `${label}: missing marker \"${marker}\"`);
    cursor = idx + marker.length;
  }
}

const server = fs.readFileSync('server.ts', 'utf8');
const schema = fs.readFileSync('supabase/schema.sql', 'utf8');

// 1) Direct table touch-points in backend must stay explicit and bounded.
assert.equal(count(server, ".from('budget_transactions')"), 1, 'budget_transactions direct access surface changed');
assert.equal(count(server, ".from('cooldowns')"), 6, 'cooldowns direct access surface changed');
assert.equal(count(server, ".from('user_factory_cooldowns')"), 6, 'user_factory_cooldowns direct access surface changed');

// 2) budget_transactions read must stay behind leader ownership gate in /api/budget/:ownerType/:ownerId.
mustIncludeOrdered(server, [
  'app.get("/api/budget/:ownerType/:ownerId", authenticate, async (req: any, res) => {',
  "if (normalizedOwnerType !== 'REGION')",
  ".from('regions')",
  'region.ownerUserId !== req.user.id',
  ".from('budget_transactions')",
], 'budget history authorization flow');

// 3) budget_transactions writes must stay RPC-driven (no direct insert/update from server).
assert.equal(count(server, ".from('budget_transactions').insert"), 0, 'direct insert into budget_transactions is not allowed in server');
assert.equal(count(server, ".from('budget_transactions').update"), 0, 'direct update into budget_transactions is not allowed in server');

// 4) Schema guardrails: critical writes remain atomic in SQL functions.
mustIncludeOrdered(schema, [
  'CREATE OR REPLACE FUNCTION add_budget_transaction(',
  'INSERT INTO budget_transactions (',
], 'add_budget_transaction writes budget_transactions');

mustIncludeOrdered(schema, [
  'CREATE OR REPLACE FUNCTION process_work_action(',
  'INSERT INTO user_factory_cooldowns',
], 'process_work_action writes user_factory_cooldowns');

mustIncludeOrdered(schema, [
  'CREATE OR REPLACE FUNCTION execute_factory_work(',
  'INSERT INTO user_factory_cooldowns',
], 'execute_factory_work writes user_factory_cooldowns');

console.log('security-economic-cooldown-surface: OK');
