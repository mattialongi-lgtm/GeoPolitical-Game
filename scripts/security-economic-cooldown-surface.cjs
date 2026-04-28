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

const governanceHandler = fs.readFileSync('backend/handlers/governance.handler.ts', 'utf8');
const actionsHandler = fs.readFileSync('backend/handlers/actions.handler.ts', 'utf8');
const factoriesHandler = fs.readFileSync('backend/handlers/factories.handler.ts', 'utf8');
const economyService = fs.readFileSync('backend/services/economy.service.ts', 'utf8');
const handlerSurface = `${governanceHandler}\n${actionsHandler}\n${factoriesHandler}`;
const schema = fs.readFileSync('supabase/schema.sql', 'utf8');

// 1) Direct table touch-points in backend must stay explicit and bounded.
assert.equal(count(handlerSurface, ".from('budget_transactions')"), 1, 'budget_transactions direct read surface changed');
assert.equal(count(handlerSurface, ".from('cooldowns')"), 4, 'cooldowns direct access surface changed');
assert.equal(count(handlerSurface, ".from('user_factory_cooldowns')"), 3, 'user_factory_cooldowns direct access surface changed');

// 2) budget_transactions read must stay behind leader ownership gate in /api/budget/:ownerType/:ownerId.
mustIncludeOrdered(governanceHandler, [
  'async function getBudget(req: any, res: any) {',
  "if (normalizedOwnerType !== 'REGION')",
  ".from('regions')",
  'region.ownerUserId !== req.user.id',
  ".from('budget_transactions')",
], 'budget history authorization flow');

// 3) Route handlers must not write budget_transactions directly.
assert.equal(count(handlerSurface, ".from('budget_transactions').insert"), 0, 'direct insert into budget_transactions is not allowed in route handlers');
assert.equal(count(handlerSurface, ".from('budget_transactions').update"), 0, 'direct update into budget_transactions is not allowed in route handlers');

// 4) Legacy budget transaction helper must prefer the RPC path before its compatibility fallback.
mustIncludeOrdered(economyService, [
  'let { data, error } = await this.repo.addBudgetTransactionRpc(payload);',
  '({ data, error } = await this.repo.addBudgetTransactionRpc(payload));',
  'const isAmbiguousOverload =',
  'return await addBudgetTransactionFallback();',
], 'addBudgetTransactionLegacy rpc-first fallback flow');

// 5) Schema guardrails: critical writes remain atomic in SQL functions.
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
