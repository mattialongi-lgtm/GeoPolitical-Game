import * as assert from 'node:assert/strict';
import { PartyAssetsService } from '../backend/services/party-assets.service';

function createMockRepository(opts?: {
  membership?: { partyId: string; joinedAt: string } | null;
  targetInParty?: boolean;
  senderMoney?: number;
  senderGold?: number;
  targetMoney?: number;
  targetGold?: number;
  deductError?: string | null;
  moneyCreditOutcomes?: boolean[];
  moneyRefundOutcomes?: boolean[];
  inventorySenderQty?: number | null;
  inventoryTargetQty?: number | null;
  inventoryDeductOutcomes?: boolean[];
  inventoryCreditOutcomes?: boolean[];
  inventoryRefundOutcomes?: boolean[];
}) {
  const state = {
    membership: opts?.membership ?? { partyId: 'p1', joinedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString() },
    targetInParty: opts?.targetInParty ?? true,
    senderMoney: opts?.senderMoney ?? 1000,
    senderGold: opts?.senderGold ?? 100,
    targetMoney: opts?.targetMoney ?? 200,
    targetGold: opts?.targetGold ?? 30,
    deductError: opts?.deductError ?? null,
    moneyCreditOutcomes: [...(opts?.moneyCreditOutcomes ?? [true])],
    moneyRefundOutcomes: [...(opts?.moneyRefundOutcomes ?? [true])],
    inventorySenderQty: opts?.inventorySenderQty ?? 10,
    inventoryTargetQty: opts?.inventoryTargetQty ?? 3,
    inventoryDeductOutcomes: [...(opts?.inventoryDeductOutcomes ?? [true])],
    inventoryCreditOutcomes: [...(opts?.inventoryCreditOutcomes ?? [true])],
    inventoryRefundOutcomes: [...(opts?.inventoryRefundOutcomes ?? [true])],
  };

  return {
    async getPartyMembership() { return state.membership; },
    async isUserInParty() { return state.targetInParty; },
    async getUserMoneyGold(userId: string) {
      return userId === 'sender'
        ? { money: state.senderMoney, gold: state.senderGold }
        : { money: state.targetMoney, gold: state.targetGold };
    },
    async deductCurrency(_userId: string, moneyCost: number, goldCost: number) {
      if (state.deductError) return state.deductError;
      state.senderMoney -= moneyCost;
      state.senderGold -= goldCost;
      return null;
    },
    async tryUpdateMoneyCAS(userId: string, expected: number, next: number) {
      const arr = userId === 'target' ? state.moneyCreditOutcomes : state.moneyRefundOutcomes;
      const outcome = arr.length ? arr.shift()! : false;
      const cur = userId === 'target' ? state.targetMoney : state.senderMoney;
      if (outcome && cur === expected) {
        if (userId === 'target') state.targetMoney = next;
        else state.senderMoney = next;
        return true;
      }
      return false;
    },
    async tryUpdateGoldCAS(_userId: string, _expected: number, _next: number) { return false; },
    async getInventoryQuantity(userId: string) {
      return userId === 'sender' ? state.inventorySenderQty : state.inventoryTargetQty;
    },
    async tryUpdateInventoryCAS(userId: string, _itemId: string, expected: number, next: number) {
      if (userId === 'sender') {
        const outcomes = next < expected ? state.inventoryDeductOutcomes : state.inventoryRefundOutcomes;
        const ok = outcomes.length ? outcomes.shift()! : false;
        if (ok && state.inventorySenderQty === expected) {
          state.inventorySenderQty = next;
          return true;
        }
        return false;
      }
      const ok = state.inventoryCreditOutcomes.length ? state.inventoryCreditOutcomes.shift()! : false;
      if (ok && state.inventoryTargetQty === expected) {
        state.inventoryTargetQty = next;
        return true;
      }
      return false;
    },
    async insertInventory(userId: string, _itemId: string, quantity: number) {
      if (userId === 'target') state.inventoryTargetQty = quantity;
      else state.inventorySenderQty = quantity;
    },
    async insertPartyLog() { return; },
    __state: state,
  };
}

async function run() {
  {
    const repo = createMockRepository({ senderMoney: 1000, targetMoney: 50 });
    const service = new PartyAssetsService(repo as any);
    const result = await service.transferPartyAsset({
      senderUser: { id: 'sender', username: 'alice' },
      targetUserId: 'target',
      itemType: 'cash',
      amount: 100,
      logIdFactory: () => 'log1',
      nowIsoFactory: () => new Date().toISOString(),
    });
    assert.equal(result.type, 'success');
    assert.equal(repo.__state.senderMoney, 900);
    assert.equal(repo.__state.targetMoney, 150);
  }

  {
    const repo = createMockRepository({ senderMoney: 50 });
    const service = new PartyAssetsService(repo as any);
    const result = await service.transferPartyAsset({
      senderUser: { id: 'sender', username: 'alice' },
      targetUserId: 'target',
      itemType: 'cash',
      amount: 100,
      logIdFactory: () => 'log2',
      nowIsoFactory: () => new Date().toISOString(),
    });
    assert.equal(result.type, 'validation_error');
    assert.match((result as any).message, /Cash insufficiente/);
  }

  {
    const repo = createMockRepository({ senderMoney: 1000, moneyCreditOutcomes: [false, false, false, false, false], moneyRefundOutcomes: [true] });
    const service = new PartyAssetsService(repo as any);
    const result = await service.transferPartyAsset({
      senderUser: { id: 'sender', username: 'alice' },
      targetUserId: 'target',
      itemType: 'cash',
      amount: 100,
      logIdFactory: () => 'log3',
      nowIsoFactory: () => new Date().toISOString(),
    });
    assert.equal(result.type, 'validation_error');
    assert.equal(repo.__state.senderMoney, 1000);
  }

  {
    const repo = createMockRepository({
      inventorySenderQty: 20,
      inventoryTargetQty: 10,
      inventoryDeductOutcomes: [true],
      inventoryCreditOutcomes: [false, false, false, false, false],
      inventoryRefundOutcomes: [true],
    });
    const service = new PartyAssetsService(repo as any);
    const result = await service.transferPartyAsset({
      senderUser: { id: 'sender', username: 'alice' },
      targetUserId: 'target',
      itemType: 'oil',
      amount: 5,
      logIdFactory: () => 'log4',
      nowIsoFactory: () => new Date().toISOString(),
    });
    assert.equal(result.type, 'validation_error');
    assert.equal(repo.__state.inventorySenderQty, 20);
  }

  console.log('party-assets-hardening-smoke: OK');
}

run().catch((err) => {
  console.error('party-assets-hardening-smoke: FAILED');
  console.error(err);
  process.exit(1);
});
