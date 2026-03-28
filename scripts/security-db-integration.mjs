import { randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';

const supabaseUrl = (process.env.VITE_SUPABASE_URL || '').trim();
const serviceRoleKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
const runFlag = process.env.RUN_DB_INTEGRATION_TESTS === 'true';
const requireRun = process.env.REQUIRE_DB_INTEGRATION === 'true';

if (!runFlag || !supabaseUrl || !serviceRoleKey) {
  const msg = 'security-db-integration: SKIPPED (set RUN_DB_INTEGRATION_TESTS=true + Supabase env vars)';
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
  const msg = 'security-db-integration: SKIPPED (@supabase/supabase-js not installed in this environment)';
  if (requireRun) {
    console.error(msg);
    process.exit(1);
  }
  console.log(msg);
  process.exit(0);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

const suffix = randomUUID().slice(0, 8).toUpperCase();
const managerId = randomUUID();
const applicantId = randomUUID();
const regionId = `T${suffix.slice(0, 3)}`; // 4 chars, matches /^[A-Z]{2,4}$/
const appType = 'work_permit';
let createdApplicationId = null;
let createdLobbyId = null;

async function mustNoError(step, error) {
  if (error) {
    throw new Error(`${step} failed: ${error.message || JSON.stringify(error)}`);
  }
}

async function setup() {
  await mustNoError(
    'insert manager',
    (await supabase.from('users').insert({
      id: managerId,
      username: `mgr_${suffix}`,
      email: `mgr_${suffix}@local.test`,
      residenceId: regionId,
      regionId,
      lastEnergyUpdate: Date.now(),
      lastLogin: Date.now(),
    })).error
  );

  await mustNoError(
    'insert applicant',
    (await supabase.from('users').insert({
      id: applicantId,
      username: `usr_${suffix}`,
      email: `usr_${suffix}@local.test`,
      lastEnergyUpdate: Date.now(),
      lastLogin: Date.now(),
    })).error
  );

  await mustNoError(
    'insert region',
    (await supabase.from('regions').insert({
      id: regionId,
      name: `Region ${suffix}`,
      ownerUserId: managerId,
      leaderUserId: managerId,
      population: 1000,
    })).error
  );
}

async function testApplyConcurrent() {
  const req = {
    p_user_id: applicantId,
    p_username: `usr_${suffix}`,
    p_region_id: regionId,
    p_type: appType,
  };

  const [r1, r2] = await Promise.all([
    supabase.rpc('create_application_atomic', req),
    supabase.rpc('create_application_atomic', req),
  ]);

  await mustNoError('apply rpc #1 transport', r1.error);
  await mustNoError('apply rpc #2 transport', r2.error);

  const results = [r1.data, r2.data];
  const successCount = results.filter((r) => r?.success === true && r?.status === 'pending').length;
  const duplicateCount = results.filter((r) => r?.success === false && r?.code === 'duplicate_pending').length;

  assert.equal(successCount, 1, 'exactly one concurrent apply call must create pending application');
  assert.equal(duplicateCount, 1, 'second concurrent apply call must return duplicate_pending');

  const appCreated = results.find((r) => r?.success === true);
  createdApplicationId = appCreated?.applicationId || null;
  assert.ok(createdApplicationId, 'created application id missing');

  const pendingCountRes = await supabase
    .from('applications')
    .select('id', { count: 'exact', head: true })
    .eq('userId', applicantId)
    .eq('regionId', regionId)
    .eq('type', appType)
    .eq('status', 'pending');
  await mustNoError('pending count query', pendingCountRes.error);
  assert.equal(pendingCountRes.count, 1, 'DB must contain max one pending row');
}

async function testResolveIdempotency() {
  const first = await supabase.rpc('resolve_application_atomic', {
    p_application_id: createdApplicationId,
    p_action: 'accept',
    p_actor_user_id: managerId,
  });
  await mustNoError('resolve rpc #1 transport', first.error);
  assert.equal(first.data?.success, true, 'first resolve should succeed');
  assert.equal(Boolean(first.data?.idempotent), false, 'first resolve must not be idempotent');
  assert.equal(first.data?.status, 'accepted', 'first resolve should accept');

  const second = await supabase.rpc('resolve_application_atomic', {
    p_application_id: createdApplicationId,
    p_action: 'accept',
    p_actor_user_id: managerId,
  });
  await mustNoError('resolve rpc #2 transport', second.error);
  assert.equal(second.data?.success, true, 'second resolve replay should succeed');
  assert.equal(Boolean(second.data?.idempotent), true, 'second resolve replay must be idempotent');

  const applicant = await supabase.from('users').select('workPermitId').eq('id', applicantId).single();
  await mustNoError('applicant fetch after resolve', applicant.error);
  assert.equal(applicant.data?.workPermitId, regionId, 'applicant work permit must be set exactly once');
}

async function testExpireLobbyNoDoubleRefund() {
  const goldBeforeRes = await supabase.from('users').select('gold').eq('id', applicantId).single();
  await mustNoError('gold before fetch', goldBeforeRes.error);
  const goldBefore = Number(goldBeforeRes.data?.gold || 0);

  const lobbyInsert = await supabase.from('revolution_lobbies').insert({
    regionId,
    lobbyType: 'revolution',
    creatorId: managerId,
    participantIds: [applicantId],
    requiredPlayers: 2,
    status: 'pending',
    goldCostPerPlayer: 7,
    createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    expiresAt: new Date(Date.now() - 60 * 1000).toISOString(),
  }).select('id').single();
  await mustNoError('insert expired lobby', lobbyInsert.error);
  createdLobbyId = lobbyInsert.data?.id || null;
  assert.ok(createdLobbyId, 'created lobby id missing');

  const first = await supabase.rpc('expire_revolution_lobby_atomic', {
    p_lobby_id: createdLobbyId,
    p_actor_user_id: managerId,
  });
  await mustNoError('expire rpc #1 transport', first.error);
  assert.equal(first.data?.success, true, 'first expire should succeed');
  assert.equal(Boolean(first.data?.idempotent), false, 'first expire must not be idempotent');

  const second = await supabase.rpc('expire_revolution_lobby_atomic', {
    p_lobby_id: createdLobbyId,
    p_actor_user_id: managerId,
  });
  await mustNoError('expire rpc #2 transport', second.error);
  assert.equal(second.data?.success, true, 'second expire should succeed');
  assert.equal(Boolean(second.data?.idempotent), true, 'second expire must be idempotent');

  const goldAfterRes = await supabase.from('users').select('gold').eq('id', applicantId).single();
  await mustNoError('gold after fetch', goldAfterRes.error);
  const goldAfter = Number(goldAfterRes.data?.gold || 0);
  assert.equal(goldAfter - goldBefore, 7, 'refund must be applied exactly once');
}

async function cleanup() {
  // Best-effort cleanup; order avoids FK issues
  if (createdLobbyId) await supabase.from('revolution_lobbies').delete().eq('id', createdLobbyId);
  if (createdApplicationId) await supabase.from('applications').delete().eq('id', createdApplicationId);
  await supabase.from('applications').delete().eq('userId', applicantId).eq('regionId', regionId);
  await supabase.from('regions').delete().eq('id', regionId);
  await supabase.from('users').delete().in('id', [managerId, applicantId]);
}

async function run() {
  try {
    await setup();
    await testApplyConcurrent();
    await testResolveIdempotency();
    await testExpireLobbyNoDoubleRefund();
    console.log('security-db-integration: OK');
  } finally {
    await cleanup();
  }
}

run().catch((err) => {
  console.error('security-db-integration: FAILED');
  console.error(err);
  process.exit(1);
});
