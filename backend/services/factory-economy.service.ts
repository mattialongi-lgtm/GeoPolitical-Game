import { FactoryEconomyRepository } from '../repositories/factory-economy.repository';
import { FACTORY_ECONOMY_CAS_RETRIES, buildCriticalRollbackMessage, createEconomyOperationId, runCasRetry } from './factory-economy.shared';
import { forbiddenError, notFoundError, serviceSuccess, systemError, type ServiceResult, validationError } from './service-result';

type DepositPayload = { newBudget: number };

export class FactoryEconomyService {
  constructor(private readonly repository: FactoryEconomyRepository) {}

  async depositFactoryBudget(userId: string, factoryId: string, amount: number): Promise<ServiceResult<DepositPayload>> {
    const operationId = createEconomyOperationId('deposit', factoryId, userId);

    if (!Number.isFinite(amount) || amount <= 0 || Math.floor(amount) !== amount) {
      return validationError('Parametri non validi.');
    }

    const factory = await this.repository.getFactoryBudgetRow(factoryId);
    if (!factory) {
      return notFoundError('Fabbrica non trovata.');
    }

    if (factory.ownerUserId !== userId) {
      return forbiddenError('Non sei il proprietario.');
    }

    const deductionError = await this.repository.deductUserMoney(userId, amount);
    if (deductionError) {
      return validationError(deductionError);
    }

    console.info('[FactoryEconomyService] wallet_deducted', {
      operationId,
      flow: 'deposit',
      factoryId,
      userId,
      amount,
    });

    try {
      const newBudget = await this.creditFactoryBudget(factoryId, amount, operationId);
      return serviceSuccess({ newBudget });
    } catch (budgetErr: any) {
      console.error('[FactoryEconomyService] budget_credit_failed', {
        operationId,
        flow: 'deposit',
        factoryId,
        userId,
        amount,
        error: budgetErr?.message,
      });

      const refundOk = await this.tryRefundUserMoney(userId, amount, operationId);
      if (!refundOk) {
        console.error('[FactoryEconomyService] CRITICAL: failed to refund user after budget credit failure', {
          operationId,
          flow: 'deposit',
          userId,
          factoryId,
          amount,
          budgetError: budgetErr?.message,
        });
      }

      return systemError(
        refundOk
          ? `Errore nel deposito: ${budgetErr?.message || 'errore sconosciuto'}`
          : buildCriticalRollbackMessage('Errore critico nel deposito'),
      );
    }
  }

  private async creditFactoryBudget(factoryId: string, amount: number, operationId: string): Promise<number> {
    let creditedBudget: number | null = null;

    const updated = await runCasRetry(
      FACTORY_ECONOMY_CAS_RETRIES,
      async (attempt) => {
        const factory = await this.repository.getFactoryBudgetRow(factoryId);
        if (!factory) {
          throw new Error('Fabbrica non trovata durante aggiornamento budget.');
        }

        const currentBudget = factory.budget === null ? 0 : Number(factory.budget || 0);
        const nextBudget = currentBudget + amount;

        const casUpdated = await this.repository.tryUpdateFactoryBudgetWithCAS(factoryId, factory.budget, nextBudget);
        if (casUpdated) {
          creditedBudget = nextBudget;
          console.info('[FactoryEconomyService] factory_budget_credited', {
            operationId,
            flow: 'deposit',
            factoryId,
            attempt,
            previousBudget: currentBudget,
            newBudget: nextBudget,
          });
        }

        return casUpdated;
      },
    );

    if (!updated || creditedBudget === null) {
      throw new Error('Conflitto concorrente sul budget fabbrica.');
    }

    return creditedBudget;
  }

  private async tryRefundUserMoney(userId: string, amount: number, operationId: string): Promise<boolean> {
    return runCasRetry(
      FACTORY_ECONOMY_CAS_RETRIES,
      async (attempt) => {
        const currentMoney = await this.repository.getUserMoney(userId);
        const nextMoney = currentMoney + amount;
        const updated = await this.repository.tryUpdateUserMoneyWithCAS(userId, currentMoney, nextMoney);
        if (updated) {
          console.warn('[FactoryEconomyService] wallet_refunded', {
            operationId,
            flow: 'deposit',
            userId,
            amount,
            attempt,
            refundedFrom: currentMoney,
            refundedTo: nextMoney,
          });
        }
        return updated;
      },
      (attempt, refundErr) => {
        console.error('[FactoryEconomyService] wallet_refund_attempt_failed', {
          operationId,
          flow: 'deposit',
          userId,
          amount,
          attempt,
          error: refundErr?.message,
        });
      },
    );
  }
}
