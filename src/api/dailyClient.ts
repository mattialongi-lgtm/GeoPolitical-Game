import type { DailyMissionsState } from '../types';
import { httpFetch, httpJson } from './httpClient';

const getAuthTokenFromCookies = (): string | null => {
  return document.cookie
    .split('; ')
    .find(c => c.startsWith('sb-access-token='))?.split('=')[1]
    || document.cookie
      .split('; ')
      .find(c => c.startsWith('token='))?.split('=')[1]
    || null;
};

const buildAuthHeaders = (withJson: boolean = false): HeadersInit => {
  const token = getAuthTokenFromCookies();
  return {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(withJson ? { 'Content-Type': 'application/json' } : {}),
  };
};

export async function fetchDailyMissions() {
  return httpJson<DailyMissionsState>('/api/daily/missions', {
    headers: buildAuthHeaders(),
  });
}

export async function claimDailyMission(missionId: string): Promise<boolean> {
  const response = await httpFetch(`/api/daily/missions/claim/${missionId}`, {
    method: 'POST',
    headers: buildAuthHeaders(true),
  });
  return response.ok;
}

export async function claimDailyBonus(): Promise<boolean> {
  const response = await httpFetch('/api/daily/missions/claim-bonus', {
    method: 'POST',
    headers: buildAuthHeaders(true),
  });
  return response.ok;
}
