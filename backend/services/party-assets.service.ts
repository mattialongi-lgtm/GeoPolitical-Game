import { PartyAssetsRepository } from '../repositories/party-assets.repository';
import { FACTORY_ECONOMY_CAS_RETRIES, buildCriticalRollbackMessage, createEconomyOperationId, runCasRetry } from './factory-economy.shared';
import { notFoundError, serviceSuccess, systemError, type ServiceResult, validationError, forbiddenError } from './service-result';

export class PartyAssetsService {
  constructor(private readonly repository: PartyAssetsRepository) {}

  async transferPartyAsset(params: {
    senderUser: { id: string; username?: string };
    targetUserId?: string;
    itemType?: string;
    amount?: any;
    logIdFactory: () => string;
    nowIsoFactory: () => string;
  }): Promise<ServiceResult<any>> {
    const senderUserId = params.senderUser.id;
    const targetUserId = params.targetUserId || '';
    const itemType = params.itemType || '';
    const numAmount = parseInt(params.amount, 10) || 0;
    const operationId = createEconomyOperationId('party_transfer', targetUserId || 'unknown', senderUserId);

    if (numAmount <= 0) {
      return validationError('Quantità non valida.');
    }

    if (senderUserId === targetUserId) {
      return validationError('Non puoi inviare a te stesso.');
    }

    const myMembership = await this.repository.getPartyMembership(senderUserId);
    if (!myMembership) {
      return forbiddenError('Non fai parte di alcun partito.');
    }

    if (Date.now() - new Date(myMembership.joinedAt).getTime() < 7 * 24 * 60 * 60 * 1000) {
      return forbiddenError('Devi essere nel partito da almeno 7 giorni.');
    }

    const targetInParty = await this.repository.isUserInParty(targetUserId, myMembership.partyId);
    if (!targetInParty) {
      return notFoundError('Il destinatario non fa parte del tuo partito.');
    }

    if (itemType === 'cash' || itemType === 'gold') {
      return this.transferCurrency({
        senderUserId,
        targetUserId,
        partyId: myMembership.partyId,
        senderUsername: params.senderUser.username || 'Utente',
        itemType,
        amount: numAmount,
        operationId,
        logIdFactory: params.logIdFactory,
        nowIsoFactory: params.nowIsoFactory,
      });
    }

    return this.transferInventory({
      senderUserId,
      targetUserId,
      partyId: myMembership.partyId,
      senderUsername: params.senderUser.username || 'Utente',
      itemType,
      amount: numAmount,
      operationId,
      logIdFactory: params.logIdFactory,
      nowIsoFactory: params.nowIsoFactory,
    });
  }

  private async transferCurrency(params: {
    senderUserId: string;
    targetUserId: string;
    partyId: string;
    senderUsername: string;
    itemType: 'cash' | 'gold';
    amount: number;
    operationId: string;
    logIdFactory: () => string;
    nowIsoFactory: () => string;
  }): Promise<ServiceResult<any>> {
    const senderBalances = await this.repository.getUserMoneyGold(params.senderUserId);
    if (params.itemType === 'cash' && senderBalances.money < params.amount) {
      return validationError('Cash insufficiente.');
    }
    if (params.itemType === 'gold' && senderBalances.gold < params.amount) {
      return validationError('Gold insufficiente.');
    }

    const deductionError = await this.repository.deductCurrency(
      params.senderUserId,
      params.itemType === 'cash' ? params.amount : 0,
      params.itemType === 'gold' ? params.amount : 0,
    );
    if (deductionError) {
      return validationError(deductionError);
    }

    const creditOk = await this.tryCreditCurrencyTarget(params.targetUserId, params.itemType, params.amount, params.operationId);
    if (!creditOk) {
      const refundOk = await this.tryRefundCurrencySender(params.senderUserId, params.itemType, params.amount, params.operationId);
      if (!refundOk) {
        return systemError(buildCriticalRollbackMessage('Errore critico nel trasferimento'));
      }

      return validationError('Errore nel trasferimento asset. Operazione annullata.');
    }

    await this.repository.insertPartyLog(
      params.partyId,
      `${params.senderUsername} ha inviato ${params.amount} ${params.itemType} a ID:${params.targetUserId}`,
      params.logIdFactory(),
      params.nowIsoFactory(),
    );

    return serviceSuccess({ success: true });
  }

  private async transferInventory(params: {
    senderUserId: string;
    targetUserId: string;
    partyId: string;
    senderUsername: string;
    itemType: string;
    amount: number;
    operationId: string;
    logIdFactory: () => string;
    nowIsoFactory: () => string;
  }): Promise<ServiceResult<any>> {
    const deducted = await this.tryDeductInventorySender(params.senderUserId, params.itemType, params.amount, params.operationId);
    if (!deducted) {
      return validationError('Oggetto insufficiente.');
    }

    const credited = await this.tryCreditInventoryTarget(params.targetUserId, params.itemType, params.amount, params.operationId);
    if (!credited) {
      const refundOk = await this.tryRefundInventorySender(params.senderUserId, params.itemType, params.amount, params.operationId);
      if (!refundOk) {
        return systemError(buildCriticalRollbackMessage('Errore critico nel trasferimento'));
      }

      return validationError('Errore nel trasferimento asset. Operazione annullata.');
    }

    await this.repository.insertPartyLog(
      params.partyId,
      `${params.senderUsername} ha inviato ${params.amount} ${params.itemType} a ID:${params.targetUserId}`,
      params.logIdFactory(),
      params.nowIsoFactory(),
    );

    return serviceSuccess({ success: true });
  }

  private async tryCreditCurrencyTarget(
    targetUserId: string,
    itemType: 'cash' | 'gold',
    amount: number,
    operationId: string,
  ): Promise<boolean> {
    return runCasRetry(
      FACTORY_ECONOMY_CAS_RETRIES,
      async (attempt) => {
        const current = await this.repository.getUserMoneyGold(targetUserId);
        const updated = itemType === 'cash'
          ? await this.repository.tryUpdateMoneyCAS(targetUserId, current.money, current.money + amount)
          : await this.repository.tryUpdateGoldCAS(targetUserId, current.gold, current.gold + amount);

        if (updated) {
          console.info('[PartyAssetsService] target_credited', { operationId, flow: 'party_transfer', itemType, amount, targetUserId, attempt });
        }

        return updated;
      },
      (attempt, err) => {
        console.error('[PartyAssetsService] target_credit_attempt_failed', {
          operationId,
          flow: 'party_transfer',
          itemType,
          amount,
          targetUserId,
          attempt,
          error: err?.message,
        });
      },
    );
  }

  private async tryRefundCurrencySender(
    senderUserId: string,
    itemType: 'cash' | 'gold',
    amount: number,
    operationId: string,
  ): Promise<boolean> {
    return runCasRetry(
      FACTORY_ECONOMY_CAS_RETRIES,
      async (attempt) => {
        const current = await this.repository.getUserMoneyGold(senderUserId);
        const updated = itemType === 'cash'
          ? await this.repository.tryUpdateMoneyCAS(senderUserId, current.money, current.money + amount)
          : await this.repository.tryUpdateGoldCAS(senderUserId, current.gold, current.gold + amount);

        if (updated) {
          console.warn('[PartyAssetsService] sender_refunded', { operationId, flow: 'party_transfer', itemType, amount, senderUserId, attempt });
        }

        return updated;
      },
      (attempt, err) => {
        console.error('[PartyAssetsService] sender_refund_attempt_failed', {
          operationId,
          flow: 'party_transfer',
          itemType,
          amount,
          senderUserId,
          attempt,
          error: err?.message,
        });
      },
    );
  }

  private async tryDeductInventorySender(senderUserId: string, itemType: string, amount: number, operationId: string): Promise<boolean> {
    return runCasRetry(
      FACTORY_ECONOMY_CAS_RETRIES,
      async (attempt) => {
        const currentQty = await this.repository.getInventoryQuantity(senderUserId, itemType);
        if (currentQty === null || currentQty < amount) {
          return false;
        }

        const updated = await this.repository.tryUpdateInventoryCAS(senderUserId, itemType, currentQty, currentQty - amount);
        if (updated) {
          console.info('[PartyAssetsService] sender_inventory_deducted', {
            operationId,
            flow: 'party_transfer',
            itemType,
            amount,
            senderUserId,
            attempt,
          });
        }

        return updated;
      },
      (attempt, err) => {
        console.error('[PartyAssetsService] sender_inventory_deduction_attempt_failed', {
          operationId,
          flow: 'party_transfer',
          itemType,
          amount,
          senderUserId,
          attempt,
          error: err?.message,
        });
      },
    );
  }

  private async tryCreditInventoryTarget(targetUserId: string, itemType: string, amount: number, operationId: string): Promise<boolean> {
    return runCasRetry(
      FACTORY_ECONOMY_CAS_RETRIES,
      async (attempt) => {
        const currentQty = await this.repository.getInventoryQuantity(targetUserId, itemType);
        if (currentQty === null) {
          try {
            await this.repository.insertInventory(targetUserId, itemType, amount);
            console.info('[PartyAssetsService] target_inventory_inserted', {
              operationId,
              flow: 'party_transfer',
              itemType,
              amount,
              targetUserId,
              attempt,
            });
            return true;
          } catch {
            return false;
          }
        }

        const updated = await this.repository.tryUpdateInventoryCAS(targetUserId, itemType, currentQty, currentQty + amount);
        if (updated) {
          console.info('[PartyAssetsService] target_inventory_credited', {
            operationId,
            flow: 'party_transfer',
            itemType,
            amount,
            targetUserId,
            attempt,
          });
        }

        return updated;
      },
      (attempt, err) => {
        console.error('[PartyAssetsService] target_inventory_credit_attempt_failed', {
          operationId,
          flow: 'party_transfer',
          itemType,
          amount,
          targetUserId,
          attempt,
          error: err?.message,
        });
      },
    );
  }

  private async tryRefundInventorySender(senderUserId: string, itemType: string, amount: number, operationId: string): Promise<boolean> {
    return runCasRetry(
      FACTORY_ECONOMY_CAS_RETRIES,
      async (attempt) => {
        const currentQty = await this.repository.getInventoryQuantity(senderUserId, itemType);
        if (currentQty === null) {
          await this.repository.insertInventory(senderUserId, itemType, amount);
          console.warn('[PartyAssetsService] sender_inventory_reinserted', {
            operationId,
            flow: 'party_transfer',
            itemType,
            amount,
            senderUserId,
            attempt,
          });
          return true;
        }

        const updated = await this.repository.tryUpdateInventoryCAS(senderUserId, itemType, currentQty, currentQty + amount);
        if (updated) {
          console.warn('[PartyAssetsService] sender_inventory_refunded', {
            operationId,
            flow: 'party_transfer',
            itemType,
            amount,
            senderUserId,
            attempt,
          });
        }

        return updated;
      },
      (attempt, err) => {
        console.error('[PartyAssetsService] sender_inventory_refund_attempt_failed', {
          operationId,
          flow: 'party_transfer',
          itemType,
          amount,
          senderUserId,
          attempt,
          error: err?.message,
        });
      },
    );
  }
}
