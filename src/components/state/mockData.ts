/**
 * Mock data for the State page.
 * Provides realistic sample data for development and fallback when backend is not connected.
 * All data structures are designed to match future Supabase schema.
 */

/** Informazioni su un singolo dipartimento di Stato */
export interface DepartmentInfo {
  id: string;            // es. 'oil', 'tank'
  label: string;         // es. 'Petrolio', 'Carri Armati'
  icon: string;          // emoji
  category: 'resource' | 'military';
  score: number;         // punti totali accumulati
  rank: number;          // posizione globale (1 = primo)
  bonusMultiplier: number; // bonus preparato (0.08 = +8%)
}

/** State identity and basic info */
export interface StateData {
  id: string;
  name: string;
  flag: string;
  flagUrl?: string;
  representativeImage?: string;
  regionCount: number;
  population: number;
  governmentForm: string;
  headOfState?: {
    name: string;
    role: string;
    avatar?: string;
    salaryGold?: number;
  };
  economyMinister?: {
    name: string;
    role: string;
    avatar?: string;
    salaryGold?: number;
  };
  foreignMinister?: {
    name: string;
    role: string;
    avatar?: string;
    salaryGold?: number;
  };
  geopoliticalBloc?: string;
  stats: {
    citizens: number;
    residents: number;
    parties: number;
    factories: number;
  };
  treasury: {
    balance: number;
    dailyIncome: number;
    dailyExpenses: number;
    netBalance: number;
    resources?: Record<string, number>;
  };
  details: {
    workPermits: number;
    mandateStart: string;
    nextElections: string;
    autonomies: number;
    entryTax: number;
    borders: string;
    residenceToWork: string;
    residence: string;
    energyProduction: number;
    energyConsumption: number;
    foundationDate: string;
    ongoingWars: number;
  };
  bestDepartment?: {
    name: string;
    value: number;
  };
  regions: Array<{
    id: string;
    name: string;
    population: number;
    mainResource?: string;
    developmentLevel?: number;
    governor?: string;
  }>;
  militaryAgreements: Array<{
    type: 'alliance' | 'defense_pact' | 'bilateral' | 'coalition';
    partnerName: string;
    partnerFlag?: string;
    status?: string;
    expiresAt?: string;
  }>;
  migrationAgreements: Array<{
    partnerName: string;
    partnerFlag?: string;
    status?: string;
  }>;
  sanctions: Array<{
    type: 'sanction_received' | 'sanction_imposed';
    partnerName: string;
    partnerFlag?: string;
    status?: string;
    expiresAt?: string;
  }>;
}

/** Default mock state data - realistic Italian state example */
export const MOCK_STATE_DATA: StateData = {
  id: 'IT',
  name: 'Repubblica Italiana',
  flag: '🇮🇹',
  flagUrl: 'https://flagcdn.com/it.svg',
  representativeImage: undefined,
  regionCount: 6,
  population: 1243500,
  governmentForm: 'Repubblica Parlamentare',
  headOfState: {
    name: 'Marco Bianchi',
    role: 'Capo di Stato e Comandante',
    salaryGold: 125000,
  },
  economyMinister: {
    name: 'Giulia Rossi',
    role: "Ministro dell'Economia",
    salaryGold: 85000,
  },
  foreignMinister: {
    name: 'Alessandro Verdi',
    role: 'Ministro degli Esteri',
    salaryGold: 85000,
  },
  geopoliticalBloc: 'Unione Europea',
  stats: {
    citizens: 1247,
    residents: 983,
    parties: 12,
    factories: 87,
  },
  treasury: {
    balance: 15420000,
    dailyIncome: 2350000,
    dailyExpenses: 1890000,
    netBalance: 460000,
    resources: {
      oil: 150000,
      minerals: 450000,
      uranium: 1200,
      gold_ore: 500,
    },
  },
  details: {
    workPermits: 79,
    mandateStart: '12 Marzo 2026 13:50',
    nextElections: '21 Marzo 2026 13:50',
    autonomies: 5,
    entryTax: 592305146,
    borders: 'Chiuso',
    residenceToWork: 'Necessaria',
    residence: 'Concessa dal Capo di Stato',
    energyProduction: 101260,
    energyConsumption: 92966,
    foundationDate: '11 Maggio 2022 05:36',
    ongoingWars: 1,
  },
  bestDepartment: {
    name: 'oro',
    value: 1620,
  },
  regions: [
    { id: 'IT-RM', name: 'Lazio', population: 312, mainResource: 'Oro', developmentLevel: 7, governor: 'Mario R.' },
    { id: 'IT-MI', name: 'Lombardia', population: 289, mainResource: 'Minerali', developmentLevel: 8, governor: 'Luigi V.' },
    { id: 'IT-NA', name: 'Campania', population: 198, mainResource: 'Petrolio', developmentLevel: 5 },
    { id: 'IT-TO', name: 'Piemonte', population: 156, mainResource: 'Uranio', developmentLevel: 6, governor: 'Anna B.' },
    { id: 'IT-FI', name: 'Toscana', population: 178, mainResource: 'Diamanti', developmentLevel: 6 },
    { id: 'IT-PA', name: 'Sicilia', population: 114, mainResource: 'Oro', developmentLevel: 4 },
  ],
  militaryAgreements: [
    { type: 'alliance', partnerName: 'Francia', partnerFlag: '🇫🇷', status: 'Attivo' },
    { type: 'defense_pact', partnerName: 'Germania', partnerFlag: '🇩🇪', status: 'Attivo' },
  ],
  migrationAgreements: [],
  sanctions: [],
};

/** Empty state data for testing fallback UI */
export const EMPTY_STATE_DATA: StateData = {
  id: 'XX',
  name: 'Stato Sconosciuto',
  flag: '🌍',
  regionCount: 0,
  population: 0,
  governmentForm: 'Non definito',
  stats: {
    citizens: 0,
    residents: 0,
    parties: 0,
    factories: 0,
  },
  treasury: {
    balance: 0,
    dailyIncome: 0,
    dailyExpenses: 0,
    netBalance: 0,
    resources: {},
  },
  details: {
    workPermits: 0,
    mandateStart: '-',
    nextElections: '-',
    autonomies: 0,
    entryTax: 0,
    borders: '-',
    residenceToWork: '-',
    residence: '-',
    energyProduction: 0,
    energyConsumption: 0,
    foundationDate: '-',
    ongoingWars: 0,
  },
  regions: [],
  militaryAgreements: [],
  migrationAgreements: [],
  sanctions: [],
};
