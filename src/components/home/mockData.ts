/**
 * Mock data for the Home Dashboard components.
 * These fixtures provide realistic sample data for development and testing.
 * Replace with actual API calls when backend is ready.
 */

export interface WorldStats {
  totalPlayers: number;
  onlinePlayers: number;
  totalRegions: number;
  totalStates: number;
  totalBlocs: number;
  independentRegions: number;
  totalParties: number;
  totalFactories: number;
}

export interface RegionStats {
  id: string;
  name: string;
  population: number;
  parties: number;
  factories: number;
  pollution: number;
  militaryAcademies: number;
  onlinePlayers: number;
  health: number;
  stability: number;
}

export interface StateStats {
  iso2: string;
  name: string;
  population: number;
  parties: number;
  factories: number;
  regions: number;
  leader: string;
  leaderSalary: number;
  governmentForm: string;
  capital: string;
  onlinePlayers: number;
  currentOrders: string;
}

export interface PendingLaw {
  id: string;
  title: string;
  description: string;
  target: string;
  cost: number;
  proposedBy: string;
  votesFor: number;
  votesAgainst: number;
  abstentions: number;
  totalVoters: number;
  endsAt: number;
  status: 'pending' | 'approved' | 'rejected';
}

export interface ActiveWar {
  id: string;
  attackerName: string;
  attackerIso2: string;
  defenderName: string;
  defenderIso2: string;
  attackerDamage: number;
  defenderDamage: number;
  endsAt: number;
  regionName: string;
}

export interface PartyInfo {
  id: string;
  name: string;
  members: number;
  logo: string;
}

export interface PlayerResources {
  gold: number;
  oil: number;
  minerals: number;
  uranium: number;
  diamonds: number;
  energyDrinks: number;
  liquidOxygen: number;
  helium3: number;
}

export interface SoldierOfTheHour {
  username: string;
  damage: number;
  regionId: string;
}

export interface GameEvent {
  id: string;
  type: 'law_proposed' | 'law_approved' | 'law_rejected' | 'war_started' | 'war_ended' | 'conquest' | 'treasury_transfer' | 'revolution' | 'government_change' | 'election';
  title: string;
  description: string;
  values?: string;
  timestamp: number;
  icon: string;
}

// --- Mock Data ---

export const MOCK_WORLD_STATS: WorldStats = {
  totalPlayers: 12847,
  onlinePlayers: 342,
  totalRegions: 856,
  totalStates: 194,
  totalBlocs: 23,
  independentRegions: 47,
  totalParties: 312,
  totalFactories: 4521,
};

export const MOCK_REGION_STATS: RegionStats = {
  id: 'IT-RM',
  name: 'Lazio',
  population: 1245,
  parties: 8,
  factories: 34,
  pollution: 23,
  militaryAcademies: 3,
  onlinePlayers: 18,
  health: 7,
  stability: 8,
};

export const MOCK_STATE_STATS: StateStats = {
  iso2: 'IT',
  name: 'Italia',
  population: 8432,
  parties: 42,
  factories: 187,
  regions: 20,
  leader: 'GiulioMaximus',
  leaderSalary: 25000,
  governmentForm: 'Repubblica Parlamentare',
  capital: 'Lazio',
  onlinePlayers: 67,
  currentOrders: 'Concentrare le forze sulla difesa del confine nord-est. Priorità produzione uranio. Alleanza con FR attiva.',
};

export const MOCK_PENDING_LAWS: PendingLaw[] = [
  {
    id: 'law-1',
    title: 'Aumento budget difesa',
    description: 'Trasferimento di 500.000€ al budget militare regionale',
    target: 'Budget Militare',
    cost: 500000,
    proposedBy: 'GiulioMaximus',
    votesFor: 45,
    votesAgainst: 12,
    abstentions: 8,
    totalVoters: 100,
    endsAt: Date.now() + 3600000 * 4,
    status: 'pending',
  },
  {
    id: 'law-2',
    title: 'Costruzione ospedale regionale',
    description: 'Approvazione costruzione di un nuovo ospedale nella regione di Lazio',
    target: 'Infrastruttura Sanitaria',
    cost: 1200000,
    proposedBy: 'MarcoSenatore',
    votesFor: 30,
    votesAgainst: 25,
    abstentions: 5,
    totalVoters: 100,
    endsAt: Date.now() + 3600000 * 8,
    status: 'pending',
  },
];

export const MOCK_ACTIVE_WARS: ActiveWar[] = [
  {
    id: 'war-1',
    attackerName: 'Francia',
    attackerIso2: 'FR',
    defenderName: 'Italia',
    defenderIso2: 'IT',
    attackerDamage: 1245890,
    defenderDamage: 987340,
    endsAt: Date.now() + 3600000 * 2,
    regionName: 'Piemonte',
  },
  {
    id: 'war-2',
    attackerName: 'Germania',
    attackerIso2: 'DE',
    defenderName: 'Polonia',
    defenderIso2: 'PL',
    attackerDamage: 543210,
    defenderDamage: 612340,
    endsAt: Date.now() + 3600000 * 5,
    regionName: 'Slesia',
  },
];

export const MOCK_PARTY: PartyInfo = {
  id: 'party-1',
  name: 'Partito della Libertà',
  members: 156,
  logo: '🦅',
};

export const MOCK_RESOURCES: PlayerResources = {
  gold: 1240,
  oil: 890,
  minerals: 2340,
  uranium: 45,
  diamonds: 12,
  energyDrinks: 8,
  liquidOxygen: 34,
  helium3: 7,
};

export const MOCK_SOLDIER_OF_HOUR: SoldierOfTheHour = {
  username: 'WarriorX99',
  damage: 234567,
  regionId: 'IT-RM',
};

export const MOCK_EVENTS: GameEvent[] = [
  {
    id: 'evt-1',
    type: 'war_started',
    title: 'Guerra dichiarata: Francia → Italia',
    description: 'La Francia ha dichiarato guerra al Piemonte italiano',
    timestamp: Date.now() - 3600000,
    icon: '⚔️',
  },
  {
    id: 'evt-2',
    type: 'law_approved',
    title: 'Legge approvata: Aumento tasse',
    description: 'Il parlamento italiano ha approvato l\'aumento delle tasse commerciali al 12%',
    values: '+12% tasse',
    timestamp: Date.now() - 7200000,
    icon: '📜',
  },
  {
    id: 'evt-3',
    type: 'conquest',
    title: 'Conquista: Corsica',
    description: 'L\'Italia ha conquistato la regione della Corsica dalla Francia',
    timestamp: Date.now() - 14400000,
    icon: '🏴',
  },
  {
    id: 'evt-4',
    type: 'treasury_transfer',
    title: 'Trasferimento tesoro',
    description: 'Trasferimento di 1.500.000€ dal tesoro nazionale al budget militare',
    values: '€1,500,000',
    timestamp: Date.now() - 21600000,
    icon: '💰',
  },
  {
    id: 'evt-5',
    type: 'election',
    title: 'Elezioni: Nuovo presidente Francia',
    description: 'NapoleonRedux eletto presidente della Francia con il 67% dei voti',
    timestamp: Date.now() - 28800000,
    icon: '🗳️',
  },
  {
    id: 'evt-6',
    type: 'revolution',
    title: 'Rivoluzione in Egitto',
    description: 'Un colpo di stato ha rovesciato il governo egiziano',
    timestamp: Date.now() - 43200000,
    icon: '🔥',
  },
];
