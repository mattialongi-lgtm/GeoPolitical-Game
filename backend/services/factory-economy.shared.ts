export const FACTORY_ECONOMY_CAS_RETRIES = 5;

export type EconomyFlow = 'deposit' | 'upgrade' | 'create' | 'party_transfer' | 'produce';

export const ECONOMY_ROLLBACK_NOT_CONFIRMED_SUFFIX = 'addebito eseguito ma rollback non confermato.';

export function buildCriticalRollbackMessage(prefix: string): string {
  return `${prefix}: ${ECONOMY_ROLLBACK_NOT_CONFIRMED_SUFFIX}`;
}

export function createEconomyOperationId(flow: EconomyFlow, entityId: string, userId: string) {
  return `${flow}:${entityId}:${userId}:${Date.now()}`;
}

// Backward-compatible alias (keep existing call sites stable while migrating)
export const createFactoryOperationId = createEconomyOperationId;

export async function runCasRetry(
  retries: number,
  runAttempt: (attempt: number) => Promise<boolean>,
  onAttemptError?: (attempt: number, err: any) => void,
): Promise<boolean> {
  for (let attempt = 0; attempt < retries; attempt += 1) {
    try {
      const updated = await runAttempt(attempt);
      if (updated) {
        return true;
      }
    } catch (err: any) {
      onAttemptError?.(attempt, err);
    }
  }

  return false;
}
