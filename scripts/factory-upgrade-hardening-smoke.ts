import * as assert from 'node:assert/strict';
import { FactoryUpgradeService } from '../backend/services/factory-upgrade.service';

function createMockRepository(opts?: {
  factory?: any;
  rpcResult?: any;
  rpcError?: any;
  aggregateCosts?: Record<number, number>;
  userGold?: number;
  deductCasOutcomes?: boolean[];
  levelCasOutcomes?: boolean[];
  refundCasOutcomes?: boolean[];
}) {
  const state = {
    factory: opts?.factory ?? { id: 'f1', ownerUserId: 'u1', level: 1 },
    rpcResult: opts?.rpcResult,
    rpcError: opts?.rpcError,
    aggregateCosts: opts?.aggregateCosts ?? { 1: 0, 2: 10 },
    userGold: opts?.userGold ?? 100,
    deductCasOutcomes: [...(opts?.deductCasOutcomes ?? [true])],
    levelCasOutcomes: [...(opts?.levelCasOutcomes ?? [true])],
    refundCasOutcomes: [...(opts?.refundCasOutcomes ?? [true])],
  };

  return {
    async getFactoryById() {
      return state.factory;
    },
    async runUpgradeFactoryRpc() {
      return { data: state.rpcResult, error: state.rpcError };
    },
    async getFactoryAggregateCost(levelTo: number) {
      const cost = state.aggregateCosts[levelTo];
      if (cost == null) return null;
      return { aggregate_cost: cost };
    },
    async getUserGold() {
      return state.userGold;
    },
    async tryUpdateUserGoldWithCAS(_userId: string, expectedGold: number, nextGold: number) {
      const isRefund = nextGold > expectedGold;
      const outcomes = isRefund ? state.refundCasOutcomes : state.deductCasOutcomes;
      const outcome = outcomes.length > 0 ? outcomes.shift()! : false;
      if (outcome && state.userGold === expectedGold) {
        state.userGold = nextGold;
        return true;
      }
      return false;
    },
    async tryUpdateFactoryLevelWithCAS() {
      const outcome = state.levelCasOutcomes.length > 0 ? state.levelCasOutcomes.shift()! : false;
      return outcome;
    },
    __state: state,
  };
}

async function run() {
  // RPC success path
  {
    const repo = createMockRepository({ rpcResult: { levelAfter: 2, goldCost: 10 } });
    const service = new FactoryUpgradeService(repo as any);
    const result = await service.upgradeFactory('u1', 'f1', 2);
    assert.equal(result.type, 'success');
    assert.equal((result as any).payload.newLevel, 2);
  }

  // Fallback insufficient funds
  {
    const repo = createMockRepository({ rpcError: new Error('missing rpc'), userGold: 3, aggregateCosts: { 1: 0, 2: 10 } });
    const service = new FactoryUpgradeService(repo as any);
    const result = await service.upgradeFactory('u1', 'f1', 2);
    assert.equal(result.type, 'validation_error');
    assert.match((result as any).message, /Gold insufficiente/);
  }

  // Fallback fails after deduction, refund succeeds
  {
    const repo = createMockRepository({
      rpcError: new Error('missing rpc'),
      userGold: 50,
      aggregateCosts: { 1: 0, 2: 10 },
      deductCasOutcomes: [true],
      levelCasOutcomes: [false],
      refundCasOutcomes: [true],
    });
    const service = new FactoryUpgradeService(repo as any);
    const result = await service.upgradeFactory('u1', 'f1', 2);
    assert.equal(result.type, 'system_error');
    assert.match((result as any).message, /Errore nell'aggiornamento livello fabbrica/);
    assert.equal(repo.__state.userGold, 50);
  }

  // Concurrent conflict on deduction CAS
  {
    const repo = createMockRepository({
      rpcError: new Error('missing rpc'),
      userGold: 50,
      aggregateCosts: { 1: 0, 2: 10 },
      deductCasOutcomes: [false, false, false, false, false],
    });
    const service = new FactoryUpgradeService(repo as any);
    const result = await service.upgradeFactory('u1', 'f1', 2);
    assert.equal(result.type, 'system_error');
    assert.match((result as any).message, /conflitto concorrente/);
  }

  console.log('factory-upgrade-hardening-smoke: OK');
}

run().catch((err) => {
  console.error('factory-upgrade-hardening-smoke: FAILED');
  console.error(err);
  process.exit(1);
});
