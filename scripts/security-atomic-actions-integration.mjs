import { randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';

const supabaseUrl = (process.env.VITE_SUPABASE_URL || '').trim();
const serviceRoleKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
const runFlag = process.env.RUN_DB_INTEGRATION_TESTS === 'true';
const requireRun = process.env.REQUIRE_DB_INTEGRATION === 'true';

if (!runFlag || !supabaseUrl || !serviceRoleKey) {
  const msg = 'security-atomic-actions-integration: SKIPPED (set RUN_DB_INTEGRATION_TESTS=true + Supabase env vars)';
  if (requireRun) {
    console.error(msg);
    process.exit(1);
  }
  console.log(msg);
  process.exit(0);
}

let createClient;
try {
  ({ createClient } = await import('@supabase/supabase-js'));
} catch (_err) {
  const msg = 'security-atomic-actions-integration: SKIPPED (@supabase/supabase-js not installed in this environment)';
  if (requireRun) {
    console.error(msg);
    process.exit(1);
  }
  console.log(msg);
  process.exit(0);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

function makeRegionId(prefix) {
  const letters = randomUUID().replace(/[^a-f]/gi, '').toUpperCase().slice(0, 3).padEnd(3, 'A');
  return `${prefix}${letters}`.slice(0, 4);
}

async function mustNoError(step, error) {
  if (error) {
    throw new Error(`${step} failed: ${error.message || JSON.stringify(error)}`);
  }
}

const nationId = `N${randomUUID().replace(/[^a-f]/gi, '').toUpperCase().slice(0, 3).padEnd(3, 'A')}`.slice(0, 4);
const homeRegionId = makeRegionId('H');
const travelRegionId = makeRegionId('T');
const attackRegionId = makeRegionId('W');
const deepRegionId = makeRegionId('D');

const provisionUserId = randomUUID();
const travelerUserId = randomUUID();
const attackerUserId = randomUUID();
const targetOwnerUserId = randomUUID();
const deepManagerUserId = randomUUID();

async function setup() {
  await mustNoError(
    'insert nation',
    (await supabase.from('nations').insert({
      id: nationId,
      name: `Nation ${nationId}`,
    })).error
  );

  await mustNoError(
    'insert regions',
    (await supabase.from('regions').insert([
      { id: homeRegionId, name: `Home ${homeRegionId}`, population: 1000 },
      { id: travelRegionId, name: `Travel ${travelRegionId}`, population: 1000, workRestrictions: 1, travelFee: 25 },
      { id: attackRegionId, name: `Attack ${attackRegionId}`, population: 1000, ownerUserId: targetOwnerUserId },
      { id: deepRegionId, name: `Deep ${deepRegionId}`, population: 1000, ownerUserId: deepManagerUserId, economicAdviserId: deepManagerUserId, nation_id: nationId, isCapital: true },
    ])).error
  );

  await mustNoError(
    'insert users',
    (await supabase.from('users').insert([
      {
        id: travelerUserId,
        username: `trav_${homeRegionId}`,
        email: `trav_${homeRegionId}@local.test`,
        money: 1000,
        regionId: homeRegionId,
        residenceId: homeRegionId,
        lastEnergyUpdate: Date.now(),
        lastLogin: Date.now(),
      },
      {
        id: attackerUserId,
        username: `atk_${homeRegionId}`,
        email: `atk_${homeRegionId}@local.test`,
        energy: 1000,
        regionId: homeRegionId,
        residenceId: homeRegionId,
        lastEnergyUpdate: Date.now(),
        lastLogin: Date.now(),
      },
      {
        id: targetOwnerUserId,
        username: `def_${attackRegionId}`,
        email: `def_${attackRegionId}@local.test`,
        regionId: attackRegionId,
        residenceId: attackRegionId,
        lastEnergyUpdate: Date.now(),
        lastLogin: Date.now(),
      },
      {
        id: deepManagerUserId,
        username: `mgr_${deepRegionId}`,
        email: `mgr_${deepRegionId}@local.test`,
        gold: 500,
        regionId: deepRegionId,
        residenceId: deepRegionId,
        lastEnergyUpdate: Date.now(),
        lastLogin: Date.now(),
      },
    ])).error
  );

  await mustNoError(
    'insert deep level',
    (await supabase.from('deep_levels').insert({
      level: 42,
      targetCap: 400,
      enabled: true,
      description: 'Atomic deep test',
    })).error
  );

  await mustNoError(
    'insert region resources',
    (await supabase.from('region_resources').insert([
      {
        regionId: deepRegionId,
        resourceType: 'oil',
        dailyAvailable: 500,
        dailyExtracted: 0,
        baseCapPerRecharge: 100,
        dailyMaxCap: 500,
        initialAvailableCap: 100,
        currentAvailableCap: 100,
        totalUnlockedToday: 100,
      },
    ])).error
  );

  await mustNoError(
    'insert deep budget',
    (await supabase.from('budgets').insert({
      ownerType: 'REGION',
      ownerId: deepRegionId,
      moneyEUR: 200000,
      resources: {},
    })).error
  );
}

async function testProvisionConcurrent() {
  const [first, second] = await Promise.all([
    supabase.rpc('rpc_provision_user_atomic', {
      p_user_id: provisionUserId,
      p_email: `prov_${homeRegionId}@local.test`,
      p_username: `prov_${homeRegionId}`,
      p_default_region_id: homeRegionId,
      p_last_energy_update: Date.now(),
      p_last_login: Date.now(),
    }),
    supabase.rpc('rpc_provision_user_atomic', {
      p_user_id: provisionUserId,
      p_email: `prov_${homeRegionId}@local.test`,
      p_username: `prov_${homeRegionId}`,
      p_default_region_id: homeRegionId,
      p_last_energy_update: Date.now(),
      p_last_login: Date.now(),
    }),
  ]);

  await mustNoError('provision rpc #1', first.error);
  await mustNoError('provision rpc #2', second.error);

  const results = [first.data, second.data];
  const createdCount = results.filter((r) => r?.success === true && r?.created === true).length;
  const replayCount = results.filter((r) => r?.success === true && r?.created === false).length;

  assert.equal(createdCount, 1, 'exactly one provision call must create the user');
  assert.equal(replayCount, 1, 'second provision call must reuse the user');

  const inv = await supabase
    .from('user_inventory')
    .select('itemId, quantity')
    .eq('userId', provisionUserId);
  await mustNoError('provision inventory fetch', inv.error);
  assert.equal(inv.data?.length, 4, 'starter inventory must be granted exactly once');
}

async function testTravelConcurrent() {
  const [first, second] = await Promise.all([
    supabase.rpc('rpc_start_travel_atomic', {
      p_user_id: travelerUserId,
      p_target_region_id: travelRegionId,
      p_travel_time_ms: 120000,
    }),
    supabase.rpc('rpc_start_travel_atomic', {
      p_user_id: travelerUserId,
      p_target_region_id: travelRegionId,
      p_travel_time_ms: 120000,
    }),
  ]);

  await mustNoError('travel rpc #1', first.error);
  await mustNoError('travel rpc #2', second.error);

  const results = [first.data, second.data];
  const successCount = results.filter((r) => r?.success === true).length;
  const alreadyTravelingCount = results.filter((r) => r?.success === false && r?.code === 'already_traveling').length;

  assert.equal(successCount, 1, 'exactly one travel call must start the trip');
  assert.equal(alreadyTravelingCount, 1, 'second travel call must observe already_traveling');

  const traveler = await supabase.from('users').select('money, travelingTo').eq('id', travelerUserId).single();
  await mustNoError('traveler fetch', traveler.error);
  assert.equal(traveler.data?.money, 975, 'travel fee must be charged exactly once');
  assert.equal(traveler.data?.travelingTo, travelRegionId, 'travel destination must be set');

  const travelBudget = await supabase
    .from('budgets')
    .select('moneyEUR')
    .eq('ownerType', 'REGION')
    .eq('ownerId', travelRegionId)
    .order('id', { ascending: true })
    .limit(1)
    .single();
  await mustNoError('travel budget fetch', travelBudget.error);
  assert.equal(Number(travelBudget.data?.moneyEUR || 0), 25, 'travel fee must credit treasury exactly once');
}

async function testAttackConcurrent() {
  const [first, second] = await Promise.all([
    supabase.rpc('rpc_attack_action_atomic', {
      p_user_id: attackerUserId,
      p_target_region_id: attackRegionId,
      p_attack_cooldown_ms: 60000,
      p_base_energy_cost: 30,
      p_xp_success: 12,
      p_xp_failure: 6,
    }),
    supabase.rpc('rpc_attack_action_atomic', {
      p_user_id: attackerUserId,
      p_target_region_id: attackRegionId,
      p_attack_cooldown_ms: 60000,
      p_base_energy_cost: 30,
      p_xp_success: 12,
      p_xp_failure: 6,
    }),
  ]);

  await mustNoError('attack rpc #1', first.error);
  await mustNoError('attack rpc #2', second.error);

  const results = [first.data, second.data];
  const processedCount = results.filter((r) => r?.success === true).length;
  const cooldownCount = results.filter((r) => r?.success === false && r?.code === 'cooldown_active').length;

  assert.equal(processedCount, 1, 'exactly one attack call must be processed');
  assert.equal(cooldownCount, 1, 'second attack call must observe cooldown_active');

  const attacker = await supabase.from('users').select('energy').eq('id', attackerUserId).single();
  await mustNoError('attacker fetch', attacker.error);
  assert.equal(Number(attacker.data?.energy || 0), 970, 'attack energy must be deducted exactly once');
}

async function testDeepFailureNoPartialCharge() {
  const budgetBefore = await supabase
    .from('budgets')
    .select('moneyEUR')
    .eq('ownerType', 'REGION')
    .eq('ownerId', deepRegionId)
    .order('id', { ascending: true })
    .limit(1)
    .single();
  await mustNoError('deep budget before', budgetBefore.error);

  const deepResult = await supabase.rpc('rpc_activate_deep_exploration_atomic', {
    p_user_id: deepManagerUserId,
    p_nation_id: nationId,
    p_resource_type: 'oil',
    p_level: 42,
  });
  await mustNoError('deep rpc', deepResult.error);
  assert.equal(deepResult.data?.success, false, 'deep activation should fail without diamonds');
  assert.equal(deepResult.data?.code, 'insufficient_diamonds', 'deep activation should stop before partial deduction');

  const budgetAfter = await supabase
    .from('budgets')
    .select('moneyEUR')
    .eq('ownerType', 'REGION')
    .eq('ownerId', deepRegionId)
    .order('id', { ascending: true })
    .limit(1)
    .single();
  await mustNoError('deep budget after', budgetAfter.error);
  assert.equal(Number(budgetAfter.data?.moneyEUR || 0), Number(budgetBefore.data?.moneyEUR || 0), 'budget must remain unchanged on deep failure');

  const managerAfter = await supabase.from('users').select('gold').eq('id', deepManagerUserId).single();
  await mustNoError('deep manager after', managerAfter.error);
  assert.equal(Number(managerAfter.data?.gold || 0), 500, 'gold must remain unchanged on deep failure');

  const deepRows = await supabase.from('deep_explorations').select('id', { count: 'exact', head: true }).eq('nationId', nationId);
  await mustNoError('deep rows count', deepRows.error);
  assert.equal(deepRows.count, 0, 'failed deep activation must not insert records');
}

async function testRechargeConcurrent() {
  const [first, second] = await Promise.all([
    supabase.rpc('rpc_recharge_resource_atomic', {
      p_user_id: deepManagerUserId,
      p_region_id: deepRegionId,
      p_resource_type: 'oil',
    }),
    supabase.rpc('rpc_recharge_resource_atomic', {
      p_user_id: deepManagerUserId,
      p_region_id: deepRegionId,
      p_resource_type: 'oil',
    }),
  ]);

  await mustNoError('recharge rpc #1', first.error);
  await mustNoError('recharge rpc #2', second.error);

  const results = [first.data, second.data];
  const successCount = results.filter((r) => r?.success === true).length;
  const cooldownCount = results.filter((r) => r?.success === false && r?.code === 'cooldown_active').length;

  assert.equal(successCount, 1, 'exactly one recharge call must succeed');
  assert.equal(cooldownCount, 1, 'second recharge call must observe cooldown_active');

  const resource = await supabase
    .from('region_resources')
    .select('currentAvailableCap, totalUnlockedToday')
    .eq('regionId', deepRegionId)
    .eq('resourceType', 'oil')
    .single();
  await mustNoError('region resource after recharge', resource.error);
  assert.equal(Number(resource.data?.currentAvailableCap || 0), 200, 'resource cap must increase once');
  assert.equal(Number(resource.data?.totalUnlockedToday || 0), 200, 'unlocked total must increase once');
}

async function cleanup() {
  await supabase.from('cooldowns').delete().eq('user_id', attackerUserId).eq('action_type', 'attack');
  await supabase.from('deep_explorations').delete().eq('nationId', nationId);
  await supabase.from('resource_recharges').delete().eq('regionId', deepRegionId);
  await supabase.from('region_resources').delete().in('regionId', [deepRegionId]);
  await supabase.from('budgets').delete().in('ownerId', [deepRegionId, travelRegionId]);
  await supabase.from('deep_levels').delete().eq('level', 42);
  await supabase.from('user_inventory').delete().in('userId', [provisionUserId, deepManagerUserId]);
  await supabase.from('users').delete().in('id', [provisionUserId, travelerUserId, attackerUserId, targetOwnerUserId, deepManagerUserId]);
  await supabase.from('regions').delete().in('id', [homeRegionId, travelRegionId, attackRegionId, deepRegionId]);
  await supabase.from('nations').delete().eq('id', nationId);
}

async function run() {
  try {
    await setup();
    await testProvisionConcurrent();
    await testTravelConcurrent();
    await testAttackConcurrent();
    await testDeepFailureNoPartialCharge();
    await testRechargeConcurrent();
    console.log('security-atomic-actions-integration: OK');
  } finally {
    await cleanup();
  }
}

run().catch((err) => {
  console.error('security-atomic-actions-integration: FAILED');
  console.error(err);
  process.exit(1);
});
