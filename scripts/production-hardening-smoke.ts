import * as assert from 'node:assert/strict';
import { ProductionService } from '../backend/services/production.service';

function createMockRepository(opts?: {
  money?: number;
  inventory?: Record<string, number>;
  deductError?: string | null;
  queueInsertFails?: boolean;
  queueDeleteFails?: boolean;
  resourceDeductFailures?: Record<string, boolean[]>;
  moneyCasOutcomes?: boolean[];
}) {
  const state = {
    money: opts?.money ?? 10000,
    inventory: { oil: 100, minerals: 200, uranium: 20, diamonds: 10, ...(opts?.inventory || {}) },
    deductError: opts?.deductError ?? null,
    queueInsertFails: opts?.queueInsertFails ?? false,
    queueDeleteFails: opts?.queueDeleteFails ?? false,
    resourceDeductFailures: opts?.resourceDeductFailures ?? {},
    moneyCasOutcomes: [...(opts?.moneyCasOutcomes ?? [true])],
    queueInserted: false,
    queueDeleted: false,
  };

  return {
    async getUserMoney() { return state.money; },
    async tryUpdateUserMoneyCAS(_userId: string, expected: number, next: number) {
      const outcome = state.moneyCasOutcomes.length ? state.moneyCasOutcomes.shift()! : true;
      if (!outcome) return false;
      if (state.money !== expected) return false;
      state.money = next;
      return true;
    },
    async getUserInventory() {
      return Object.entries(state.inventory).map(([itemId, quantity]) => ({ itemId, quantity }));
    },
    async getInventoryQuantity(_userId: string, itemId: string) {
      const v = state.inventory[itemId];
      return v == null ? null : v;
    },
    async tryUpdateInventoryQuantityCAS(_userId: string, itemId: string, expected: number, next: number) {
      const failures = state.resourceDeductFailures[itemId] || [];
      if (next < expected && failures.length > 0) {
        const fail = failures.shift()!;
        if (fail) return false;
      }
      if ((state.inventory[itemId] ?? null) !== expected) return false;
      state.inventory[itemId] = next;
      return true;
    },
    async getLastQueueItem() { return null; },
    async deductMoney(_userId: string, amount: number) {
      if (state.deductError) return state.deductError;
      state.money -= amount;
      return null;
    },
    async insertQueue() {
      if (state.queueInsertFails) throw new Error('queue fail');
      state.queueInserted = true;
    },
    async deleteQueueItem() {
      if (state.queueDeleteFails) throw new Error('queue delete fail');
      state.queueDeleted = true;
    },
    async cleanupZeroInventory() { return; },
    __state: state,
  };
}

async function run() {
  {
    const repo = createMockRepository();
    const service = new ProductionService(repo as any);
    const result = await service.produce({
      userId: 'u1',
      weaponType: 'rifle',
      qty: 2,
      maxStorage: 10000,
      generateId: () => 'p1',
      nowMs: () => Date.now(),
    });
    assert.equal(result.type, 'success');
    assert.equal(repo.__state.money, 9800);
    assert.equal(repo.__state.inventory.minerals, 196);
  }

  {
    const repo = createMockRepository({ money: 10 });
    const service = new ProductionService(repo as any);
    const result = await service.produce({
      userId: 'u1',
      weaponType: 'tank',
      qty: 1,
      maxStorage: 10000,
      generateId: () => 'p2',
      nowMs: () => Date.now(),
    });
    assert.equal(result.type, 'validation_error');
    assert.match((result as any).message, /Fondi insufficienti/);
  }

  {
    const repo = createMockRepository({ queueInsertFails: true });
    const service = new ProductionService(repo as any);
    const before = repo.__state.money;
    const result = await service.produce({
      userId: 'u1',
      weaponType: 'rifle',
      qty: 1,
      maxStorage: 10000,
      generateId: () => 'p3',
      nowMs: () => Date.now(),
    });
    assert.equal(result.type, 'system_error');
    assert.equal(repo.__state.money, before);
  }

  {
    const repo = createMockRepository({ resourceDeductFailures: { minerals: [true, true, true, true, true] } });
    const service = new ProductionService(repo as any);
    const beforeMoney = repo.__state.money;
    const beforeMinerals = repo.__state.inventory.minerals;
    const result = await service.produce({
      userId: 'u1',
      weaponType: 'rifle',
      qty: 1,
      maxStorage: 10000,
      generateId: () => 'p4',
      nowMs: () => Date.now(),
    });
    assert.equal(result.type, 'validation_error');
    assert.equal(repo.__state.money, beforeMoney);
    assert.equal(repo.__state.inventory.minerals, beforeMinerals);
    assert.equal(repo.__state.queueDeleted, true);
  }

  {
    const repo = createMockRepository({
      queueDeleteFails: true,
      moneyCasOutcomes: [false, false, false, false, false],
      resourceDeductFailures: { minerals: [true, true, true, true, true] },
    });
    const service = new ProductionService(repo as any);
    const beforeMoney = repo.__state.money;
    const result = await service.produce({
      userId: 'u1',
      weaponType: 'rifle',
      qty: 1,
      maxStorage: 10000,
      generateId: () => 'p5',
      nowMs: () => Date.now(),
    });
    assert.equal(result.type, 'system_error');
    assert.equal(repo.__state.queueDeleted, false);
    assert.equal(repo.__state.money, beforeMoney - 100);
    assert.equal(repo.__state.inventory.minerals, 200);
  }

  console.log('production-hardening-smoke: OK');
}

run().catch((err) => {
  console.error('production-hardening-smoke: FAILED');
  console.error(err);
  process.exit(1);
});
