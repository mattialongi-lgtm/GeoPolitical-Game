import { FactoryUpgradeRepository } from '../repositories/factory-upgrade.repository';
import { FACTORY_ECONOMY_CAS_RETRIES, buildCriticalRollbackMessage, createEconomyOperationId, runCasRetry } from './factory-economy.shared';
import { forbiddenError, notFoundError, serviceSuccess, systemError, type ServiceResult, validationError } from './service-result';

export class FactoryUpgradeService {
  constructor(private readonly repository: FactoryUpgradeRepository) {}

  async upgradeFactory(userId: string, factoryId: string, targetLevel?: number): Promise<ServiceResult<any>> {
    const operationId = createEconomyOperationId('upgrade', factoryId, userId);

    if (!factoryId) {
      return validationError('Parametri non validi.');
    }

    const factory = await this.repository.getFactoryById(factoryId);
    if (!factory) {
      return notFoundError('Fabbrica non trovata.');
    }

    if (factory.ownerUserId !== userId) {
      return forbiddenError('Non sei il proprietario di questa fabbrica.');
    }

    const currentLevel = factory.level || 1;
    const resolvedTarget = targetLevel ? parseInt(String(targetLevel), 10) : currentLevel + 1;

    if (resolvedTarget <= currentLevel) {
      return validationError('Il livello target deve essere maggiore di quello attuale.');
    }

    if (resolvedTarget > 800) {
      return validationError('Livello massimo è 800.');
    }

    // RPC-first source of truth
    try {
      const { data, error } = await this.repository.runUpgradeFactoryRpc(factoryId, resolvedTarget, userId);
      if (!error && data) {
        const result = typeof data === 'string' ? JSON.parse(data) : data;
        if (result?.error) {
          return validationError(result.error);
        }

        return serviceSuccess({ success: true, newLevel: result.levelAfter, goldCost: result.goldCost });
      }

      if (error) throw error;
    } catch (rpcErr: any) {
      console.log('[factory-upgrade] RPC fallback:', rpcErr?.message, { operationId, flow: 'upgrade' });
    }

    // Deterministic fallback path
    const goldCost = await this.calculateUpgradeCost(currentLevel, resolvedTarget);
    if (goldCost <= 0) {
      return validationError('Costo calcolato non valido.');
    }

    const deduction = await this.tryDeductGold(userId, goldCost, operationId);
    if (deduction.type !== 'deducted') {
      return deduction;
    }

    const levelUpdated = await this.repository.tryUpdateFactoryLevelWithCAS(factoryId, currentLevel, resolvedTarget);
    if (!levelUpdated) {
      const refunded = await this.tryRefundGold(userId, goldCost, operationId);
      if (!refunded) {
        return systemError(buildCriticalRollbackMessage("Errore critico nell'upgrade"));
      }

      return systemError("Errore nell'aggiornamento livello fabbrica.");
    }

    console.info('[FactoryUpgradeService] factory_level_upgraded', {
      operationId,
      flow: 'upgrade',
      userId,
      factoryId,
      fromLevel: currentLevel,
      toLevel: resolvedTarget,
      goldCost,
    });

    return serviceSuccess({ success: true, newLevel: resolvedTarget, goldCost }, 200, { fallbackUsed: true });
  }

  private async calculateUpgradeCost(currentLevel: number, resolvedTarget: number): Promise<number> {
    const [currentRow, targetRow] = await Promise.all([
      this.repository.getFactoryAggregateCost(currentLevel),
      this.repository.getFactoryAggregateCost(resolvedTarget),
    ]);

    if (targetRow?.aggregate_cost != null) {
      const currentAgg = currentRow?.aggregate_cost || 0;
      return targetRow.aggregate_cost - currentAgg;
    }

    let cost = 0;
    for (let l = currentLevel + 1; l <= resolvedTarget; l += 1) {
      cost += l === 1 ? 500 : 5 * l;
    }
    return cost;
  }

  private async tryDeductGold(userId: string, goldCost: number, operationId: string) {
    let insufficientFunds = false;

    const updated = await runCasRetry(
      FACTORY_ECONOMY_CAS_RETRIES,
      async () => {
        const currentGold = await this.repository.getUserGold(userId);
        if (currentGold < goldCost) {
          insufficientFunds = true;
          return false;
        }

        return this.repository.tryUpdateUserGoldWithCAS(userId, currentGold, currentGold - goldCost);
      },
      (attempt, err) => {
        console.error('[FactoryUpgradeService] gold_deduction_attempt_failed', {
          operationId,
          flow: 'upgrade',
          userId,
          goldCost,
          attempt,
          error: err?.message,
        });
      },
    );

    if (updated) {
      console.info('[FactoryUpgradeService] gold_deducted', {
        operationId,
        flow: 'upgrade',
        userId,
        goldCost,
      });
      return { type: 'deducted' as const };
    }

    if (insufficientFunds) {
      const currentGold = await this.repository.getUserGold(userId);
      return validationError(`Gold insufficiente. Servono ${goldCost} Gold, hai ${Math.floor(currentGold || 0)}.`);
    }

    return systemError("Errore nell'upgrade: conflitto concorrente sulla deduzione Gold.");
  }

  private async tryRefundGold(userId: string, goldCost: number, operationId: string): Promise<boolean> {
    return runCasRetry(
      FACTORY_ECONOMY_CAS_RETRIES,
      async (attempt) => {
        const currentGold = await this.repository.getUserGold(userId);
        const updated = await this.repository.tryUpdateUserGoldWithCAS(userId, currentGold, currentGold + goldCost);
        if (updated) {
          console.warn('[FactoryUpgradeService] gold_refunded', {
            operationId,
            flow: 'upgrade',
            userId,
            goldCost,
            attempt,
            refundedFrom: currentGold,
            refundedTo: currentGold + goldCost,
          });
        }
        return updated;
      },
      (attempt, err) => {
        console.error('[FactoryUpgradeService] gold_refund_attempt_failed', {
          operationId,
          flow: 'upgrade',
          userId,
          goldCost,
          attempt,
          error: err?.message,
        });
      },
    );
  }
}
