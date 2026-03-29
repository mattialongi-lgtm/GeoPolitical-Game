import { randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';

const supabaseUrl = (process.env.VITE_SUPABASE_URL || '').trim();
const serviceRoleKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
const anonKey = (process.env.VITE_SUPABASE_ANON_KEY || '').trim();
const runFlag = process.env.RUN_DB_RLS_VALIDATION_TESTS === 'true';
const requireRun = process.env.REQUIRE_DB_RLS_VALIDATION === 'true';
const testPassword = (process.env.DB_TEST_USER_PASSWORD || 'ChangeMe!123456').trim();
const runBackendFlowValidation = process.env.RUN_BACKEND_FLOW_VALIDATION === 'true';
const requireBackendFlowValidation = process.env.REQUIRE_BACKEND_FLOW_VALIDATION === 'true';
const backendBaseUrl = (process.env.BACKEND_BASE_URL || 'http://127.0.0.1:3000').trim().replace(/\/$/, '');

if (!runFlag || !supabaseUrl || !serviceRoleKey || !anonKey) {
  const msg = 'security-db-rls-validation: SKIPPED (set RUN_DB_RLS_VALIDATION_TESTS=true + Supabase URL/service-role/anon env vars)';
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
  const msg = 'security-db-rls-validation: SKIPPED (@supabase/supabase-js not installed in this environment)';
  if (requireRun) {
    console.error(msg);
    process.exit(1);
  }
  console.log(msg);
  process.exit(0);
}

const admin = createClient(supabaseUrl, serviceRoleKey);

const suffix = randomUUID().slice(0, 8).toLowerCase();
const alphaSuffix = suffix.replace(/[^a-z]/g, '').padEnd(3, 'x').slice(0, 3).toUpperCase();
const regionId = `R${alphaSuffix}`;
const otherRegionId = `S${alphaSuffix}`;

const users = {
  manager: { id: null, email: `mgr_${suffix}@local.test` },
  applicant: { id: null, email: `app_${suffix}@local.test` },
  resident: { id: null, email: `res_${suffix}@local.test` },
  outsider: { id: null, email: `out_${suffix}@local.test` },
};

let applicationId = null;
let lobbyId = null;
let budgetId = null;
let budgetTxId = null;
const seededFactoryIds = [];

async function mustNoError(step, error) {
  if (error) throw new Error(`${step} failed: ${error.message || JSON.stringify(error)}`);
}

async function createAuthUser(label) {
  const { data, error } = await admin.auth.admin.createUser({
    email: users[label].email,
    password: testPassword,
    email_confirm: true,
  });
  await mustNoError(`auth.createUser(${label})`, error);
  users[label].id = data.user.id;
}

async function signIn(email) {
  const client = createClient(supabaseUrl, anonKey);
  const { error } = await client.auth.signInWithPassword({
    email,
    password: testPassword,
  });
  await mustNoError(`signIn(${email})`, error);
  return client;
}

async function apiRequest(path, token, method = 'GET', body = null) {
  const res = await fetch(`${backendBaseUrl}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  let payload = null;
  try {
    payload = await res.json();
  } catch (_err) {
    payload = null;
  }
  return { res, payload };
}

async function expectRpcDenied(client, fnName, args, label) {
  const { data, error } = await client.rpc(fnName, args);
  assert.ok(error, `${label}: expected rpc ${fnName} to be denied for authenticated role`);
  assert.match(
    String(error.message || ''),
    /(permission denied|execute|not allowed|insufficient privilege)/i,
    `${label}: unexpected rpc error message for ${fnName}: ${error.message}`
  );
  assert.ok(data == null, `${label}: expected null data when rpc ${fnName} is denied`);
}

async function setup() {
  await createAuthUser('manager');
  await createAuthUser('applicant');
  await createAuthUser('resident');
  await createAuthUser('outsider');

  const nowMs = Date.now();
  const commonUserFields = {
    lastEnergyUpdate: nowMs,
    lastLogin: nowMs,
  };

  await mustNoError(
    'users upsert',
    (await admin.from('users').upsert([
      {
        id: users.manager.id,
        username: `mgr_${suffix}`,
        email: users.manager.email,
        regionId,
        residenceId: regionId,
        workPermitId: regionId,
        ...commonUserFields,
      },
      {
        id: users.applicant.id,
        username: `app_${suffix}`,
        email: users.applicant.email,
        ...commonUserFields,
      },
      {
        id: users.resident.id,
        username: `res_${suffix}`,
        email: users.resident.email,
        regionId,
        residenceId: regionId,
        ...commonUserFields,
      },
      {
        id: users.outsider.id,
        username: `out_${suffix}`,
        email: users.outsider.email,
        regionId: otherRegionId,
        residenceId: otherRegionId,
        workPermitId: otherRegionId,
        ...commonUserFields,
      },
    ], { onConflict: 'id' })).error
  );

  await mustNoError(
    'insert managed region',
    (await admin.from('regions').insert({
      id: regionId,
      name: `Region ${suffix}`,
      ownerUserId: users.manager.id,
      leaderUserId: users.manager.id,
      population: 1000,
    })).error
  );

  await mustNoError(
    'insert outsider region',
    (await admin.from('regions').insert({
      id: otherRegionId,
      name: `Other ${suffix}`,
      ownerUserId: users.outsider.id,
      leaderUserId: users.outsider.id,
      population: 999,
    })).error
  );

  const appRes = await admin.from('applications').insert({
    id: randomUUID(),
    userId: users.applicant.id,
    username: `app_${suffix}`,
    regionId,
    type: 'work_permit',
    status: 'pending',
    createdAt: new Date().toISOString(),
  }).select('id').single();
  await mustNoError('insert application', appRes.error);
  applicationId = appRes.data.id;

  const lobbyRes = await admin.from('revolution_lobbies').insert({
    regionId,
    lobbyType: 'revolution',
    creatorId: users.manager.id,
    participantIds: [users.resident.id],
    requiredPlayers: 2,
    status: 'pending',
    goldCostPerPlayer: 0,
    createdAt: new Date(Date.now() - 60_000).toISOString(),
    updatedAt: new Date(Date.now() - 60_000).toISOString(),
    expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
  }).select('id').single();
  await mustNoError('insert lobby', lobbyRes.error);
  lobbyId = lobbyRes.data.id;
}

async function validateScopedReads() {
  const managerClient = await signIn(users.manager.email);
  const applicantClient = await signIn(users.applicant.email);
  const residentClient = await signIn(users.resident.email);
  const outsiderClient = await signIn(users.outsider.email);

  const mgrApps = await managerClient
    .from('applications')
    .select('id,regionId,userId')
    .eq('id', applicationId);
  await mustNoError('manager applications read', mgrApps.error);
  assert.equal(mgrApps.data?.length, 1, 'manager should read in-scope applications row');

  const appApps = await applicantClient
    .from('applications')
    .select('id,regionId,userId')
    .eq('id', applicationId);
  await mustNoError('applicant applications read', appApps.error);
  assert.equal(appApps.data?.length, 1, 'applicant should read own applications row');

  const outApps = await outsiderClient
    .from('applications')
    .select('id,regionId,userId')
    .eq('id', applicationId);
  await mustNoError('outsider applications read', outApps.error);
  assert.equal(outApps.data?.length, 0, 'outsider must not read out-of-scope applications row');

  const residentLobby = await residentClient
    .from('revolution_lobbies')
    .select('id,regionId,participantIds')
    .eq('id', lobbyId);
  await mustNoError('resident lobby read', residentLobby.error);
  assert.equal(residentLobby.data?.length, 1, 'resident in region should read in-scope lobby row');

  const outsiderLobby = await outsiderClient
    .from('revolution_lobbies')
    .select('id,regionId,participantIds')
    .eq('id', lobbyId);
  await mustNoError('outsider lobby read', outsiderLobby.error);
  assert.equal(outsiderLobby.data?.length, 0, 'outsider must not read out-of-scope lobby row');

  await expectRpcDenied(applicantClient, 'create_application_atomic', {
    p_user_id: users.applicant.id,
    p_username: `app_${suffix}`,
    p_region_id: regionId,
    p_type: 'work_permit',
  }, 'authenticated create_application_atomic');

  await expectRpcDenied(managerClient, 'resolve_application_atomic', {
    p_application_id: String(applicationId),
    p_action: 'accept',
    p_actor_user_id: users.manager.id,
  }, 'authenticated resolve_application_atomic');

  await expectRpcDenied(managerClient, 'expire_revolution_lobby_atomic', {
    p_lobby_id: lobbyId,
    p_actor_user_id: users.manager.id,
  }, 'authenticated expire_revolution_lobby_atomic');

  await Promise.all([
    managerClient.auth.signOut(),
    applicantClient.auth.signOut(),
    residentClient.auth.signOut(),
    outsiderClient.auth.signOut(),
  ]);
}

async function validateBackendOfficialFlows() {
  if (!runBackendFlowValidation) {
    if (requireBackendFlowValidation) {
      throw new Error('backend flow validation required but RUN_BACKEND_FLOW_VALIDATION is false');
    }
    console.log('security-db-rls-validation: backend flow checks skipped (set RUN_BACKEND_FLOW_VALIDATION=true)');
    return;
  }

  const managerClient = await signIn(users.manager.email);
  const applicantClient = await signIn(users.applicant.email);
  const residentClient = await signIn(users.resident.email);
  const outsiderClient = await signIn(users.outsider.email);

  const [{ data: mgrSession }, { data: appSession }, { data: residentSession }, { data: outsiderSession }] = await Promise.all([
    managerClient.auth.getSession(),
    applicantClient.auth.getSession(),
    residentClient.auth.getSession(),
    outsiderClient.auth.getSession(),
  ]);

  const managerToken = mgrSession.session?.access_token;
  const applicantToken = appSession.session?.access_token;
  const residentToken = residentSession.session?.access_token;
  const outsiderToken = outsiderSession.session?.access_token;
  assert.ok(managerToken, 'manager session token missing');
  assert.ok(applicantToken, 'applicant session token missing');
  assert.ok(residentToken, 'resident session token missing');
  assert.ok(outsiderToken, 'outsider session token missing');

  // 1) apply
  const applyRes = await apiRequest('/api/actions/apply', applicantToken, 'POST', {
    regionId,
    type: 'residence',
  });
  assert.equal(applyRes.res.status, 200, `apply endpoint expected 200, got ${applyRes.res.status} (${JSON.stringify(applyRes.payload)})`);
  assert.equal(Boolean(applyRes.payload?.success), true, 'apply endpoint must return success=true');
  const backendApplicationId = String(applyRes.payload?.applicationId || '');
  assert.ok(backendApplicationId, 'apply endpoint missing applicationId');

  // 2) get applications (manager can read)
  const managerAppsRes = await apiRequest(`/api/applications/${regionId}`, managerToken, 'GET');
  assert.equal(managerAppsRes.res.status, 200, `manager GET /api/applications expected 200, got ${managerAppsRes.res.status}`);
  assert.ok(Array.isArray(managerAppsRes.payload), 'manager applications payload must be array');

  // 3) resolve
  const resolveRes = await apiRequest('/api/actions/resolve-application', managerToken, 'POST', {
    applicationId: backendApplicationId,
    action: 'accept',
  });
  assert.equal(resolveRes.res.status, 200, `resolve endpoint expected 200, got ${resolveRes.res.status} (${JSON.stringify(resolveRes.payload)})`);
  assert.equal(Boolean(resolveRes.payload?.success), true, 'resolve endpoint must return success=true');

  // 4) get lobbies (in-scope resident can read)
  const lobbiesRes = await apiRequest(`/api/lobbies/${regionId}`, residentToken, 'GET');
  assert.equal(lobbiesRes.res.status, 200, `resident GET /api/lobbies expected 200, got ${lobbiesRes.res.status}`);
  assert.ok(Array.isArray(lobbiesRes.payload?.lobbies), 'lobbies payload must contain lobbies array');

  // 5) expire lobby
  const expiredLobbyInsert = await admin.from('revolution_lobbies').insert({
    regionId,
    lobbyType: 'revolution',
    creatorId: users.manager.id,
    participantIds: [users.resident.id],
    requiredPlayers: 2,
    status: 'pending',
    goldCostPerPlayer: 0,
    createdAt: new Date(Date.now() - 86_400_000).toISOString(),
    updatedAt: new Date(Date.now() - 86_400_000).toISOString(),
    expiresAt: new Date(Date.now() - 60_000).toISOString(),
  }).select('id').single();
  await mustNoError('insert expired lobby for endpoint expire', expiredLobbyInsert.error);
  const endpointLobbyId = expiredLobbyInsert.data.id;

  const expireRes = await apiRequest(`/api/lobbies/${endpointLobbyId}/expire`, managerToken, 'POST');
  assert.equal(expireRes.res.status, 200, `expire endpoint expected 200, got ${expireRes.res.status} (${JSON.stringify(expireRes.payload)})`);
  assert.equal(Boolean(expireRes.payload?.success), true, 'expire endpoint must return success=true');

  // 6) budget history (owner authorized) + unauthorized access denied
  const budgetInsert = await admin.from('budgets').insert({
    ownerType: 'REGION',
    ownerId: regionId,
    moneyEUR: 10_000,
    resources: {},
    updatedAt: Date.now(),
  }).select('id').single();
  await mustNoError('insert region budget', budgetInsert.error);
  budgetId = budgetInsert.data.id;

  budgetTxId = randomUUID().replace(/-/g, '').slice(0, 12);
  const txInsert = await admin.from('budget_transactions').insert({
    id: budgetTxId,
    budgetId,
    type: 'INCOME',
    subtype: 'TEST_SEED',
    moneyDelta: 250,
    resourcesDelta: {},
    createdAt: Date.now(),
    createdByUserId: users.manager.id,
    metadata: { source: 'security-db-rls-validation' },
  });
  await mustNoError('insert budget transaction', txInsert.error);

  const ownerBudgetRes = await apiRequest(`/api/budget/REGION/${regionId}`, managerToken, 'GET');
  assert.equal(ownerBudgetRes.res.status, 200, `owner GET /api/budget expected 200, got ${ownerBudgetRes.res.status} (${JSON.stringify(ownerBudgetRes.payload)})`);
  assert.equal(ownerBudgetRes.payload?.budget?.id, budgetId, 'owner GET /api/budget must return seeded budget');
  assert.ok(Array.isArray(ownerBudgetRes.payload?.transactions), 'owner budget payload must include transactions array');
  assert.ok(ownerBudgetRes.payload.transactions.some((t) => t.id === budgetTxId), 'owner budget payload must include seeded transaction');

  const outsiderBudgetRes = await apiRequest(`/api/budget/REGION/${regionId}`, outsiderToken, 'GET');
  assert.equal(outsiderBudgetRes.res.status, 403, `outsider GET /api/budget expected 403, got ${outsiderBudgetRes.res.status} (${JSON.stringify(outsiderBudgetRes.payload)})`);

  // 7) factories payload cooldown projection is scoped to requesting user
  const factoryAId = randomUUID();
  const factoryBId = randomUUID();
  const factoriesInsert = await admin.from('factories').insert([
    {
      id: factoryAId,
      name: `Factory A ${suffix}`,
      type: 'oil',
      regionId,
      ownerUserId: users.manager.id,
      cooldownSec: 600,
    },
    {
      id: factoryBId,
      name: `Factory B ${suffix}`,
      type: 'minerals',
      regionId,
      ownerUserId: users.outsider.id,
      cooldownSec: 600,
    },
  ]);
  await mustNoError('insert factories for cooldown projection test', factoriesInsert.error);
  seededFactoryIds.push(factoryAId, factoryBId);

  const cooldownSeed = await admin.from('user_factory_cooldowns').upsert([
    { userId: users.manager.id, factoryId: factoryAId, lastUsed: new Date().toISOString() },
    { userId: users.outsider.id, factoryId: factoryBId, lastUsed: new Date().toISOString() },
  ], { onConflict: 'userId,factoryId' });
  await mustNoError('seed user_factory_cooldowns for projection test', cooldownSeed.error);

  const managerFactoriesRes = await apiRequest(`/api/factories?regionId=${regionId}`, managerToken, 'GET');
  assert.equal(managerFactoriesRes.res.status, 200, `manager GET /api/factories expected 200, got ${managerFactoriesRes.res.status} (${JSON.stringify(managerFactoriesRes.payload)})`);
  assert.ok(Array.isArray(managerFactoriesRes.payload), 'manager factories payload must be an array');

  const managerFactoryA = managerFactoriesRes.payload.find((f) => f.id === factoryAId);
  const managerFactoryB = managerFactoriesRes.payload.find((f) => f.id === factoryBId);
  assert.ok(managerFactoryA, 'manager factories payload must contain factory A');
  assert.ok(managerFactoryB, 'manager factories payload must contain factory B');
  assert.ok(Number(managerFactoryA.remainingCooldown) > 0, 'manager must see cooldown on own seeded row');
  assert.equal(Number(managerFactoryB.remainingCooldown), 0, 'manager must not inherit outsider cooldown row');

  const outsiderFactoriesRes = await apiRequest(`/api/factories?regionId=${regionId}`, outsiderToken, 'GET');
  assert.equal(outsiderFactoriesRes.res.status, 200, `outsider GET /api/factories expected 200, got ${outsiderFactoriesRes.res.status} (${JSON.stringify(outsiderFactoriesRes.payload)})`);
  assert.ok(Array.isArray(outsiderFactoriesRes.payload), 'outsider factories payload must be an array');

  const outsiderFactoryA = outsiderFactoriesRes.payload.find((f) => f.id === factoryAId);
  const outsiderFactoryB = outsiderFactoriesRes.payload.find((f) => f.id === factoryBId);
  assert.ok(outsiderFactoryA, 'outsider factories payload must contain factory A');
  assert.ok(outsiderFactoryB, 'outsider factories payload must contain factory B');
  assert.equal(Number(outsiderFactoryA.remainingCooldown), 0, 'outsider must not inherit manager cooldown row');
  assert.ok(Number(outsiderFactoryB.remainingCooldown) > 0, 'outsider must see cooldown on own seeded row');

  await admin.from('user_factory_cooldowns').delete().in('factoryId', [factoryAId, factoryBId]);
  await admin.from('factories').delete().in('id', [factoryAId, factoryBId]);
  seededFactoryIds.length = 0;

  // 8) work flow write-path: /api/work must create/update user_factory_cooldowns keyed by (userId, factoryId)
  const workFactoryId = randomUUID();
  const workFactoryInsert = await admin.from('factories').insert({
    id: workFactoryId,
    name: `Work Factory ${suffix}`,
    type: 'oil',
    regionId,
    ownerUserId: users.manager.id,
    payMode: 'salary',
    budget: 10_000,
    wage: 50,
    level: 1,
    cooldownSec: 600,
  });
  await mustNoError('insert factory for /api/work cooldown write test', workFactoryInsert.error);
  seededFactoryIds.push(workFactoryId);

  const managerPrep = await admin.from('users').update({
    regionId,
    residenceId: regionId,
    energy: 100,
    money: 1_000,
  }).eq('id', users.manager.id);
  await mustNoError('prepare manager state for /api/work', managerPrep.error);

  const workRes = await apiRequest('/api/work', managerToken, 'POST', { factoryId: workFactoryId });
  assert.equal(workRes.res.status, 200, `POST /api/work expected 200, got ${workRes.res.status} (${JSON.stringify(workRes.payload)})`);
  assert.equal(Boolean(workRes.payload?.success), true, 'POST /api/work must return success=true');

  const cooldownAfterWork = await admin.from('user_factory_cooldowns')
    .select('userId,factoryId,lastUsed')
    .eq('userId', users.manager.id)
    .eq('factoryId', workFactoryId)
    .maybeSingle();
  await mustNoError('read cooldown written by /api/work', cooldownAfterWork.error);
  assert.ok(cooldownAfterWork.data, 'POST /api/work must create/update cooldown row');
  assert.equal(cooldownAfterWork.data.userId, users.manager.id, 'cooldown row must be keyed by worker userId');
  assert.equal(cooldownAfterWork.data.factoryId, workFactoryId, 'cooldown row must be keyed by target factoryId');

  const workCooldownRes = await apiRequest('/api/work', managerToken, 'POST', { factoryId: workFactoryId });
  assert.equal(
    workCooldownRes.res.status,
    400,
    `Second POST /api/work expected 400 due to cooldown, got ${workCooldownRes.res.status} (${JSON.stringify(workCooldownRes.payload)})`
  );
  assert.notEqual(
    Boolean(workCooldownRes.payload?.success),
    true,
    'Second POST /api/work must not return success=true while cooldown is active'
  );
  assert.match(
    JSON.stringify(workCooldownRes.payload ?? {}),
    /cooldown/i,
    'Second POST /api/work must expose a cooldown-related error payload'
  );

  await admin.from('user_factory_cooldowns').delete().eq('userId', users.manager.id).eq('factoryId', workFactoryId);
  await admin.from('factories').delete().eq('id', workFactoryId);
  seededFactoryIds.pop();

  await admin.from('budget_transactions').delete().eq('id', budgetTxId);
  budgetTxId = null;
  await admin.from('budgets').delete().eq('id', budgetId);
  budgetId = null;

  await admin.from('revolution_lobbies').delete().eq('id', endpointLobbyId);
  await admin.from('applications').delete().eq('id', backendApplicationId);

  await Promise.all([
    managerClient.auth.signOut(),
    applicantClient.auth.signOut(),
    residentClient.auth.signOut(),
    outsiderClient.auth.signOut(),
  ]);
}

async function cleanup() {
  if (seededFactoryIds.length > 0) {
    await admin.from('user_factory_cooldowns').delete().in('factoryId', seededFactoryIds);
    await admin.from('factories').delete().in('id', seededFactoryIds);
    seededFactoryIds.length = 0;
  }
  if (budgetTxId) await admin.from('budget_transactions').delete().eq('id', budgetTxId);
  if (budgetId) await admin.from('budgets').delete().eq('id', budgetId);
  if (lobbyId) await admin.from('revolution_lobbies').delete().eq('id', lobbyId);
  if (applicationId) await admin.from('applications').delete().eq('id', applicationId);

  await admin.from('applications').delete().in('userId', Object.values(users).map((u) => u.id).filter(Boolean));
  await admin.from('regions').delete().in('id', [regionId, otherRegionId]);
  await admin.from('users').delete().in('id', Object.values(users).map((u) => u.id).filter(Boolean));

  for (const u of Object.values(users)) {
    if (!u.id) continue;
    await admin.auth.admin.deleteUser(u.id);
  }
}

async function run() {
  try {
    await setup();
    await validateScopedReads();
    await validateBackendOfficialFlows();
    console.log('security-db-rls-validation: OK');
  } finally {
    await cleanup();
  }
}

run().catch((err) => {
  console.error('security-db-rls-validation: FAILED');
  console.error(err);
  process.exit(1);
});
