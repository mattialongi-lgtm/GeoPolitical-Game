/**
 * Mock data for the Daily Gameplay System components.
 * These fixtures provide realistic sample data for development and testing.
 * Replace with actual API calls when backend is ready.
 */
import type {
  DailyTask,
  AutoWorkConfig,
  FarmingBonus,
  FarmingResourceEntry,
  DailyDamageState,
  DamageTarget,
  AcademyState,
  AcademyReward,
  PerkUpgradeEntry,
  FreeRewardEntry,
  WorkStreak,
  PeriodicRewardProgress,
  BottleValueBreakdown,
} from '../../types';

// ── Daily Tasks Checklist ──────────────────────────────────

export const MOCK_DAILY_TASKS: DailyTask[] = [
  {
    id: 'task-auto-work',
    title: 'Imposta lavoro automatico',
    description: 'Attiva il farming automatico su una risorsa',
    icon: '⛏️',
    status: 'available',
    route: '/daily#farming',
  },
  {
    id: 'task-daily-damage',
    title: 'Usa danno giornaliero',
    description: 'Invia il tuo danno in addestramento o difesa',
    icon: '⚔️',
    status: 'available',
    route: '/daily#training',
  },
  {
    id: 'task-check-events',
    title: 'Controlla rivoluzioni / colpi di stato',
    description: 'Verifica eventi politici nella tua regione',
    icon: '🔥',
    status: 'completed',
  },
  {
    id: 'task-military-training',
    title: 'Addestramento militare',
    description: 'Avvia l\'addestramento se non ci sono eventi',
    icon: '🎯',
    status: 'cooldown',
    cooldownEndsAt: Date.now() + 3600000 * 6,
  },
  {
    id: 'task-academy',
    title: 'Costruisci accademia militare',
    description: 'Costruisci l\'accademia nella tua regione',
    icon: '🎖️',
    status: 'available',
    route: '/daily#academy',
  },
  {
    id: 'task-perks',
    title: 'Controlla perks migliorabili',
    description: 'Puoi migliorare una perk oggi!',
    icon: '📈',
    status: 'available',
    route: '/daily#perks',
  },
  {
    id: 'task-free-rewards',
    title: 'Riscatta reward gratuiti',
    description: 'Hai 2 reward gratuiti disponibili',
    icon: '🎁',
    status: 'available',
    route: '/daily#rewards',
  },
  {
    id: 'task-streak',
    title: 'Verifica progressi medaglie/streak',
    description: 'Streak giorno 4/5 — continua!',
    icon: '🏅',
    status: 'completed',
  },
];

// ── Farming / Auto-Work ──────────────────────────────────

export const MOCK_AUTO_WORK: AutoWorkConfig = {
  resourceType: 'gold_ore',
  active: false,
  startedAt: null,
  durationMs: 8 * 60 * 60 * 1000,
  estimatedYield: 1250,
  energyCost: 80,
};

export const MOCK_FARMING_BONUS: FarmingBonus = {
  regionHealth: 7,
  bonusMultiplier: 1.35,
  suggestion: 'La salute della tua regione è buona! +35% rendimento farming.',
};

export const MOCK_FARMING_RESOURCES: FarmingResourceEntry[] = [
  { resourceType: 'gold_ore', label: 'Oro', icon: '🥇', estimatedYield: 1250, energyCost: 80, bonusPercent: 35, recommended: true },
  { resourceType: 'oil', label: 'Petrolio', icon: '🛢️', estimatedYield: 890, energyCost: 60, bonusPercent: 35, recommended: false },
  { resourceType: 'minerals', label: 'Minerali', icon: '🪨', estimatedYield: 2340, energyCost: 60, bonusPercent: 35, recommended: false },
  { resourceType: 'uranium', label: 'Uranio', icon: '☢️', estimatedYield: 45, energyCost: 70, bonusPercent: 35, recommended: false },
  { resourceType: 'diamonds', label: 'Diamanti', icon: '💎', estimatedYield: 12, energyCost: 80, bonusPercent: 35, recommended: false },
  { resourceType: 'liquid_oxygen', label: 'Ossigeno Liquido', icon: '🧊', estimatedYield: 34, energyCost: 90, bonusPercent: 35, recommended: false },
  { resourceType: 'helium3', label: 'Elio-3', icon: '⚗️', estimatedYield: 7, energyCost: 90, bonusPercent: 35, recommended: false },
];

// ── Daily Damage / Training ──────────────────────────────

export const MOCK_DAMAGE_TARGETS: DamageTarget[] = [
  {
    id: 'target-training',
    type: 'military_training',
    label: 'Addestramento Militare',
    description: 'Allena le tue truppe per aumentare il livello',
    xpGain: 50,
    recommended: true,
  },
  {
    id: 'target-revolution',
    type: 'revolution_defense',
    label: 'Difesa Rivoluzione',
    description: 'Nessuna rivoluzione attiva nella tua regione',
    xpGain: 75,
    recommended: false,
  },
  {
    id: 'target-coup',
    type: 'coup_defense',
    label: 'Difesa Colpo di Stato',
    description: 'Nessun colpo di stato in corso',
    xpGain: 100,
    recommended: false,
  },
];

export const MOCK_DAILY_DAMAGE: DailyDamageState = {
  available: true,
  nextAvailableAt: Date.now() + 3600000 * 18,
  currentXp: 4850,
  currentLevel: 12,
  xpToNextLevel: 5400,
  maxDamagePotential: 1800,
  activeEvents: MOCK_DAMAGE_TARGETS,
  recommendedTarget: 'target-training',
};

// ── Military Academy ──────────────────────────────────

export const MOCK_ACADEMY_REWARDS: AcademyReward[] = [
  { type: 'energy_bottles', label: 'Bottiglie Energetiche', amount: 5, icon: '🍾' },
  { type: 'gold', label: 'Oro', amount: 2, icon: '🪙' },
];

export const MOCK_ACADEMY_STATE: AcademyState = {
  built: false,
  canBuild: true,
  isInResidenceRegion: true,
  nextBuildAt: Date.now() - 1000,
  rewards: MOCK_ACADEMY_REWARDS,
};

// ── Perks Upgrade ──────────────────────────────────

export const MOCK_PERK_ENTRIES: PerkUpgradeEntry[] = [
  {
    perkId: 'FORZA',
    name: 'Forza',
    icon: '⚔️',
    currentLevel: 15,
    upgradeCost: { money: 7500, gold: 75 },
    bonusDescription: '+5% danno in guerra / livello',
    tag: 'militare',
    canUpgrade: true,
  },
  {
    perkId: 'ISTRUZIONE',
    name: 'Istruzione',
    icon: '📚',
    currentLevel: 8,
    upgradeCost: { money: 4000, gold: 40 },
    bonusDescription: '+XP massimo lavorativo / livello',
    tag: 'strategica',
    canUpgrade: true,
  },
  {
    perkId: 'RESISTENZA',
    name: 'Resistenza',
    icon: '🛡️',
    currentLevel: 22,
    upgradeCost: { money: 11000, gold: 110 },
    bonusDescription: 'Riduce energia al lavoro',
    tag: 'farming',
    canUpgrade: false,
  },
];

// ── Free Rewards / Bottles ──────────────────────────────

export const MOCK_FREE_REWARDS: FreeRewardEntry[] = [
  {
    id: 'reward-academy-today',
    source: 'academy',
    sourceLabel: 'Accademia Militare',
    type: 'energy_bottles',
    amount: 5,
    claimedAt: null,
    icon: '🎖️',
  },
  {
    id: 'reward-streak-3',
    source: 'streak',
    sourceLabel: 'Streak 3 giorni',
    type: 'energy_bottles',
    amount: 2,
    claimedAt: Date.now() - 86400000,
    icon: '🔥',
  },
  {
    id: 'reward-medal-work',
    source: 'work_medal',
    sourceLabel: 'Medaglia Lavoro',
    type: 'gold',
    amount: 1,
    claimedAt: null,
    icon: '🏅',
  },
  {
    id: 'reward-periodic-7',
    source: 'periodic',
    sourceLabel: 'Bonus 7 giorni',
    type: 'energy_bottles',
    amount: 5,
    claimedAt: Date.now() - 172800000,
    icon: '📅',
  },
];

export const MOCK_WORK_STREAK: WorkStreak = {
  currentStreak: 4,
  longestStreak: 12,
  lastWorkDate: new Date().toISOString().slice(0, 10),
  milestones: [
    { days: 3, reward: { type: 'energy_bottles', label: 'Bottiglie', amount: 2, icon: '🍾' }, claimed: true },
    { days: 5, reward: { type: 'energy_bottles', label: 'Bottiglie', amount: 3, icon: '🍾' }, claimed: false },
    { days: 7, reward: { type: 'energy_bottles', label: 'Bottiglie', amount: 5, icon: '🍾' }, claimed: false },
    { days: 14, reward: { type: 'gold', label: 'Oro', amount: 5, icon: '🪙' }, claimed: false },
    { days: 30, reward: { type: 'energy_bottles', label: 'Bottiglie', amount: 25, icon: '🍾' }, claimed: false },
  ],
};

export const MOCK_PERIODIC_REWARDS: PeriodicRewardProgress[] = [
  {
    id: 'periodic-weekly',
    label: 'Bonus Settimanale',
    totalDaysRequired: 7,
    daysCompleted: 4,
    reward: { type: 'energy_bottles', label: 'Bottiglie', amount: 5, icon: '🍾' },
    claimed: false,
  },
  {
    id: 'periodic-monthly',
    label: 'Bonus Mensile',
    totalDaysRequired: 30,
    daysCompleted: 18,
    reward: { type: 'gold', label: 'Oro', amount: 10, icon: '🪙' },
    claimed: false,
  },
];

export const MOCK_BOTTLE_VALUE: BottleValueBreakdown = {
  autoWorkHours: 2.5,
  maxDamagePotential: 450,
  goldFarmEquivalent: 125,
};
