import * as assert from 'node:assert/strict';
import { FactoryEconomyService } from '../backend/services/factory-economy.service';

type FactoryRow = { id: string; ownerUserId: string; budget: number | null } | null;

function createMockRepository(opts?: {
  factory?: FactoryRow;
  deductError?: string | null;
  casOutcomes?: boolean[];
  throwOnCas?: boolean;
  refundOutcomes?: boolean[];
  throwOnGetUserMoney?: boolean;
}) {
  const state = {
    factory: opts?.factory ?? { id: 'f1', ownerUserId: 'u1', budget: 100 },
    deductError: opts?.deductError ?? null,
    casOutcomes: [...(opts?.casOutcomes ?? [true])],
    throwOnCas: !!opts?.throwOnCas,
    refundOutcomes: [...(opts?.refundOutcomes ?? [true])],
    throwOnGetUserMoney: !!opts?.throwOnGetUserMoney,
    userMoney: 500,
    deductCalls: 0,
    refundCalls: 0,
  };

  const repo = {
    async getFactoryBudgetRow(_factoryId: string) {
      return state.factory;
    },
    async deductUserMoney(_userId: string, _amount: number) {
      state.deductCalls += 1;
      return state.deductError;
    },
    async tryUpdateFactoryBudgetWithCAS(_factoryId: string, _expectedBudget: number | null, nextBudget: number) {
      if (state.throwOnCas) throw new Error('cas failed');
      const outcome = state.casOutcomes.length > 0 ? state.casOutcomes.shift()! : false;
      if (outcome && state.factory) {
        state.factory.budget = nextBudget;
      }
      return outcome;
    },
    async getUserMoney(_userId: string) {
      if (state.throwOnGetUserMoney) throw new Error('get user failed');
      return state.userMoney;
    },
    async tryUpdateUserMoneyWithCAS(_userId: string, expectedMoney: number, nextMoney: number) {
      state.refundCalls += 1;
      const outcome = state.refundOutcomes.length > 0 ? state.refundOutcomes.shift()! : false;
      if (outcome && state.userMoney === expectedMoney) {
        state.userMoney = nextMoney;
        return true;
      }
      return false;
    },
    __state: state,
  };

  return repo;
}

async function run() {
  // Happy path
  {
    const repo = createMockRepository();
    const service = new FactoryEconomyService(repo as any);
    const result = await service.depositFactoryBudget('u1', 'f1', 50);
    assert.equal(result.type, 'success');
    assert.equal((result as any).payload.newBudget, 150);
    assert.equal(repo.__state.deductCalls, 1);
  }

  // CAS retry succeeds (concurrency race)
  {
    const repo = createMockRepository({ casOutcomes: [false, false, true] });
    const service = new FactoryEconomyService(repo as any);
    const result = await service.depositFactoryBudget('u1', 'f1', 10);
    assert.equal(result.type, 'success');
    assert.equal((result as any).payload.newBudget, 110);
    assert.equal(repo.__state.refundCalls, 0);
  }

  // Deduct succeeded, credit fails => refund succeeds
  {
    const repo = createMockRepository({ throwOnCas: true, refundOutcomes: [true] });
    const service = new FactoryEconomyService(repo as any);
    const result = await service.depositFactoryBudget('u1', 'f1', 20);
    assert.equal(result.type, 'system_error');
    assert.match((result as any).message, /Errore nel deposito/);
    assert.equal(repo.__state.userMoney, 520);
    assert.equal(repo.__state.refundCalls, 1);
  }

  // Deduct succeeded, credit fails => refund fails
  {
    const repo = createMockRepository({ throwOnCas: true, refundOutcomes: [false, false, false, false, false] });
    const service = new FactoryEconomyService(repo as any);
    const result = await service.depositFactoryBudget('u1', 'f1', 20);
    assert.equal(result.type, 'system_error');
    assert.match((result as any).message, /rollback non confermato/);
  }

  // Invalid amount invariant handled in service
  {
    const repo = createMockRepository();
    const service = new FactoryEconomyService(repo as any);
    const result = await service.depositFactoryBudget('u1', 'f1', 0);
    assert.equal(result.type, 'validation_error');
    assert.equal(repo.__state.deductCalls, 0);
  }

  console.log('factory-deposit-hardening-smoke: OK');
}

run().catch((err) => {
  console.error('factory-deposit-hardening-smoke: FAILED');
  console.error(err);
  process.exit(1);
});
