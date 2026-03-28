import * as assert from 'node:assert/strict';
import { WarController } from '../backend/controllers/war.controller';
import {
  isDailyBonusClaimSuccess,
  isDailyMissionClaimSuccess,
  isWarStatsResponse,
  isWarsListResponse,
} from '../backend/observability/contract-guards';

function createMockRes() {
  return {
    statusCode: 200,
    body: undefined as any,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: any) {
      this.body = payload;
      return this;
    },
  };
}

async function run() {
  // Guard sanity checks
  assert.equal(isWarsListResponse({ active: [], ended: [] }), true);
  assert.equal(isWarStatsResponse({ war: { id: 'w1' }, stats: { attacker: [], defender: [] } }), true);
  assert.equal(isDailyMissionClaimSuccess({ success: true, mission_key: 'work_times', reward: {} }), true);
  assert.equal(isDailyBonusClaimSuccess({ success: true, reward: {} }), true);

  // War controller contract/status checks
  const warServiceOk = {
    listWars: async () => ({ active: [], ended: [] }),
    getWarStats: async () => ({ war: { id: 'w1' }, stats: { attacker: [], defender: [] } }),
  } as any;

  const controllerOk = new WarController(warServiceOk);

  const resList = createMockRes();
  await controllerOk.listWars({} as any, resList as any);
  assert.equal(resList.statusCode, 200);
  assert.equal(isWarsListResponse(resList.body), true);

  const resStats = createMockRes();
  await controllerOk.getWarStats({ params: { id: 'w1' } } as any, resStats as any);
  assert.equal(resStats.statusCode, 200);
  assert.equal(isWarStatsResponse(resStats.body), true);

  const warService404 = {
    listWars: async () => ({ active: [], ended: [] }),
    getWarStats: async () => {
      const err: any = new Error('not found');
      err.statusCode = 404;
      throw err;
    },
  } as any;

  const controller404 = new WarController(warService404);
  const res404 = createMockRes();
  await controller404.getWarStats({ params: { id: 'missing' } } as any, res404 as any);
  assert.equal(res404.statusCode, 404);
  assert.equal(typeof res404.body?.error, 'string');

  const warService500 = {
    listWars: async () => {
      throw new Error('boom');
    },
    getWarStats: async () => {
      throw new Error('boom');
    },
  } as any;

  const controller500 = new WarController(warService500);
  const resList500 = createMockRes();
  await controller500.listWars({} as any, resList500 as any);
  assert.equal(resList500.statusCode, 500);

  const resStats500 = createMockRes();
  await controller500.getWarStats({ params: { id: 'w1' } } as any, resStats500 as any);
  assert.equal(resStats500.statusCode, 500);

  console.log('hardening-contract-smoke: OK');
}

run().catch((err) => {
  console.error('hardening-contract-smoke: FAILED');
  console.error(err);
  process.exit(1);
});
