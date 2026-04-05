import { httpJson } from './httpClient';

const getAuthTokenFromCookies = (): string | null => {
  return document.cookie
    .split('; ')
    .find(c => c.startsWith('sb-access-token='))?.split('=')[1]
    || document.cookie
      .split('; ')
      .find(c => c.startsWith('token='))?.split('=')[1]
    || null;
};

const buildAuthHeaders = (): HeadersInit => {
  const token = getAuthTokenFromCookies();
  return {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
};

export async function fetchInventoryHistory(itemId: string) {
  return httpJson<{ success: boolean; history: any[]; currentBalance: number; itemId: string }>(
    `/api/inventory/history/${encodeURIComponent(itemId)}`,
    { headers: buildAuthHeaders() }
  );
}
