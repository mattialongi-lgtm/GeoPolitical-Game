/**
 * Daily Missions Service
 *
 * Contains mission template pool, selection logic, and progress-update helpers.
 * All functions are pure TypeScript – no Express or Supabase dependencies.
 */
import type { MissionTemplate, MissionCategory, MissionReward, DailyMission } from '../types';
import { DAILY_GAMEPLAY_CONFIG } from '../types';

// ── Mission Template Pool ──────────────────────────────────

export const MISSION_TEMPLATES: MissionTemplate[] = [
  // ── WORK / ECONOMY ──
  {
    mission_key: 'work_times',
    title: 'Lavoratore instancabile',
    description: 'Lavora {target} volte in una fabbrica',
    category: 'work',
    icon: '⛏️',
    baseTarget: 3,
    levelScale: 0,
    reward: { money: 300, xp: 50 },
    difficulty: 'easy',
    alwaysInclude: true,
    route: '/work',
  },
  {
    mission_key: 'earn_money',
    title: 'Profitto giornaliero',
    description: 'Guadagna ${target} tramite il lavoro',
    category: 'work',
    icon: '💰',
    baseTarget: 500,
    levelScale: 50,
    reward: { money: 200, xp: 80 },
    difficulty: 'medium',
    route: '/work',
  },
  {
    mission_key: 'earn_gold',
    title: 'Cercatore d\'oro',
    description: 'Guadagna {target} oro dal lavoro',
    category: 'work',
    icon: '🪙',
    baseTarget: 1,
    levelScale: 0,
    reward: { money: 400, xp: 60 },
    difficulty: 'medium',
    route: '/work',
  },
  {
    mission_key: 'produce_resources',
    title: 'Produzione risorse',
    description: 'Produci {target} risorse totali',
    category: 'work',
    icon: '📦',
    baseTarget: 50,
    levelScale: 5,
    reward: { money: 250, xp: 70 },
    difficulty: 'medium',
    route: '/work',
  },

  // ── MILITARY ──
  {
    mission_key: 'deal_damage',
    title: 'Usa la tua forza',
    description: 'Infliggi {target} danni in battaglia',
    category: 'military',
    icon: '⚔️',
    baseTarget: 500,
    levelScale: 100,
    reward: { money: 500, xp: 100 },
    difficulty: 'medium',
    route: '/wars',
  },
  {
    mission_key: 'fight_battles',
    title: 'Veterano di guerra',
    description: 'Partecipa a {target} battaglie',
    category: 'military',
    icon: '🎯',
    baseTarget: 2,
    levelScale: 0,
    reward: { money: 400, xp: 80 },
    difficulty: 'easy',
    route: '/wars',
  },
  {
    mission_key: 'deploy_troops',
    title: 'Stratega militare',
    description: 'Schiera {target} truppe in guerra',
    category: 'military',
    icon: '🪖',
    baseTarget: 5,
    levelScale: 1,
    reward: { money: 600, xp: 120 },
    difficulty: 'hard',
    route: '/wars',
  },

  // ── POLITICS ──
  {
    mission_key: 'check_revolution',
    title: 'Sentinella politica',
    description: 'Controlla rivoluzioni o colpi di stato nella tua regione',
    category: 'politics',
    icon: '🔥',
    baseTarget: 1,
    levelScale: 0,
    reward: { money: 150, xp: 40 },
    difficulty: 'easy',
    route: '/wars',
  },
  {
    mission_key: 'join_revolution',
    title: 'Rivoluzionario',
    description: 'Partecipa a una rivoluzione o colpo di stato',
    category: 'politics',
    icon: '✊',
    baseTarget: 1,
    levelScale: 0,
    reward: { money: 800, gold: 2, xp: 150 },
    difficulty: 'hard',
    route: '/wars',
  },
  {
    mission_key: 'political_action',
    title: 'Attivista politico',
    description: 'Compi {target} azione politica (vota, proponi legge)',
    category: 'politics',
    icon: '🗳️',
    baseTarget: 1,
    levelScale: 0,
    reward: { money: 300, xp: 60 },
    difficulty: 'medium',
    route: '/party',
  },

  // ── CONSTRUCTION / INDUSTRY ──
  {
    mission_key: 'upgrade_factory',
    title: 'Industrialista',
    description: 'Migliora {target} fabbrica',
    category: 'construction',
    icon: '🏭',
    baseTarget: 1,
    levelScale: 0,
    reward: { money: 500, xp: 100 },
    difficulty: 'medium',
    route: '/work',
  },
  {
    mission_key: 'start_production',
    title: 'Avvia produzione',
    description: 'Avvia {target} sessione di produzione',
    category: 'construction',
    icon: '⚙️',
    baseTarget: 1,
    levelScale: 0,
    reward: { money: 200, xp: 50 },
    difficulty: 'easy',
    route: '/work',
  },

  // ── ENGAGEMENT / PROGRESSION ──
  {
    mission_key: 'daily_login',
    title: 'Accesso giornaliero',
    description: 'Effettua il login giornaliero',
    category: 'engagement',
    icon: '📅',
    baseTarget: 1,
    levelScale: 0,
    reward: { money: 100, xp: 30 },
    difficulty: 'easy',
    alwaysInclude: true,
  },
  {
    mission_key: 'upgrade_perk',
    title: 'Crescita personale',
    description: 'Migliora una perk',
    category: 'engagement',
    icon: '📈',
    baseTarget: 1,
    levelScale: 0,
    reward: { money: 300, gold: 1, xp: 80 },
    difficulty: 'medium',
    route: '/daily#perks',
  },
  {
    mission_key: 'complete_missions',
    title: 'Missionario esperto',
    description: 'Completa {target} missioni giornaliere',
    category: 'engagement',
    icon: '🏅',
    baseTarget: 5,
    levelScale: 0,
    reward: { money: 500, gold: 2, xp: 150 },
    difficulty: 'hard',
  },
  {
    mission_key: 'spend_energy',
    title: 'Energia spesa',
    description: 'Spendi {target} punti energia',
    category: 'engagement',
    icon: '⚡',
    baseTarget: 30,
    levelScale: 5,
    reward: { money: 200, xp: 60 },
    difficulty: 'easy',
    route: '/work',
  },
  {
    mission_key: 'earn_xp',
    title: 'Esperienza acquisita',
    description: 'Guadagna {target} XP totali',
    category: 'engagement',
    icon: '✨',
    baseTarget: 100,
    levelScale: 20,
    reward: { money: 300, xp: 100 },
    difficulty: 'medium',
  },
];

// ── Selection Logic ──────────────────────────────────────────

/**
 * Compute the scaled target for a template given the player level.
 */
export function computeTarget(template: MissionTemplate, playerLevel: number): number {
  return Math.max(1, Math.round(template.baseTarget + template.levelScale * Math.max(0, playerLevel - 1)));
}

/**
 * Resolve the description placeholder {target} with the computed target.
 */
export function resolveDescription(template: MissionTemplate, target: number): string {
  return template.description.replace(/\{target\}/g, String(target));
}

/**
 * Deterministic seed from a date string (YYYY-MM-DD) + a user id.
 * Used to create a per-player per-day pseudo-random order.
 */
function dailySeed(dateStr: string, userId: string): number {
  let hash = 0;
  const s = dateStr + userId;
  for (let i = 0; i < s.length; i++) {
    hash = ((hash << 5) - hash + s.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

/**
 * Simple seeded PRNG (mulberry32).
 */
function seededRandom(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Select daily missions for a player.
 * Returns an array of mission templates chosen for today.
 *
 * @param dateStr  - YYYY-MM-DD (UTC)
 * @param userId   - player id
 * @param playerLevel - for target scaling
 * @param count    - how many missions (default 8)
 */
export function selectDailyMissions(
  dateStr: string,
  userId: string,
  playerLevel: number,
  count: number = DAILY_GAMEPLAY_CONFIG.DAILY_MISSIONS_COUNT,
): DailyMission[] {
  const seed = dailySeed(dateStr, userId);
  const rng = seededRandom(seed);

  // Separate always-include and optional templates
  const always = MISSION_TEMPLATES.filter(t => t.alwaysInclude);
  const optional = MISSION_TEMPLATES.filter(t => !t.alwaysInclude);

  // Shuffle optional
  const shuffled = [...optional].sort(() => rng() - 0.5);

  // Ensure category balance: pick at most 2 per category from optional
  const selected: MissionTemplate[] = [...always];
  const categoryCounts: Record<string, number> = {};
  for (const t of always) {
    categoryCounts[t.category] = (categoryCounts[t.category] || 0) + 1;
  }

  for (const t of shuffled) {
    if (selected.length >= count) break;
    const cc = categoryCounts[t.category] || 0;
    if (cc >= 3) continue; // max 3 per category
    selected.push(t);
    categoryCounts[t.category] = cc + 1;
  }

  // Ensure difficulty balance: at least 2 easy, 2 medium
  // (already handled by pool composition but we verify)

  // Convert to DailyMission objects
  return selected.map((t, idx) => {
    const target = computeTarget(t, playerLevel);
    return {
      id: `${dateStr}_${userId}_${t.mission_key}`,
      mission_key: t.mission_key,
      title: t.title,
      description: resolveDescription(t, target),
      category: t.category,
      icon: t.icon,
      target,
      progress: 0,
      status: 'active' as const,
      reward: t.reward,
      route: t.route,
    };
  });
}

/**
 * Check if a mission is completed (progress >= target).
 */
export function isMissionComplete(mission: DailyMission): boolean {
  return mission.progress >= mission.target;
}

/**
 * Map of mission_key to the game actions that update its progress.
 * Used by the backend to know which missions to update for each action.
 */
export const MISSION_ACTION_MAP: Record<string, string[]> = {
  // action key → mission_keys it can update
  'WORK': ['work_times', 'earn_money', 'earn_gold', 'produce_resources', 'start_production', 'spend_energy'],
  'WAR_DEPLOY': ['deal_damage', 'fight_battles', 'deploy_troops', 'spend_energy'],
  'REVOLUTION_JOIN': ['join_revolution', 'check_revolution', 'political_action'],
  'COUP_JOIN': ['join_revolution', 'check_revolution', 'political_action'],
  'FACTORY_UPGRADE': ['upgrade_factory'],
  'PERK_UPGRADE': ['upgrade_perk'],
  'LOGIN': ['daily_login'],
  'EARN_XP': ['earn_xp'],
  'MISSION_COMPLETE': ['complete_missions'],
};
