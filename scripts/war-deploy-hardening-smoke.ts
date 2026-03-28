import * as assert from 'node:assert/strict';
import { executeWarDeployUseCase } from '../backend/services/war-deploy.usecase';

function createDeps(overrides?: Partial<any>) {
  return {
    validateTroopDeployment: () => ({ valid: true, energyCost: 10, moneyCost: 50 }),
    getUserPerks: async () => ({}),
    getMaxDeployableTroops: () => 100,
    getRegionBuildings: async () => ({}),
    calculateRegionalIndices: () => ({ militaryIndex: 1 }),
    calculateDamage: () => ({ baseDamage: 100, finalDamage: 130 }),
    addXP: async () => undefined,
    updateMissionProgress: async () => undefined,
    troopEnergyCostByType: { tank: 10 },
    xpPerAttack: 12,
    ...overrides,
  };
}

function createWarRepo(overrides?: Partial<any>) {
  const state = {
    rpcCalls: 0,
    fallbackWrites: 0,
    ...overrides,
  } as any;

  return {
    async getWarById() {
      return { id: 'w1', status: 'active', warType: 'land', navalPhase: 0, attackerRegionId: null, defenderRegionId: null, attackerCountryIso2: 'IT', defenderCountryIso2: 'FR', distancePenalty: 0, attackerScore: 0 };
    },
    async getWarDepartmentBonus() { return null; },
    async getRegionNationId() { return { nation_id: 'IT' }; },
    async runWarDeployRpc() {
      state.rpcCalls += 1;
      if (state.rpcError) return { data: null, error: { message: 'rpc fail' } };
      return { data: state.rpcData ?? { success: true }, error: null };
    },
    async updateUserEnergyAndMoney() { state.fallbackWrites += 1; if (state.failOnFallback === 'wallet') throw new Error('wallet fail'); },
    async updateWarScore() { state.fallbackWrites += 1; if (state.failOnFallback === 'score') throw new Error('score fail'); },
    async insertWarDeployment() { state.fallbackWrites += 1; },
    async getWarParticipantByWarAndUser() { return null; },
    async insertWarParticipant() { state.fallbackWrites += 1; },
    async updateWarParticipantById() { state.fallbackWrites += 1; },
    async insertActionLog() { state.fallbackWrites += 1; },
    __state: state,
  } as any;
}

async function run() {
  {
    const repo = createWarRepo();
    const result = await executeWarDeployUseCase(repo, createDeps(), {
      user: { id: 'u1', energy: 100, money: 1000, level: 2, isPremium: false, username: 'alice', regionId: 'r1' },
      warId: 'w1',
      side: 'attacker',
      troopType: 'tank' as any,
      quantity: 3,
    });
    assert.equal(result.type, 'success');
    assert.equal(repo.__state.rpcCalls, 1);
    assert.equal(repo.__state.fallbackWrites, 0);
  }

  {
    const repo = createWarRepo({ rpcData: { error: 'Energia insufficiente.' } });
    const result = await executeWarDeployUseCase(repo, createDeps(), {
      user: { id: 'u1', energy: 100, money: 1000, level: 2, isPremium: false, username: 'alice', regionId: 'r1' },
      warId: 'w1',
      side: 'attacker',
      troopType: 'tank' as any,
      quantity: 3,
    });
    assert.equal(result.type, 'validation_error');
    assert.match((result as any).message, /Energia insufficiente/);
  }

  {
    const repo = createWarRepo();
    const deps = createDeps({ validateTroopDeployment: () => ({ valid: false, energyCost: 0, moneyCost: 0, error: 'Fondi insufficienti.' }) });
    const result = await executeWarDeployUseCase(repo, deps, {
      user: { id: 'u1', energy: 1, money: 0, level: 2, isPremium: false, username: 'alice', regionId: 'r1' },
      warId: 'w1',
      side: 'attacker',
      troopType: 'tank' as any,
      quantity: 3,
    });
    assert.equal(result.type, 'validation_error');
    assert.equal(repo.__state.rpcCalls, 0);
  }

  {
    const repo = createWarRepo({ rpcError: true, failOnFallback: 'score' });
    await assert.rejects(
      () => executeWarDeployUseCase(repo, createDeps(), {
        user: { id: 'u1', energy: 100, money: 1000, level: 2, isPremium: false, username: 'alice', regionId: 'r1' },
        warId: 'w1',
        side: 'attacker',
        troopType: 'tank' as any,
        quantity: 3,
      }),
      /score fail/,
    );
    assert.ok(repo.__state.fallbackWrites >= 2);
  }

  console.log('war-deploy-hardening-smoke: OK');
}

run().catch((err) => {
  console.error('war-deploy-hardening-smoke: FAILED');
  console.error(err);
  process.exit(1);
});
