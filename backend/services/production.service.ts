import { ProductionRepository } from '../repositories/production.repository';
import {
  FACTORY_ECONOMY_CAS_RETRIES,
  buildCriticalRollbackMessage,
  createEconomyOperationId,
  runCasRetry,
} from './factory-economy.shared';
import { serviceSuccess, systemError, type ServiceResult, validationError } from './service-result';

const WEAPONS_DEF: Record<string, { timeMin: number; costCash: number; power: number; reqOil?: number; reqMinerals?: number; reqUranium?: number; reqDiamonds?: number }> = {
  rifle: { timeMin: 1, costCash: 100, power: 2, reqMinerals: 2 },
  drone: { timeMin: 8, costCash: 800, power: 20, reqMinerals: 10, reqOil: 5 },
  artillery: { timeMin: 5, costCash: 500, power: 12, reqMinerals: 15, reqOil: 2 },
  tank: { timeMin: 15, costCash: 1500, power: 40, reqMinerals: 30, reqOil: 15, reqUranium: 1 },
  missile: { timeMin: 30, costCash: 5000, power: 150, reqMinerals: 50, reqOil: 40, reqUranium: 10, reqDiamonds: 2 },
};

type ResourceItem = { itemId: 'oil' | 'minerals' | 'uranium' | 'diamonds'; quantity: number };

export class ProductionService {
  constructor(private readonly repository: ProductionRepository) {}

  async produce(params: {
    userId: string;
    weaponType?: string;
    qty?: any;
    maxStorage: number;
    generateId: () => string;
    nowMs: () => number;
  }): Promise<ServiceResult<any>> {
    const weaponType = params.weaponType || '';
    const weapon = WEAPONS_DEF[weaponType];
    if (!weapon) {
      return validationError('Tipo di arma non valido');
    }

    const amount = Math.max(1, parseInt(params.qty, 10) || 1);
    const totalCost = weapon.costCash * amount;
    const operationId = createEconomyOperationId('create', `produce:${weaponType}`, params.userId);

    const currentMoney = await this.repository.getUserMoney(params.userId);
    if (currentMoney < totalCost) {
      return validationError(`Fondi insufficienti. Costo totale: $${totalCost.toLocaleString()}`);
    }

    const inv = await this.repository.getUserInventory(params.userId);
    const inventoryMap = new Map((inv || []).map((i: any) => [i.itemId, Number(i.quantity || 0)]));

    const reqs: ResourceItem[] = [
      { itemId: 'oil', quantity: (weapon.reqOil || 0) * amount },
      { itemId: 'minerals', quantity: (weapon.reqMinerals || 0) * amount },
      { itemId: 'uranium', quantity: (weapon.reqUranium || 0) * amount },
      { itemId: 'diamonds', quantity: (weapon.reqDiamonds || 0) * amount },
    ];

    const hasAllResources = reqs.every((r) => (inventoryMap.get(r.itemId) || 0) >= r.quantity);
    if (!hasAllResources) {
      return validationError('Non hai abbastanza risorse nel Magazzino Privato per produrre queste armi.');
    }

    const currentVol = (inv || []).reduce((sum: number, item: any) => sum + Number(item.quantity || 0), 0);
    const spaceFreed = reqs.reduce((sum, r) => sum + r.quantity, 0);
    const spaceConsumed = amount;
    if (currentVol - spaceFreed + spaceConsumed > params.maxStorage) {
      return validationError('Spazio nel Magazzino Privato insufficiente.');
    }

    const now = params.nowMs();
    let startOffset = 0;
    const lastQueueItem = await this.repository.getLastQueueItem(params.userId);
    if (lastQueueItem) {
      const lastComplete = new Date(lastQueueItem.willCompleteAt).getTime();
      if (lastComplete > now) startOffset = lastComplete - now;
    }

    const startedAt = now + startOffset;
    const willCompleteAt = startedAt + weapon.timeMin * 60 * 1000 * amount;
    const prodId = params.generateId();

    const deductionError = await this.repository.deductMoney(params.userId, totalCost);
    if (deductionError) {
      return validationError(deductionError);
    }

    console.info('[ProductionService] wallet_deducted', {
      operationId,
      flow: 'produce',
      userId: params.userId,
      weaponType,
      amount,
      totalCost,
    });

    try {
      await this.repository.insertQueue({
        id: prodId,
        userId: params.userId,
        weaponType,
        qty: amount,
        status: 'queued',
        startedAt: new Date(startedAt).toISOString(),
        willCompleteAt: new Date(willCompleteAt).toISOString(),
        createdAt: new Date(now).toISOString(),
      });
    } catch (err: any) {
      const refundOk = await this.tryRefundMoney(params.userId, totalCost, operationId);
      if (!refundOk) {
        return systemError(buildCriticalRollbackMessage('Errore critico nella produzione'));
      }
      return systemError(`Errore nella produzione: ${err.message}`);
    }

    const deductedResources: ResourceItem[] = [];
    for (const resource of reqs) {
      if (resource.quantity <= 0) continue;
      const ok = await this.tryDeductResource(params.userId, resource.itemId, resource.quantity, operationId);
      if (!ok) {
        const restored = await this.restoreAfterResourceFailure(params.userId, prodId, totalCost, deductedResources, operationId);
        if (!restored) {
          return systemError(buildCriticalRollbackMessage('Errore critico nella produzione'));
        }

        return validationError('Non hai abbastanza risorse nel Magazzino Privato per produrre queste armi.');
      }
      deductedResources.push(resource);
    }

    await this.repository.cleanupZeroInventory(params.userId);

    return serviceSuccess({ success: true, totalCost });
  }

  private async tryDeductResource(userId: string, itemId: ResourceItem['itemId'], quantity: number, operationId: string): Promise<boolean> {
    return runCasRetry(
      FACTORY_ECONOMY_CAS_RETRIES,
      async (attempt) => {
        const currentQty = await this.repository.getInventoryQuantity(userId, itemId);
        if (currentQty === null || currentQty < quantity) return false;

        const updated = await this.repository.tryUpdateInventoryQuantityCAS(userId, itemId, currentQty, currentQty - quantity);
        if (updated) {
          console.info('[ProductionService] resource_deducted', { operationId, flow: 'produce', userId, itemId, quantity, attempt });
        }

        return updated;
      },
      (attempt, err) => {
        console.error('[ProductionService] resource_deduction_attempt_failed', {
          operationId,
          flow: 'produce',
          userId,
          itemId,
          quantity,
          attempt,
          error: err?.message,
        });
      },
    );
  }

  private async tryRefundResource(userId: string, itemId: ResourceItem['itemId'], quantity: number, operationId: string): Promise<boolean> {
    return runCasRetry(
      FACTORY_ECONOMY_CAS_RETRIES,
      async (attempt) => {
        const currentQty = await this.repository.getInventoryQuantity(userId, itemId);
        if (currentQty === null) return false;

        const updated = await this.repository.tryUpdateInventoryQuantityCAS(userId, itemId, currentQty, currentQty + quantity);
        if (updated) {
          console.warn('[ProductionService] resource_refunded', { operationId, flow: 'produce', userId, itemId, quantity, attempt });
        }

        return updated;
      },
      (attempt, err) => {
        console.error('[ProductionService] resource_refund_attempt_failed', {
          operationId,
          flow: 'produce',
          userId,
          itemId,
          quantity,
          attempt,
          error: err?.message,
        });
      },
    );
  }

  private async tryRefundMoney(userId: string, amount: number, operationId: string): Promise<boolean> {
    return runCasRetry(
      FACTORY_ECONOMY_CAS_RETRIES,
      async (attempt) => {
        const currentMoney = await this.repository.getUserMoney(userId);
        const updated = await this.repository.tryUpdateUserMoneyCAS(userId, currentMoney, currentMoney + amount);
        if (updated) {
          console.warn('[ProductionService] wallet_refunded', {
            operationId,
            flow: 'produce',
            userId,
            amount,
            attempt,
            refundedFrom: currentMoney,
            refundedTo: currentMoney + amount,
          });
        }
        return updated;
      },
      (attempt, err) => {
        console.error('[ProductionService] wallet_refund_attempt_failed', {
          operationId,
          flow: 'produce',
          userId,
          amount,
          attempt,
          error: err?.message,
        });
      },
    );
  }

  private async restoreAfterResourceFailure(
    userId: string,
    prodId: string,
    totalCost: number,
    deductedResources: ResourceItem[],
    operationId: string,
  ): Promise<boolean> {
    let allGood = true;

    try {
      await this.repository.deleteQueueItem(prodId, userId);
    } catch {
      allGood = false;
    }

    const moneyRefunded = await this.tryRefundMoney(userId, totalCost, operationId);
    if (!moneyRefunded) allGood = false;

    for (const res of deductedResources) {
      const restored = await this.tryRefundResource(userId, res.itemId, res.quantity, operationId);
      if (!restored) allGood = false;
    }

    return allGood;
  }
}
