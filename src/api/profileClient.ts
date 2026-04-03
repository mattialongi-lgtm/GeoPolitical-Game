import { httpJson } from './httpClient';

export interface PlayerDamageByWarEntry {
  warId: string;
  warLabel: string;
  totalDamage: number;
  side: 'attacker' | 'defender' | null;
  status: string | null;
  attackerDisplayName?: string | null;
  defenderDisplayName?: string | null;
}

export interface PlayerDamageSummary {
  totalDamage: number;
  wars: PlayerDamageByWarEntry[];
}

export async function fetchMyPlayerDamageSummary(): Promise<PlayerDamageSummary> {
  return httpJson<PlayerDamageSummary>('/api/wars/player-damage-summary');
}
