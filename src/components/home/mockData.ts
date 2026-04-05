/**
 * Type definitions and default (empty/zero) data for the Home Dashboard components.
 * Default values show realistic zeros when no real data is available.
 * Replace with actual API calls when backend endpoints are ready.
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
  attackerDisplayName?: string;
  attackerDisplayIcon?: string | null;
  attackerDisplayIconType?: 'state' | 'region';
  defenderDisplayName?: string;
  defenderDisplayIcon?: string | null;
  defenderDisplayIconType?: 'state' | 'region';
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
  targetId?: string;
  timestamp: number;
  icon: string;
}

// --- Default Data (zeros / empty) ---

export const DEFAULT_WORLD_STATS: WorldStats = {
  totalPlayers: 0,
  onlinePlayers: 0,
  totalRegions: 0,
  totalStates: 0,
  totalBlocs: 0,
  independentRegions: 0,
  totalParties: 0,
  totalFactories: 0,
};

export const DEFAULT_REGION_STATS: RegionStats = {
  id: '',
  name: 'N/A',
  population: 0,
  parties: 0,
  factories: 0,
  pollution: 0,
  militaryAcademies: 0,
  onlinePlayers: 0,
  health: 0,
  stability: 0,
};

export const DEFAULT_STATE_STATS: StateStats = {
  iso2: '',
  name: 'N/A',
  population: 0,
  parties: 0,
  factories: 0,
  regions: 0,
  leader: '',
  leaderSalary: 0,
  governmentForm: '',
  capital: '',
  onlinePlayers: 0,
  currentOrders: '',
};

export const EMPTY_PENDING_LAWS: PendingLaw[] = [];

export const EMPTY_ACTIVE_WARS: ActiveWar[] = [];

export const EMPTY_PARTY: PartyInfo | null = null;

export const DEFAULT_RESOURCES: PlayerResources = {
  gold: 0,
  oil: 0,
  minerals: 0,
  uranium: 0,
  diamonds: 0,
  energyDrinks: 0,
  liquidOxygen: 0,
  helium3: 0,
};

export const EMPTY_SOLDIER_OF_HOUR: SoldierOfTheHour | null = null;

export const EMPTY_EVENTS: GameEvent[] = [];
