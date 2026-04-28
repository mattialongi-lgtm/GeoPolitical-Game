export function isTransientSupabaseNetworkError(error: any) {
  const message = String(error?.message || "").toLowerCase();
  const details = String(error?.details || "").toLowerCase();
  return (
    message.includes("fetch failed") ||
    message.includes("network") ||
    details.includes("fetch failed") ||
    details.includes("enotfound") ||
    details.includes("eai_again") ||
    details.includes("etimedout") ||
    details.includes("ecconnreset")
  );
}

export async function retrySupabaseOperation<T>(
  label: string,
  operation: () => Promise<T>,
  options?: { attempts?: number; delayMs?: number }
): Promise<T> {
  const attempts = options?.attempts ?? 3;
  const delayMs = options?.delayMs ?? 1500;
  let lastError: any;

  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await operation();
    } catch (error: any) {
      lastError = error;
      if (!isTransientSupabaseNetworkError(error) || attempt === attempts) {
        break;
      }
      console.warn(`[SupabaseRetry] ${label} failed (attempt ${attempt}/${attempts}), retrying in ${delayMs}ms...`);
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }

  throw lastError;
}
