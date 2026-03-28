import * as assert from 'node:assert/strict';
import { FactoryCreateService } from '../backend/services/factory-create.service';

function createMockRepository(opts?: {
  userMoney?: number;
  deductError?: string | null;
  insertError?: any;
  insertFactory?: any;
  refundCasOutcomes?: boolean[];
}) {
  const state = {
    userMoney: opts?.userMoney ?? 10000,
    deductError: opts?.deductError ?? null,
    insertError: opts?.insertError ?? null,
    insertFactory: opts?.insertFactory ?? { id: 'fac-1', name: 'Factory 1' },
    refundCasOutcomes: [...(opts?.refundCasOutcomes ?? [true])],
  };

  return {
    async getUserMoney() {
      return state.userMoney;
    },
    async deductUserMoney(_userId: string, amount: number) {
      if (state.deductError) return state.deductError;
      state.userMoney -= amount;
      return null;
    },
    async insertFactory() {
      if (state.insertError) {
        return { data: null, error: state.insertError };
      }
      return { data: state.insertFactory, error: null };
    },
    async tryUpdateUserMoneyWithCAS(_userId: string, expectedMoney: number, nextMoney: number) {
      const outcome = state.refundCasOutcomes.length > 0 ? state.refundCasOutcomes.shift()! : false;
      if (outcome && state.userMoney === expectedMoney) {
        state.userMoney = nextMoney;
        return true;
      }
      return false;
    },
    __state: state,
  };
}

async function run() {
  // success
  {
    const repo = createMockRepository({ userMoney: 20000 });
    const service = new FactoryCreateService(repo as any);
    const result = await service.createFactory('u1', { name: 'A', type: 'oil', regionId: 'it' });
    assert.equal(result.type, 'success');
  }

  // insufficient funds
  {
    const repo = createMockRepository({ userMoney: 1 });
    const service = new FactoryCreateService(repo as any);
    const result = await service.createFactory('u1', { name: 'A', type: 'oil', regionId: 'it' });
    assert.equal(result.type, 'validation_error');
    assert.match((result as any).message, /Fondi insufficienti/);
  }

  // failure after deduction with refund
  {
    const repo = createMockRepository({
      userMoney: 20000,
      insertError: { message: 'insert failed' },
      refundCasOutcomes: [true],
    });
    const service = new FactoryCreateService(repo as any);
    const before = repo.__state.userMoney;
    const result = await service.createFactory('u1', { name: 'A', type: 'oil', regionId: 'it' });
    assert.equal(result.type, 'system_error');
    assert.equal(repo.__state.userMoney, before);
  }

  // refund failure critical
  {
    const repo = createMockRepository({
      userMoney: 20000,
      insertError: { message: 'insert failed' },
      refundCasOutcomes: [false, false, false, false, false],
    });
    const service = new FactoryCreateService(repo as any);
    const result = await service.createFactory('u1', { name: 'A', type: 'oil', regionId: 'it' });
    assert.equal(result.type, 'system_error');
    assert.match((result as any).message, /rollback non confermato/);
  }

  console.log('factory-create-hardening-smoke: OK');
}

run().catch((err) => {
  console.error('factory-create-hardening-smoke: FAILED');
  console.error(err);
  process.exit(1);
});
