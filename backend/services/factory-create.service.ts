import { FACTORY_CONFIG } from '../../src/types';
import { FactoryCreateRepository } from '../repositories/factory-create.repository';
import { FACTORY_ECONOMY_CAS_RETRIES, buildCriticalRollbackMessage, createEconomyOperationId, runCasRetry } from './factory-economy.shared';
import { serviceSuccess, systemError, type ServiceResult, validationError } from './service-result';

export class FactoryCreateService {
  constructor(private readonly repository: FactoryCreateRepository) {}

  async createFactory(userId: string, body: { name?: string; type?: string; regionId?: string }): Promise<ServiceResult<any>> {
    const { name, type, regionId } = body;
    const operationId = createEconomyOperationId('create', `create:${regionId || 'unknown'}`, userId);

    if (!name || !type || !regionId) {
      return validationError('Dati mancanti.');
    }

    const validTypes = Object.keys(FACTORY_CONFIG.TYPES);
    if (!validTypes.includes(type)) {
      return validationError('Tipo di fabbrica non valido.');
    }

    const cost = FACTORY_CONFIG.CREATE_COST[type] || 5000;

    const currentMoney = await this.repository.getUserMoney(userId);
    if (currentMoney < cost) {
      return validationError(`Fondi insufficienti. Servono €${cost.toLocaleString()}.`);
    }

    const deductionError = await this.repository.deductUserMoney(userId, cost);
    if (deductionError) {
      return validationError(deductionError);
    }

    console.info('[FactoryCreateService] wallet_deducted', {
      operationId,
      flow: 'create',
      userId,
      type,
      regionId,
      cost,
    });

    const payload = {
      name,
      type,
      regionId: regionId.toUpperCase(),
      ownerUserId: userId,
      wage: 50,
      budget: 0,
      level: 1,
      cooldownSec: 600,
      currentStorage: 0,
      isActive: true,
      totalWorkerCount: 0,
      totalProduction: 0,
      totalOwnerProfit: 0,
      totalTaxesPaid: 0,
      listedForSale: false,
      salePrice: 0,
      createdAt: new Date().toISOString(),
    };

    try {
      const { data: factory, error } = await this.repository.insertFactory(payload);
      if (error || !factory) {
        throw new Error(error?.message || 'Factory insert failed');
      }

      return serviceSuccess(factory);
    } catch (err: any) {
      const refundOk = await this.tryRefundUserMoney(userId, cost, operationId);
      if (!refundOk) {
        return systemError(buildCriticalRollbackMessage('Errore critico nella creazione'));
      }

      return systemError(`Errore nella creazione: ${err.message}`);
    }
  }

  private async tryRefundUserMoney(userId: string, amount: number, operationId: string): Promise<boolean> {
    return runCasRetry(
      FACTORY_ECONOMY_CAS_RETRIES,
      async (attempt) => {
        const currentMoney = await this.repository.getUserMoney(userId);
        const updated = await this.repository.tryUpdateUserMoneyWithCAS(userId, currentMoney, currentMoney + amount);
        if (updated) {
          console.warn('[FactoryCreateService] wallet_refunded', {
            operationId,
            flow: 'create',
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
        console.error('[FactoryCreateService] refund_attempt_failed', {
          operationId,
          flow: 'create',
          userId,
          amount,
          attempt,
          error: err?.message,
        });
      },
    );
  }
}
