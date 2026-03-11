/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

console.log("Starting server.ts...");

import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import jwt from "jsonwebtoken";
import cookieParser from "cookie-parser";
import * as admin from "firebase-admin";
import { GAME_CONFIG, PERKS_DEFS, BOOSTER_CONFIG } from "./src/types";
import { getFirestore } from "firebase-admin/firestore";

const app = express();
const PORT = 3000;
const SECRET_KEY = "territorial-secret-key";

// Seeded Random Helper
const seededRandom = (seed: string) => {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) - hash) + seed.charCodeAt(i);
    hash |= 0;
  }
  return () => {
    hash = (hash * 16807) % 2147483647;
    return (hash - 1) / 2147483646;
  };
};

const generateGameStatsForCountry = (iso2: string) => {
  const rng = seededRandom(iso2);
  const resourceTypes = ["Oil", "Steel", "Food", "Tech", "Uranium"];
  const numResources = 1 + Math.floor(rng() * 3);
  const selectedResources = [];
  const shuffled = [...resourceTypes].sort(() => rng() - 0.5);

  const getIndicator = () => 1 + Math.floor(rng() * 10); // 1-10

  for (let i = 0; i < numResources; i++) {
    selectedResources.push({
      type: shuffled[i],
      base: 10 + Math.floor(rng() * 90)
    });
  }

  return {
    indicators: {
      health: getIndicator(),
      education: getIndicator(),
      industry: getIndicator(),
      security: getIndicator(),
      infrastructure: getIndicator(),
      morale: getIndicator(),
      economy: getIndicator(),
      tech: getIndicator(),
      resourcesQuality: getIndicator(),
      stability: getIndicator()
    },
    resources: selectedResources,
  };
};

// Initialize Firebase Admin
if (process.env.FIREBASE_PROJECT_ID) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  });
}

// Database initialization
let db: Database.Database;
try {
  db = new Database("game.db");
  console.log("Database connection successful.");

  // Handle graceful shutdown to release database locks
  const shutdown = () => {
    console.log("Shutting down safely...");
    if (db) {
      try { db.close(); } catch (e) { }
    }
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
} catch (err) {
  console.error("FATAL ERROR: Failed to open database 'game.db'. Is it locked by another process?", err);
  process.exit(1);
}

// Migration: Add email and firebase_uid if they don't exist
const addColumnIfMissing = (table: string, column: string, type: string) => {
  try {
    const info = db.pragma(`table_info(${table})`) as any[];
    if (!info.find(c => c.name === column)) {
      db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`);
      console.log(`Migration SUCCESS: Added ${column} to ${table}`);
    }
  } catch (e: any) {
    console.error(`Migration ERROR [${table}.${column}]:`, e.message);
  }
};

addColumnIfMissing("users", "email", "TEXT UNIQUE");
addColumnIfMissing("users", "firebase_uid", "TEXT UNIQUE");
addColumnIfMissing("users", "gold", "INTEGER DEFAULT 0");
addColumnIfMissing("users", "avatarData", "TEXT");
addColumnIfMissing("users", "perkUpgradesJson", "TEXT DEFAULT '{}'");
addColumnIfMissing("users", "boostersJson", "TEXT DEFAULT '{}'");
addColumnIfMissing("player_factories", "regionId", "TEXT");

// Regions migrations
addColumnIfMissing("regions", "treasury", "INTEGER DEFAULT 0");
addColumnIfMissing("regions", "economyLevel", "INTEGER DEFAULT 1");
addColumnIfMissing("regions", "health", "INTEGER DEFAULT 1");
addColumnIfMissing("regions", "education", "INTEGER DEFAULT 1");
addColumnIfMissing("regions", "military", "INTEGER DEFAULT 1");
addColumnIfMissing("regions", "dictatorship", "INTEGER DEFAULT 0");
addColumnIfMissing("regions", "foundationDate", "INTEGER DEFAULT 0");
addColumnIfMissing("regions", "parliamentSize", "INTEGER DEFAULT 20");
addColumnIfMissing("regions", "parliamentDuration", "INTEGER DEFAULT 5");
addColumnIfMissing("regions", "residencePolicy", "TEXT DEFAULT 'open'");
addColumnIfMissing("regions", "travelFee", "INTEGER DEFAULT 0");
addColumnIfMissing("regions", "radiation", "INTEGER DEFAULT 0");

// Government Forms migrations
addColumnIfMissing("regions", "governmentForm", "TEXT DEFAULT 'PARLIAMENTARY_REPUBLIC'");
addColumnIfMissing("regions", "economicAdviserId", "TEXT");
addColumnIfMissing("regions", "foreignMinisterId", "TEXT");
addColumnIfMissing("regions", "dictatorshipAttempts", "INTEGER DEFAULT 0");
addColumnIfMissing("regions", "leaderUserId", "TEXT");
addColumnIfMissing("regions", "leaderTitle", "TEXT DEFAULT 'Leader'");
addColumnIfMissing("regions", "stateColor", "TEXT DEFAULT '#334155'");
addColumnIfMissing("regions", "stateHymn", "TEXT");
addColumnIfMissing("regions", "nextLeaderElectionAt", "INTEGER");
addColumnIfMissing("regions", "nationId", "TEXT");

// Energy Drinks and War Medals migrations
addColumnIfMissing("users", "energyDrinks", "INTEGER DEFAULT 0");
addColumnIfMissing("users", "lastEnergyDrink", "INTEGER DEFAULT 0");
addColumnIfMissing("users", "warMedals", "INTEGER DEFAULT 0");
addColumnIfMissing("users", "lastMedalClaim", "INTEGER DEFAULT 0");

// Residence and Permits migrations
addColumnIfMissing("users", "residenceId", "TEXT DEFAULT 'ST'");
addColumnIfMissing("users", "workPermitId", "TEXT");
addColumnIfMissing("regions", "workRestrictions", "INTEGER DEFAULT 0");

// Nations migrations (Rival Regions style)
addColumnIfMissing("users", "originalNation", "TEXT DEFAULT 'ST'");
addColumnIfMissing("users", "displayedNation", "TEXT DEFAULT 'ST'");
addColumnIfMissing("users", "lastOriginalNationChange", "INTEGER DEFAULT 0");

// Laws migrations
addColumnIfMissing("laws", "params", "TEXT");

// Activity Tracking
addColumnIfMissing("users", "lastLogin", "INTEGER DEFAULT 0");

// Market migrations
addColumnIfMissing("regions", "marketTaxRate", "INTEGER DEFAULT 10");
addColumnIfMissing("regions", "sanctionsActive", "INTEGER DEFAULT 0");
addColumnIfMissing("regions", "sanctionsScope", "TEXT DEFAULT '{}'");
addColumnIfMissing("market_offers", "originStateId", "TEXT");
addColumnIfMissing("bloc_regulations", "migrationOpen", "INTEGER DEFAULT 0");
addColumnIfMissing("migration_agreements", "activatedAt", "INTEGER");
addColumnIfMissing("migration_agreements", "revokedAt", "INTEGER");
addColumnIfMissing("migration_agreements", "sourceLawId", "TEXT");
addColumnIfMissing("laws", "targetStateId", "TEXT");
addColumnIfMissing("laws", "decidedAt", "INTEGER");

// Rename ownerId to ownerUserId if needed
try {
  const info = db.pragma("table_info(regions)") as any[];
  if (info.find(c => c.name === "ownerId") && !info.find(c => c.name === "ownerUserId")) {
    db.exec("ALTER TABLE regions RENAME COLUMN ownerId TO ownerUserId");
    console.log("Migration SUCCESS: renamed regions.ownerId to ownerUserId");
  }
} catch (e) { }

// Perks Migration: Rename old IDs to new ones
try {
  db.prepare("UPDATE perks SET perkId = 'FORZA' WHERE perkId = 'war_tactics'").run();
  db.prepare("UPDATE perks SET perkId = 'ISTRUZIONE' WHERE perkId = 'work_boost'").run();
  db.prepare("UPDATE perks SET perkId = 'RESISTENZA' WHERE perkId = 'regen_boost'").run();
  // Rename from intermediate IDs
  db.prepare("UPDATE perks SET perkId = 'ISTRUZIONE' WHERE perkId = 'EDUCAZIONE'").run();
  db.prepare("UPDATE perks SET perkId = 'RESISTENZA' WHERE perkId = 'LOGISTICA'").run();
  // Remove obsolete INDUSTRIA perk (now incorporated or deleted)
  db.prepare("DELETE FROM perks WHERE perkId = 'INDUSTRIA' OR perkId = 'energy_efficiency'").run();
} catch (e) {
  console.error("Migration error (perks rename):", e);
}

// Gold currency migration
try {
  db.exec("ALTER TABLE users ADD COLUMN gold INTEGER DEFAULT 0");
} catch (e) { }

// Avatar migration
try {
  db.exec("ALTER TABLE users ADD COLUMN avatarData TEXT");
} catch (e) { }

// perkUpgradesJson migration — stores active upgrade timers locally
try {
  db.exec("ALTER TABLE users ADD COLUMN perkUpgradesJson TEXT DEFAULT '{}'");
} catch (e) { }

// boostersJson migration — stores active boosters and cooldowns
try {
  db.exec("ALTER TABLE users ADD COLUMN boostersJson TEXT DEFAULT '{}'");
} catch (e) { }

// Migration for Migration Agreements
// Nations (Global States) table
try {
  db.exec(`CREATE TABLE IF NOT EXISTS nations (
    id TEXT PRIMARY KEY,
    name TEXT,
    logo TEXT DEFAULT '🏛️',
    capitalRegionId TEXT,
    leaderUserId TEXT,
    createdAt INTEGER,
    updatedAt INTEGER,
    FOREIGN KEY(capitalRegionId) REFERENCES regions(id),
    FOREIGN KEY(leaderUserId) REFERENCES users(id)
  )`);
} catch (e) { }


// Fix user_factory_cooldowns FK issue by recreating if needed or just ignoring if already fixed
try {
  // Drop and recreate if it has the FK issue (simplified for this migration)
  // In a real app we'd rename and copy, but here we can just ensure it's clean
  db.exec(`CREATE TABLE IF NOT EXISTS user_factory_cooldowns (
    userId TEXT,
    factoryId TEXT,
    lastUsed INTEGER,
    PRIMARY KEY(userId, factoryId),
    FOREIGN KEY(userId) REFERENCES users(id)
  )`);
} catch (e) { }

// Player factories migration
try {
  db.exec(`CREATE TABLE IF NOT EXISTS player_factories (
    id TEXT PRIMARY KEY,
    ownerId TEXT,
    ownerName TEXT,
    name TEXT,
    icon TEXT DEFAULT '🏭',
    level INTEGER DEFAULT 1,
    payoutBase INTEGER DEFAULT 80,
    energyCost INTEGER DEFAULT 8,
    cooldownSec INTEGER DEFAULT 90,
    regionId TEXT,
    createdAt INTEGER,
    FOREIGN KEY(ownerId) REFERENCES users(id),
    FOREIGN KEY(regionId) REFERENCES regions(id)
  )`);
} catch (e) { }

// Migration: add regionId to player_factories if not exists
try {
  db.exec("ALTER TABLE player_factories ADD COLUMN regionId TEXT");
} catch (e) { }


// User requests: 10000 cash and 10000 gold
try {
  db.prepare("UPDATE users SET money = money + 10000, gold = gold + 10000 WHERE username = 'testuser'").run();
  console.log("User 'testuser' resources updated.");
} catch (e) { }

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE,
    email TEXT UNIQUE,
    firebase_uid TEXT UNIQUE,
    password TEXT,
    money INTEGER DEFAULT 1000,
    gold INTEGER DEFAULT 0,
    energy INTEGER DEFAULT 100,
    influence INTEGER DEFAULT 0,
    regionId TEXT DEFAULT 'IT',
    lastEnergyUpdate INTEGER,
    xp INTEGER DEFAULT 0,
    level INTEGER DEFAULT 1,
    perkPoints INTEGER DEFAULT 0,
    energyDrinks INTEGER DEFAULT 0,
    inventory TEXT DEFAULT '{}',
    lastEnergyDrink INTEGER DEFAULT 0,
    warMedals INTEGER DEFAULT 0,
    lastMedalClaim INTEGER DEFAULT 0,
    residenceId TEXT DEFAULT 'ST',
    workPermitId TEXT,
    originalNation TEXT DEFAULT 'ST',
    displayedNation TEXT DEFAULT 'ST',
    lastOriginalNationChange INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS perks (
    userId TEXT,
    perkId TEXT,
    level INTEGER DEFAULT 0,
    PRIMARY KEY(userId, perkId),
    FOREIGN KEY(userId) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS regions (
    id TEXT PRIMARY KEY, -- ISO Code
    name TEXT UNIQUE,
    population INTEGER DEFAULT 1000000,
    resources INTEGER DEFAULT 50,
    stability INTEGER DEFAULT 10,
    taxes INTEGER DEFAULT 10,
    treasury INTEGER DEFAULT 0,
    economyLevel INTEGER DEFAULT 1,
    health INTEGER DEFAULT 1,
    education INTEGER DEFAULT 1,
    military INTEGER DEFAULT 1,
    marketTaxRate INTEGER DEFAULT 10,
    oilBonus REAL DEFAULT 1.0,
    mineralsBonus REAL DEFAULT 1.0,
    uraniumBonus REAL DEFAULT 1.0,
    diamondsBonus REAL DEFAULT 1.0,
    ownerUserId TEXT,
    dictatorship INTEGER DEFAULT 0,
    foundationDate INTEGER DEFAULT 0,
    parliamentSize INTEGER DEFAULT 20,
    parliamentDuration INTEGER DEFAULT 5,
    residencePolicy TEXT DEFAULT 'open',
    governmentForm TEXT DEFAULT 'PARLIAMENTARY_REPUBLIC',
    economicAdviserId TEXT,
    foreignMinisterId TEXT,
    dictatorshipAttempts INTEGER DEFAULT 0,
    nationId TEXT,
    ownerUserId TEXT,
    FOREIGN KEY(ownerUserId) REFERENCES users(id),
    FOREIGN KEY(nationId) REFERENCES nations(id)
  );

  CREATE TABLE IF NOT EXISTS factories (
    id TEXT PRIMARY KEY,
    name TEXT,
    type TEXT, -- 'oil', 'minerals', 'uranium', 'diamonds'
    regionId TEXT,
    ownerUserId TEXT,
    level INTEGER DEFAULT 1,
    exp INTEGER DEFAULT 0,
    wage INTEGER DEFAULT 10,
    budget INTEGER DEFAULT 0,
    createdAt INTEGER
  );

  CREATE TABLE IF NOT EXISTS user_factory_cooldowns (
    userId TEXT,
    factoryId TEXT,
    lastUsed INTEGER,
    PRIMARY KEY(userId, factoryId),
    FOREIGN KEY(userId) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS user_inventory (
    userId TEXT,
    itemId TEXT,
    quantity INTEGER DEFAULT 0,
    PRIMARY KEY (userId, itemId)
  );

  CREATE TABLE IF NOT EXISTS state_inventory (
    regionId TEXT,
    itemId TEXT,
    quantity INTEGER DEFAULT 0,
    PRIMARY KEY (regionId, itemId)
  );

  CREATE TABLE IF NOT EXISTS market_offers (
    id TEXT PRIMARY KEY,
    sellerId TEXT,
    sellerName TEXT,
    itemId TEXT,
    quantity INTEGER,
    price INTEGER,
    regionId TEXT,
    taxRate INTEGER,
    createdAt INTEGER
  );

  CREATE TABLE IF NOT EXISTS market_transactions_log (
    id TEXT PRIMARY KEY,
    buyerId TEXT,
    isStateBuy INTEGER,
    sellerId TEXT,
    itemId TEXT,
    quantity INTEGER,
    price INTEGER,
    taxPaid INTEGER,
    timestamp INTEGER
  );

  CREATE TABLE IF NOT EXISTS articles (
    id TEXT PRIMARY KEY,
    authorId TEXT,
    authorName TEXT,
    regionId TEXT,
    title TEXT,
    content TEXT,
    createdAt INTEGER,
    likes INTEGER DEFAULT 0,
    FOREIGN KEY(authorId) REFERENCES users(id),
    FOREIGN KEY(regionId) REFERENCES regions(id)
  );

  CREATE TABLE IF NOT EXISTS production_queue (
    id TEXT PRIMARY KEY,
    userId TEXT,
    weaponType TEXT,
    qty INTEGER,
    status TEXT,
    startedAt INTEGER,
    willCompleteAt INTEGER,
    createdAt INTEGER
  );

  CREATE TABLE IF NOT EXISTS applications (
    id TEXT PRIMARY KEY,
    userId TEXT,
    username TEXT,
    regionId TEXT,
    type TEXT,       -- 'residence' or 'work_permit'
    status TEXT,     -- 'pending' or 'accepted' or 'rejected'
    createdAt INTEGER,
    FOREIGN KEY(userId) REFERENCES users(id),
    FOREIGN KEY(regionId) REFERENCES regions(id)
  );

  CREATE TABLE IF NOT EXISTS player_factories (
    id TEXT PRIMARY KEY,
    ownerId TEXT,
    ownerName TEXT,
    name TEXT,
    icon TEXT DEFAULT '🏭',
    level INTEGER DEFAULT 1,
    payoutBase INTEGER DEFAULT 80,
    energyCost INTEGER DEFAULT 8,
    cooldownSec INTEGER DEFAULT 90,
    regionId TEXT,
    createdAt INTEGER,
    FOREIGN KEY(ownerId) REFERENCES users(id),
    FOREIGN KEY(regionId) REFERENCES regions(id)
  );

  CREATE TABLE IF NOT EXISTS wars (
    id TEXT PRIMARY KEY,
    attackerCountryIso2 TEXT,
    defenderCountryIso2 TEXT,
    attackerUserId TEXT,
    defenderUserId TEXT,
    status TEXT, -- 'active' | 'ended'
    startedAt INTEGER,
    endsAt INTEGER,
    attackerScore INTEGER DEFAULT 0,
    defenderScore INTEGER DEFAULT 0,
    lastEventAt INTEGER,
    FOREIGN KEY(attackerUserId) REFERENCES users(id),
    FOREIGN KEY(defenderUserId) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS leader_orders (
    id TEXT PRIMARY KEY,
    regionId TEXT,
    authorUserId TEXT,
    title TEXT,
    body TEXT,
    createdAt INTEGER,
    audience TEXT, -- 'CITIZENS', 'NEW_PLAYERS', 'ALL'
    FOREIGN KEY(regionId) REFERENCES regions(id),
    FOREIGN KEY(authorUserId) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS leader_candidates (
    regionId TEXT,
    userId TEXT,
    votes INTEGER DEFAULT 0,
    PRIMARY KEY(regionId, userId),
    FOREIGN KEY(regionId) REFERENCES regions(id),
    FOREIGN KEY(userId) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS leader_votes (
    regionId TEXT,
    voterId TEXT,
    candidateId TEXT,
    PRIMARY KEY(regionId, voterId),
    FOREIGN KEY(regionId) REFERENCES regions(id),
    FOREIGN KEY(voterId) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS cooldowns (
    userId TEXT,
    actionType TEXT,
    lastUsed INTEGER,
    PRIMARY KEY(userId, actionType),
    FOREIGN KEY(userId) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS chat_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    userId TEXT,
    username TEXT,
    regionId TEXT,
    message TEXT,
    createdAt INTEGER,
    FOREIGN KEY(userId) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS parties (
    id TEXT PRIMARY KEY,
    name TEXT,
    ideology TEXT,
    tag TEXT,
    description TEXT,
    logo TEXT,
    regionId TEXT,
    leaderUserId TEXT,
    createdAt INTEGER
  );

  CREATE TABLE IF NOT EXISTS party_members (
    userId TEXT,
    partyId TEXT,
    role TEXT, -- 'leader', 'secretary', 'member'
    joinedAt INTEGER,
    salaryCash INTEGER DEFAULT 0,
    salaryGold INTEGER DEFAULT 0,
    PRIMARY KEY(userId),
    FOREIGN KEY(userId) REFERENCES users(id),
    FOREIGN KEY(partyId) REFERENCES parties(id)
  );

  CREATE TABLE IF NOT EXISTS party_invites (
    id TEXT PRIMARY KEY,
    partyId TEXT,
    userId TEXT,
    invitedBy TEXT,
    status TEXT, -- 'pending', 'accepted', 'rejected'
    createdAt INTEGER
  );

  CREATE TABLE IF NOT EXISTS party_primaries (
    id TEXT PRIMARY KEY,
    partyId TEXT,
    candidateId TEXT,
    voterId TEXT,
    createdAt INTEGER
  );

  CREATE TABLE IF NOT EXISTS party_logs (
    id TEXT PRIMARY KEY,
    partyId TEXT,
    action TEXT,
    details TEXT,
    timestamp INTEGER
  );

  CREATE TABLE IF NOT EXISTS elections (
    id TEXT PRIMARY KEY,
    regionId TEXT,
    status TEXT, -- 'active', 'closed'
    createdAt INTEGER,
    closesAt INTEGER
  );

  CREATE TABLE IF NOT EXISTS election_votes (
    id TEXT PRIMARY KEY,
    electionId TEXT,
    voterId TEXT,
    partyId TEXT,
    timestamp INTEGER,
    FOREIGN KEY(electionId) REFERENCES elections(id),
    FOREIGN KEY(voterId) REFERENCES users(id),
    FOREIGN KEY(partyId) REFERENCES parties(id)
  );

  CREATE TABLE IF NOT EXISTS parliament_members (
    userId TEXT PRIMARY KEY,
    regionId TEXT,
    partyId TEXT,
    electedAt INTEGER,
    FOREIGN KEY(userId) REFERENCES users(id),
    FOREIGN KEY(regionId) REFERENCES regions(id),
    FOREIGN KEY(partyId) REFERENCES parties(id)
  );

  CREATE TABLE IF NOT EXISTS laws (
    id TEXT PRIMARY KEY,
    regionId TEXT,
    proposerId TEXT,
    type TEXT, -- e.g. 'change_market_tax'
    newValue TEXT,
    params TEXT, -- JSON representation of law arguments
    status TEXT, -- 'pending', 'passed', 'rejected'
    createdAt INTEGER,
    expiresAt INTEGER,
    FOREIGN KEY(regionId) REFERENCES regions(id),
    FOREIGN KEY(proposerId) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS law_votes (
    id TEXT PRIMARY KEY,
    lawId TEXT,
    voterId TEXT,
    vote TEXT, -- 'yes', 'no'
    timestamp INTEGER,
    FOREIGN KEY(lawId) REFERENCES laws(id),
    FOREIGN KEY(voterId) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS budgets (
    id TEXT PRIMARY KEY,
    ownerType TEXT, -- 'REGION', 'AUTONOMY', 'STATE'
    ownerId TEXT,
    moneyEUR INTEGER DEFAULT 0,
    resources TEXT DEFAULT '{}',
    updatedAt INTEGER
  );

  CREATE TABLE IF NOT EXISTS budget_transactions (
    id TEXT PRIMARY KEY,
    budgetId TEXT,
    type TEXT, -- 'INCOME', 'EXPENSE', 'TRANSFER', 'WAR_LOOT', 'SYSTEM_TICK'
    subtype TEXT,
    moneyDelta INTEGER DEFAULT 0,
    resourcesDelta TEXT DEFAULT '{}',
    createdAt INTEGER,
    createdByUserId TEXT,
    metadata TEXT DEFAULT '{}',
    FOREIGN KEY(budgetId) REFERENCES budgets(id)
  );

  CREATE TABLE IF NOT EXISTS blocs (
    id TEXT PRIMARY KEY,
    name TEXT UNIQUE,
    logo TEXT,
    description TEXT,
    ownerStateId TEXT,
    createdAt INTEGER
  );

  CREATE TABLE IF NOT EXISTS bloc_memberships (
    blocId TEXT,
    stateId TEXT,
    status TEXT,
    joinedAt INTEGER,
    PRIMARY KEY(blocId, stateId),
    FOREIGN KEY(blocId) REFERENCES blocs(id),
    FOREIGN KEY(stateId) REFERENCES regions(id)
  );

  CREATE TABLE IF NOT EXISTS bloc_applications (
    id TEXT PRIMARY KEY,
    blocId TEXT,
    stateId TEXT,
    createdAt INTEGER,
    status TEXT,
    FOREIGN KEY(blocId) REFERENCES blocs(id),
    FOREIGN KEY(stateId) REFERENCES regions(id)
  );

  CREATE TABLE IF NOT EXISTS bloc_votes (
    targetId TEXT,
    voterStateId TEXT,
    choice INTEGER,
    createdAt INTEGER,
    PRIMARY KEY(targetId, voterStateId)
  );

  CREATE TABLE IF NOT EXISTS bloc_regulations (
    blocId TEXT PRIMARY KEY,
    openBorders INTEGER DEFAULT 0,
    migrationOpen INTEGER DEFAULT 0,
    defaultMilitaryAgreement INTEGER DEFAULT 0,
    FOREIGN KEY(blocId) REFERENCES blocs(id)
  );

  CREATE TABLE IF NOT EXISTS migration_agreements (
    id TEXT PRIMARY KEY,
    fromStateId TEXT,
    toStateId TEXT,
    status TEXT DEFAULT 'ACTIVE',
    type TEXT,
    createdAt INTEGER,
    activatedAt INTEGER,
    revokedAt INTEGER,
    sourceLawId TEXT,
    updatedAt INTEGER,
    UNIQUE(fromStateId, toStateId)
  );

  CREATE TABLE IF NOT EXISTS bloc_regulation_proposals (
    id TEXT PRIMARY KEY,
    blocId TEXT,
    type TEXT,
    proposedValue INTEGER,
    createdAt INTEGER,
    status TEXT,
    FOREIGN KEY(blocId) REFERENCES blocs(id)
  );

  CREATE TABLE IF NOT EXISTS ministers (
    id TEXT PRIMARY KEY,
    stateId TEXT,
    userId TEXT,
    role TEXT, -- 'economics', 'foreign'
    title TEXT,
    assignedByUserId TEXT,
    assignedAt INTEGER,
    status TEXT DEFAULT 'ACTIVE',
    FOREIGN KEY(stateId) REFERENCES regions(id),
    FOREIGN KEY(userId) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS minister_wage_logs (
    id TEXT PRIMARY KEY,
    userId TEXT,
    stateId TEXT,
    role TEXT,
    amountGold INTEGER,
    paidAt INTEGER,
    FOREIGN KEY(userId) REFERENCES users(id),
    FOREIGN KEY(stateId) REFERENCES regions(id)
  );

  CREATE TABLE IF NOT EXISTS sanctions (
    id TEXT PRIMARY KEY,
    fromStateId TEXT,
    targetStateId TEXT,
    status TEXT DEFAULT 'ACTIVE',
    createdAt INTEGER,
    createdByUserId TEXT,
    revokedAt INTEGER,
    revokedByUserId TEXT,
    FOREIGN KEY(fromStateId) REFERENCES regions(id),
    FOREIGN KEY(targetStateId) REFERENCES regions(id)
  );
`);

// Performance indexes — created once, silently ignored if they already exist
db.exec(`
  CREATE INDEX IF NOT EXISTS idx_factories_regionId ON factories(regionId);
  CREATE INDEX IF NOT EXISTS idx_user_factory_cooldowns_userId ON user_factory_cooldowns(userId);
  CREATE INDEX IF NOT EXISTS idx_production_queue_userId_status ON production_queue(userId, status, willCompleteAt);
  CREATE INDEX IF NOT EXISTS idx_market_offers_itemId ON market_offers(itemId);
  CREATE INDEX IF NOT EXISTS idx_market_offers_sellerId_itemId ON market_offers(sellerId, itemId);
  CREATE INDEX IF NOT EXISTS idx_market_offers_regionId ON market_offers(regionId);
  CREATE INDEX IF NOT EXISTS idx_laws_regionId_status ON laws(regionId, status);
  CREATE INDEX IF NOT EXISTS idx_law_votes_lawId ON law_votes(lawId);
  CREATE INDEX IF NOT EXISTS idx_election_votes_electionId ON election_votes(electionId);
  CREATE INDEX IF NOT EXISTS idx_election_votes_electionId_voterId ON election_votes(electionId, voterId);
  CREATE INDEX IF NOT EXISTS idx_parliament_members_regionId ON parliament_members(regionId);
  CREATE INDEX IF NOT EXISTS idx_party_members_partyId ON party_members(partyId);
  CREATE INDEX IF NOT EXISTS idx_party_primaries_partyId_voterId ON party_primaries(partyId, voterId, createdAt);
  CREATE INDEX IF NOT EXISTS idx_migration_agreements_fromStateId ON migration_agreements(fromStateId, status);
  CREATE INDEX IF NOT EXISTS idx_migration_agreements_toStateId ON migration_agreements(toStateId, status);
  CREATE INDEX IF NOT EXISTS idx_ministers_stateId_status ON ministers(stateId, status);
  CREATE INDEX IF NOT EXISTS idx_chat_messages_createdAt ON chat_messages(createdAt);
  CREATE INDEX IF NOT EXISTS idx_chat_messages_userId_createdAt ON chat_messages(userId, createdAt);
  CREATE INDEX IF NOT EXISTS idx_wars_status ON wars(status);
  CREATE INDEX IF NOT EXISTS idx_wars_attackerDefender ON wars(attackerCountryIso2, defenderCountryIso2);
  CREATE INDEX IF NOT EXISTS idx_bloc_memberships_stateId ON bloc_memberships(stateId, status);
  CREATE INDEX IF NOT EXISTS idx_users_regionId ON users(regionId);
  CREATE INDEX IF NOT EXISTS idx_party_invites_userId_status ON party_invites(userId, status);
  CREATE INDEX IF NOT EXISTS idx_party_invites_partyId_status ON party_invites(partyId, status);
  CREATE INDEX IF NOT EXISTS idx_elections_regionId_status ON elections(regionId, status);
  CREATE INDEX IF NOT EXISTS idx_budgets_ownerType_ownerId ON budgets(ownerType, ownerId);
  CREATE INDEX IF NOT EXISTS idx_articles_createdAt ON articles(createdAt);
  CREATE INDEX IF NOT EXISTS idx_articles_authorId_createdAt ON articles(authorId, createdAt);
  CREATE INDEX IF NOT EXISTS idx_leader_candidates_regionId ON leader_candidates(regionId);
  CREATE INDEX IF NOT EXISTS idx_leader_votes_regionId ON leader_votes(regionId);
  CREATE INDEX IF NOT EXISTS idx_party_logs_partyId_action_ts ON party_logs(partyId, action, timestamp);
  CREATE INDEX IF NOT EXISTS idx_regions_ownerUserId ON regions(ownerUserId);
  CREATE INDEX IF NOT EXISTS idx_regions_nationId ON regions(nationId);
  CREATE INDEX IF NOT EXISTS idx_bloc_applications_blocId_status ON bloc_applications(blocId, status);
  CREATE INDEX IF NOT EXISTS idx_bloc_votes_targetId ON bloc_votes(targetId);
  CREATE INDEX IF NOT EXISTS idx_applications_regionId_status ON applications(regionId, status);
  CREATE INDEX IF NOT EXISTS idx_applications_userId ON applications(userId);
  CREATE INDEX IF NOT EXISTS idx_user_inventory_userId ON user_inventory(userId);
  CREATE INDEX IF NOT EXISTS idx_state_inventory_regionId ON state_inventory(regionId);
  CREATE INDEX IF NOT EXISTS idx_budget_transactions_budgetId ON budget_transactions(budgetId, createdAt);
  CREATE INDEX IF NOT EXISTS idx_sanctions_targetStateId_status ON sanctions(targetStateId, status);
  CREATE INDEX IF NOT EXISTS idx_sanctions_fromStateId_status ON sanctions(fromStateId, status);
  CREATE INDEX IF NOT EXISTS idx_player_factories_ownerId ON player_factories(ownerId);
  CREATE INDEX IF NOT EXISTS idx_player_factories_regionId ON player_factories(regionId);
  CREATE INDEX IF NOT EXISTS idx_perks_userId ON perks(userId);
`);

// Seed initial regions if empty
const regionCount = db.prepare("SELECT COUNT(*) as count FROM regions").get() as { count: number };
if (regionCount.count === 0) {
  console.log("Seeding initial regions...");
  const countries = [
    { id: 'IT', name: "Italy", population: 60000000 },
    { id: 'FR', name: "France", population: 67000000 },
    { id: 'DE', name: "Germany", population: 83000000 },
    { id: 'ES', name: "Spain", population: 47000000 },
    { id: 'UK', name: "United Kingdom", population: 67000000 },
    { id: 'US', name: "United States", population: 331000000 },
    { id: 'CA', name: "Canada", population: 38000000 },
    { id: 'BR', name: "Brazil", population: 212000000 },
    { id: 'JP', name: "Japan", population: 126000000 },
    { id: 'CN', name: "China", population: 1400000000 },
    { id: 'IN', name: "India", population: 1380000000 },
    { id: 'RU', name: "Russia", population: 1440000000 },
    { id: 'AU', name: "Australia", population: 25000000 },
    { id: 'ZA', name: "South Africa", population: 59000000 },
    { id: 'MX', name: "Mexico", population: 128000000 },
    { id: 'AR', name: "Argentina", population: 45000000 },
    { id: 'EG', name: "Egypt", population: 102000000 },
    { id: 'NG', name: "Nigeria", population: 206000000 },
    { id: 'TR', name: "Turkey", population: 84000000 },
    { id: 'KR', name: "South Korea", population: 51000000 },
  ];

  const insertRegion = db.prepare(`
    INSERT INTO regions 
    (id, name, population, resources, health, education, military, marketTaxRate, oilBonus, mineralsBonus, uraniumBonus, diamondsBonus) 
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  db.transaction(() => {
    countries.forEach(c => {
      const oil = 1.0 + Math.random() * 0.5;
      const min = 1.0 + Math.random() * 0.5;
      const ura = 1.0 + Math.random() * 0.5;
      const dia = 1.0 + Math.random() * 0.5;

      insertRegion.run(
        c.id, c.name, c.population, 50, 1, 1, 1, 10,
        parseFloat(oil.toFixed(2)), parseFloat(min.toFixed(2)), parseFloat(ura.toFixed(2)), parseFloat(dia.toFixed(2))
      );
    });
  })();
}

// Seed factories if empty (REMOVED: Now completely Player-Driven)

// Migration: Initialize budgets for all existing regions if they don't have one
try {
  const regionsWithoutBudget = db.prepare(`
    SELECT id, treasury FROM regions 
    WHERE id NOT IN (SELECT ownerId FROM budgets WHERE ownerType = 'REGION')
  `).all() as any[];

  if (regionsWithoutBudget.length > 0) {
    db.transaction(() => {
      const insertBudget = db.prepare("INSERT INTO budgets (id, ownerType, ownerId, moneyEUR, resources, updatedAt) VALUES (?, 'REGION', ?, ?, '{}', ?)");
      const now = Date.now();
      for (const r of regionsWithoutBudget) {
        insertBudget.run(Math.random().toString(36).substring(2, 11), r.id, r.treasury || 0, now);
      }
    })();
    console.log(`Migration SUCCESS: Initialized budgets for ${regionsWithoutBudget.length} regions.`);
  }
} catch (e) {
  console.error("Migration error (budgets init):", e);
}

// Migration: Move regions into nations if they aren't already
try {
  const regionsWithLeader = db.prepare("SELECT id, name, leaderUserId FROM regions WHERE leaderUserId IS NOT NULL AND nationId IS NULL").all() as any[];
  if (regionsWithLeader.length > 0) {
    db.transaction(() => {
      for (const r of regionsWithLeader) {
        const nationId = `nation_${r.id}`;
        // Create nation
        db.prepare("INSERT OR IGNORE INTO nations (id, name, capitalRegionId, leaderUserId, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?)")
          .run(nationId, `${r.name} Federation`, r.id, r.leaderUserId, Date.now(), Date.now());
        // Map region
        db.prepare("UPDATE regions SET nationId = ? WHERE id = ?").run(nationId, r.id);
      }
    })();
  }
} catch (e) { }

// Default fallback for regions without a nation (belong to themselves)
try {
  db.prepare("UPDATE regions SET nationId = 'nation_' || id WHERE nationId IS NULL").run();
} catch (e) { }

app.use(express.json());
app.use(cookieParser());

// Helper to get user perks, including active boosters
const getUserPerks = (userId: string, boosterInfo?: Record<string, any>) => {
  const perks = db.prepare("SELECT perkId, level FROM perks WHERE userId = ?").all(userId) as { perkId: string, level: number }[];
  const perkMap: Record<string, number> = {};
  perks.forEach(p => perkMap[p.perkId] = p.level);

  // Apply booster bonus (+100) if active
  if (boosterInfo) {
    const now = Date.now();
    for (const [pId, booster] of Object.entries(boosterInfo)) {
      if (booster.expiresAt > now) {
        perkMap[pId] = (perkMap[pId] || 0) + BOOSTER_CONFIG.BONUS_POINTS;
      }
    }
  }

  return perkMap;
};

// Helper to calculate XP and Level Up
const addXP = (userId: string, amount: number) => {
  const user = db.prepare("SELECT xp, level, perkPoints FROM users WHERE id = ?").get(userId) as any;
  let newXP = user.xp + amount;
  let newLevel = user.level;
  let newPerkPoints = user.perkPoints;

  let xpNeeded = Math.floor(GAME_CONFIG.LEVEL_UP_BASE_XP * Math.pow(GAME_CONFIG.LEVEL_UP_FACTOR, newLevel - 1));

  while (newXP >= xpNeeded) {
    newXP -= xpNeeded;
    newLevel++;
    newPerkPoints += 2; // 2 points per level
    xpNeeded = Math.floor(GAME_CONFIG.LEVEL_UP_BASE_XP * Math.pow(GAME_CONFIG.LEVEL_UP_FACTOR, newLevel - 1));
  }

  db.prepare("UPDATE users SET xp = ?, level = ?, perkPoints = ? WHERE id = ?")
    .run(newXP, newLevel, newPerkPoints, userId);

  return { newXP, newLevel, newPerkPoints };
};

const calculateMinisterWage = (stateId: string, role: string) => {
  const region = db.prepare("SELECT governmentForm, education, health, economyLevel FROM regions WHERE id = ?").get(stateId) as any;
  if (!region) return 0;

  // 1. Base from Development Index (Avg of Edu, Health, Economy)
  const devIndex = (region.education + region.health + region.economyLevel) / 3;

  // 2. Multiplier from Government Form
  let govMult = 1.0;
  if (region.governmentForm === 'PRESIDENTIAL_REPUBLIC') govMult = 1.5;
  if (region.governmentForm === 'DICTATORSHIP') govMult = 2.0;
  if (region.governmentForm === 'ONE_PARTY_SYSTEM') govMult = 1.8;

  // 3. Multiplier from Region Count (representing state size/complexity)
  const statesInNation = db.prepare("SELECT COUNT(*) as count FROM regions WHERE ownerUserId = (SELECT ownerUserId FROM regions WHERE id = ?)").get(stateId) as any;
  const sizeMult = 1 + (statesInNation.count * 0.1);

  const baseWage = 10; // 10 Gold base
  return Math.floor(baseWage * devIndex * govMult * sizeMult);
};

// Middleware to verify JWT and update energy
const authenticate = async (req: any, res: any, next: any) => {
  let token = null;

  // 1. Try Authorization header first (Bearer <token>)
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    const headerToken = req.headers.authorization.substring(7);
    if (headerToken && headerToken !== 'null' && headerToken !== 'undefined') {
      token = headerToken;
    }
  }
  
  // 2. Fallback to cookies if no valid header token found
  if (!token) {
    token = req.cookies.token;
  }

  if (!token) {
    return res.status(401).json({ error: "Unauthorized: Access token missing." });
  }

  try {
    const decoded = jwt.verify(token, SECRET_KEY) as { id: string };
    const user = db.prepare("SELECT * FROM users WHERE id = ?").get(decoded.id) as any;
    if (!user) {
      return res.status(401).json({ error: "Unauthorized: User not found in database." });
    }

    // Booster logic
    let activeBoosters: Record<string, any> = {};
    try {
      activeBoosters = JSON.parse(user.boostersJson || '{}');
    } catch { activeBoosters = {}; }

    // Clean up expired boosters
    let boostersChanged = false;
    const now = Date.now();
    for (const pId in activeBoosters) {
      if (activeBoosters[pId].expiresAt <= now) {
        // We don't necessarily delete them as they might still be in cooldown phase
        // but they are no longer "active" for perk calculation. 
        // For now, let's just keep them for cooldown tracking.
      }
    }

    // Get perks for general modifiers (re-adding this!)
    const perks = getUserPerks(user.id, activeBoosters);

    // Energy regeneration logic (Health-based, 10 min ticks)
    const userRegion = db.prepare("SELECT health FROM regions WHERE id = ?").get(user.regionId || 'IT') as { health: number } | undefined;
    const regionHealth = userRegion?.health || 1;

    let tickEnergy = 7;
    if (regionHealth >= 11) tickEnergy = 16;
    else if (regionHealth === 10) tickEnergy = 12;
    else if (regionHealth === 9) tickEnergy = 11;
    else if (regionHealth === 8) tickEnergy = 10;
    else if (regionHealth === 7) tickEnergy = 9;
    else if (regionHealth === 6) tickEnergy = 8;
    else tickEnergy = 7;

    const maxEnergy = GAME_CONFIG.ENERGY_MAX;
    const millisPassed = now - user.lastEnergyUpdate;
    const ticksPassed = Math.floor(millisPassed / (10 * 60 * 1000));

    if (ticksPassed > 0) {
      const regen = ticksPassed * tickEnergy;
      const newEnergy = Math.min(maxEnergy, user.energy + regen);
      const timeAdvanced = ticksPassed * (10 * 60 * 1000); // Advance exactly X ticks
      db.prepare("UPDATE users SET energy = ?, lastEnergyUpdate = lastEnergyUpdate + ? WHERE id = ?")
        .run(newEnergy, timeAdvanced, user.id);
      user.energy = newEnergy;
      user.lastEnergyUpdate += timeAdvanced;
    }

    user.perks = perks;
    user.boosters = activeBoosters;
    user.maxEnergy = maxEnergy;

    // ----- Perk Upgrade Timers (SQLite-based, Firestore optional sync) -----
    let perkUpgrades: Record<string, any> = {};
    try {
      perkUpgrades = JSON.parse(user.perkUpgradesJson || '{}');
    } catch { perkUpgrades = {}; }

    // Check for completed upgrades
    let upgradesChanged = false;
    for (const [pId, upg] of Object.entries(perkUpgrades)) {
      const upgrade = upg as any;
      const finishTime = typeof upgrade.willCompleteAt === 'number' ? upgrade.willCompleteAt : 0;
      if (finishTime > 0 && finishTime <= now) {
        db.prepare("INSERT OR REPLACE INTO perks (userId, perkId, level) VALUES (?, ?, ?)")
          .run(user.id, pId, upgrade.targetLevel);
        user.perks[pId] = upgrade.targetLevel;
        delete perkUpgrades[pId];
        upgradesChanged = true;
      }
    }

    if (upgradesChanged) {
      db.prepare("UPDATE users SET perkUpgradesJson = ? WHERE id = ?")
        .run(JSON.stringify(perkUpgrades), user.id);
    }

    user.perkUpgrades = perkUpgrades;

    // Optional: also sync to Firestore (best-effort, non-blocking)
    if (process.env.FIREBASE_PROJECT_ID) {
      try {
        const fs = getFirestore();
        const doc = await fs.collection("users").doc(user.id).get();
        if (doc.exists) {
          const fsUpgrades = doc.data()?.perkUpgrades || {};
          // Merge any Firestore upgrades not already in SQLite
          for (const [pId, fsUpg] of Object.entries(fsUpgrades)) {
            if (!perkUpgrades[pId]) {
              perkUpgrades[pId] = fsUpg;
              upgradesChanged = true;
            }
          }
          if (upgradesChanged) {
            db.prepare("UPDATE users SET perkUpgradesJson = ? WHERE id = ?")
              .run(JSON.stringify(perkUpgrades), user.id);
            user.perkUpgrades = perkUpgrades;
          }
        }
      } catch (fsErr) {
        // Firestore read failure is non-critical — SQLite is the source of truth
      }
    }
    // ------ end perk upgrades ------

    // ------ Inventory & Storage ------
    // Auto-claim completed production items
    const completedProd = db.prepare("SELECT * FROM production_queue WHERE userId = ? AND status != 'claimed' AND willCompleteAt <= ?").all(user.id, Date.now()) as any[];
    if (completedProd.length > 0) {
      db.transaction(() => {
        for (const item of completedProd) {
          db.prepare("UPDATE production_queue SET status = 'claimed' WHERE id = ?").run(item.id);
          const qty = item.qty || 1;
          const userInv = db.prepare("SELECT quantity FROM user_inventory WHERE userId = ? AND itemId = ?").get(user.id, item.weaponType) as any;
          if (userInv) {
            db.prepare("UPDATE user_inventory SET quantity = quantity + ? WHERE userId = ? AND itemId = ?").run(qty, user.id, item.weaponType);
          } else {
            db.prepare("INSERT INTO user_inventory (userId, itemId, quantity) VALUES (?, ?, ?)").run(user.id, item.weaponType, qty);
          }
        }
      })();
    }

    const inventoryResult = db.prepare("SELECT itemId, quantity FROM user_inventory WHERE userId = ?").all(user.id) as any[];
    const inventory = inventoryResult.reduce((acc, row) => {
      acc[row.itemId] = row.quantity;
      return acc;
    }, {} as Record<string, number>);

    const inventoryVolume = inventoryResult.reduce((sum, row) => sum + row.quantity, 0);
    const maxInventoryVolume = Math.floor(GAME_CONFIG.STORAGE_BASE_CAPACITY * (1 + ((perks['RESISTENZA'] || 0) * 0.01)));

    user.inventory = inventory;
    user.inventoryVolume = inventoryVolume;
    user.maxInventoryVolume = maxInventoryVolume;

    // Throttle lastLogin updates to once every 5 minutes to reduce DB load
    if (now - (user.lastLogin || 0) > 5 * 60 * 1000) {
      db.prepare("UPDATE users SET lastLogin = ? WHERE id = ?").run(now, user.id);
      user.lastLogin = now;
    }

    req.user = user;
    next();
  } catch (err) {
    console.error("Auth error:", err);
    res.status(401).json({ error: "Invalid token" });
  }
};

// Auth Routes
app.post("/api/register", (req, res) => {
  const { username, password } = req.body;
  const id = Math.random().toString(36).substring(2, 9);
  try {
    db.prepare("INSERT INTO users (id, username, password, lastEnergyUpdate) VALUES (?, ?, ?, ?)")
      .run(id, username, password, Date.now());
    const token = jwt.sign({ id }, SECRET_KEY);
    res.cookie("token", token, { httpOnly: true, secure: false, sameSite: "lax" });
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: "Username already exists" });
  }
});

app.post("/api/login", (req, res) => {
  const { username, password } = req.body;
  const user = db.prepare("SELECT * FROM users WHERE username = ? AND password = ?").get(username, password) as any;
  if (!user) return res.status(401).json({ error: "Invalid credentials" });

  const token = jwt.sign({ id: user.id }, SECRET_KEY);
  res.cookie("token", token, { httpOnly: true, secure: false, sameSite: "lax" });
  res.json({ success: true });
});

app.post("/api/logout", (req, res) => {
  res.clearCookie("token");
  res.json({ success: true });
});

// Firebase Auth Route
app.post("/api/auth/firebase", async (req, res) => {
  const { idToken, username } = req.body;
  if (!idToken) return res.status(400).json({ error: "Missing ID token" });

  try {
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    const { uid, email, name } = decodedToken;

    let user = db.prepare("SELECT * FROM users WHERE firebase_uid = ?").get(uid) as any;

    if (!user) {
      // Create new user
      const id = Math.random().toString(36).substring(2, 9);
      const finalUsername = username || name || email?.split('@')[0] || `user_${id}`;

      try {
        db.prepare("INSERT INTO users (id, username, email, firebase_uid, lastEnergyUpdate, residenceId, originalNation, displayedNation, lastOriginalNationChange) VALUES (?, ?, ?, ?, ?, 'ST', 'ST', 'ST', 0)")
          .run(id, finalUsername, email, uid, Date.now());
        user = db.prepare("SELECT * FROM users WHERE id = ?").get(id);
      } catch (err) {
        // If username exists, try with suffix
        const altUsername = `${finalUsername}_${id}`;
        db.prepare("INSERT INTO users (id, username, email, firebase_uid, lastEnergyUpdate, residenceId, originalNation, displayedNation, lastOriginalNationChange) VALUES (?, ?, ?, ?, ?, 'ST', 'ST', 'ST', 0)")
          .run(id, altUsername, email, uid, Date.now());
        user = db.prepare("SELECT * FROM users WHERE id = ?").get(id);
      }
    }

    const token = jwt.sign({ id: user.id }, SECRET_KEY);
    res.cookie("token", token, { httpOnly: true, secure: false, sameSite: "lax" });
    res.json({ success: true });
  } catch (err) {
    console.error("Firebase auth error:", err);
    res.status(401).json({ error: "Invalid Firebase token" });
  }
});

// Game Routes
app.get("/api/me", authenticate, (req: any, res) => {
  res.json(req.user);
});

app.get("/api/regions", authenticate, (req, res) => {
  const regions = db.prepare(`
    SELECT r.*, u.username as ownerName, l.username as leaderName, l.level as leaderLevel,
           (SELECT COUNT(*) FROM factories WHERE regionId = r.id) as factoriesCount
    FROM regions r 
    LEFT JOIN users u ON r.ownerUserId = u.id
    LEFT JOIN users l ON r.leaderUserId = l.id
  `).all();
  res.json(regions);
});

app.get("/api/regions/:id", authenticate, (req, res) => {
  try {
    const regionId = (req.params.id || '').toUpperCase().replace('NATION_', '');
    const region = db.prepare(`
      SELECT r.*, u.username as ownerName, l.username as leaderName, l.level as leaderLevel,
             (SELECT COUNT(*) FROM factories WHERE regionId = r.id) as factoriesCount
      FROM regions r 
      LEFT JOIN users u ON r.ownerUserId = u.id
      LEFT JOIN users l ON r.leaderUserId = l.id
      WHERE r.id = ?
    `).get(regionId) as any;

    if (!region) return res.status(404).json({ error: "Regione non trovata" });

    // Get nation info
    const nation = db.prepare("SELECT * FROM nations WHERE id = ?").get(region.nationId) as any;

    // Get sibling regions
    const memberRegions = region.nationId ? db.prepare("SELECT id, name, population FROM regions WHERE nationId = ?").all(region.nationId) : [region];

    res.json({ ...region, nation, memberRegions });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/countries/:iso2", async (req: any, res) => {
  const { iso2 } = req.params;
  if (!iso2 || iso2 === "-99") return res.status(400).json({ error: "Regione non disponibile" });

  try {
    // 1. Get base data from SQLite
    let region = db.prepare(`
      SELECT r.*, u.username as ownerName, l.username as leaderName, l.level as leaderLevel,
             (SELECT COUNT(*) FROM factories WHERE regionId = r.id) as factoriesCount
      FROM regions r 
      LEFT JOIN users u ON r.ownerUserId = u.id
      LEFT JOIN users l ON r.leaderUserId = l.id
      WHERE r.id = ?
    `).get(iso2.toUpperCase()) as any;

    if (!region) {
      // Auto-create the country with default values so any map click works
      db.prepare("INSERT OR IGNORE INTO regions (id, name, population, resources, stability, health, education, military) VALUES (?, ?, ?, ?, 5, 1, 1, 1)")
        .run(iso2.toUpperCase(), iso2.toUpperCase(), 1000000, 50);
      region = db.prepare(`
        SELECT r.*, u.username as ownerName,
               (SELECT COUNT(*) FROM factories WHERE regionId = r.id) as factoriesCount
        FROM regions r 
        LEFT JOIN users u ON r.ownerUserId = u.id
        WHERE r.id = ?
      `).get(iso2.toUpperCase()) as any;
    }

    if (!region) return res.status(404).json({ error: "Regione non trovata" });

    // 2. Get/Generate gameStats from Firestore
    let gameStats;
    if (process.env.FIREBASE_PROJECT_ID) {
      const fs = getFirestore();
      const countryRef = fs.collection("countries").doc(iso2.toUpperCase());
      const doc = await countryRef.get();

      if (!doc.exists) {
        gameStats = {
          iso2: iso2.toUpperCase(),
          name: region.name,
          status: region.ownerId ? "occupied" : "neutral",
          ownerUserId: region.ownerId || null,
          ...generateGameStatsForCountry(iso2.toUpperCase()),
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        };
        await countryRef.set(gameStats);
      } else {
        gameStats = doc.data();
      }
    } else {
      gameStats = generateGameStatsForCountry(iso2.toUpperCase());
    }

    // 3. Get nation info
    const nation = region.nationId ? db.prepare("SELECT * FROM nations WHERE id = ?").get(region.nationId) as any : null;
    const memberRegions = region.nationId ? db.prepare("SELECT id, name, population FROM regions WHERE nationId = ?").all(region.nationId) : [];

    // 4. Construct response prioritizing DB attributes
    const response = {
      ...gameStats, // Base stats like resources
      ...region,    // Persistent stats like health, education, military, treasury, economyLevel
      nation,
      memberRegions,
      indicators: {
        ...(gameStats?.indicators || {}),
        health: region.health || 1,
        education: region.education || 1,
        military: region.military || 1,
        stability: region.stability || 1
      }
    };

    res.json(response);
  } catch (err) {
    console.error("Error fetching country detail:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.get("/api/countries/:iso2/agreements", authenticate, (req: any, res) => {
  const { iso2 } = req.params;
  try {
    const stateId = iso2.toUpperCase();
    const agreements = db.prepare(`
      SELECT m.*, rf.name as fromStateName, rt.name as toStateName
      FROM migration_agreements m
      JOIN regions rf ON rf.id = m.fromStateId
      JOIN regions rt ON rt.id = m.toStateId
      WHERE (m.fromStateId = ? OR m.toStateId = ?)
        AND m.status = 'ACTIVE'
      ORDER BY m.activatedAt DESC, m.createdAt DESC
    `).all(stateId, stateId) as any[];

    const enriched = agreements.map((ag) => {
      const partnerId = ag.fromStateId === stateId ? ag.toStateId : ag.fromStateId;
      const partnerName = ag.fromStateId === stateId ? ag.toStateName : ag.fromStateName;
      const inverse = db.prepare("SELECT id FROM migration_agreements WHERE fromStateId = ? AND toStateId = ? AND status = 'ACTIVE'").get(ag.toStateId, ag.fromStateId) as any;
      return {
        ...ag,
        partnerId,
        partnerName,
        direction: ag.fromStateId === stateId ? 'OUTGOING' : 'INCOMING',
        agreementType: inverse ? 'BILATERAL' : 'UNILATERAL'
      };
    });

    res.json({
      outgoing: enriched.filter(a => a.direction === 'OUTGOING'),
      incoming: enriched.filter(a => a.direction === 'INCOMING')
    });
  } catch (err) {
    console.error("Error fetching agreements:", err);
    res.status(500).json({ error: "Errore caricamento accordi." });
  }
});

// Market API (Firestore Only)
app.get("/api/market/listings", authenticate, async (req: any, res) => {
  if (!process.env.FIREBASE_PROJECT_ID) return res.status(501).json({ error: "Firestore not configured" });

  try {
    const fs = getFirestore();
    const snapshot = await fs.collection("marketListings")
      .where("status", "==", "active")
      .orderBy("createdAt", "desc")
      .limit(50)
      .get();

    const listings = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate?.() || doc.data().createdAt
    }));
    res.json(listings);
  } catch (err) {
    console.error("Market fetch error:", err);
    res.status(500).json({ error: "Failed to fetch market listings" });
  }
});

app.post("/api/market/listings", authenticate, async (req: any, res) => {
  if (!process.env.FIREBASE_PROJECT_ID) return res.status(501).json({ error: "Firestore not configured" });
  const { itemName, quantity, price } = req.body;
  const user = req.user;

  if (!itemName || !quantity || !price || quantity <= 0 || price <= 0) {
    return res.status(400).json({ error: "Invalid listing data" });
  }

  try {
    const fs = getFirestore();
    const listing = {
      sellerId: user.id,
      sellerName: user.username,
      itemName,
      quantity: Number(quantity),
      price: Number(price),
      status: "active",
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    };
    const docRef = await fs.collection("marketListings").add(listing);
    res.json({ success: true, id: docRef.id });
  } catch (err) {
    console.error("Market create error:", err);
    res.status(500).json({ error: "Failed to create listing" });
  }
});

// Actions
const checkCooldown = (userId: string, actionType: string, cooldownTime: number) => {
  const last = db.prepare("SELECT lastUsed FROM cooldowns WHERE userId = ? AND actionType = ?")
    .get(userId, actionType) as { lastUsed: number } | undefined;
  if (last && Date.now() - last.lastUsed < cooldownTime) {
    return false;
  }
  return true;
};

const updateCooldown = (userId: string, actionType: string) => {
  db.prepare("INSERT OR REPLACE INTO cooldowns (userId, actionType, lastUsed) VALUES (?, ?, ?)")
    .run(userId, actionType, Date.now());
};

// --- Budget Core Helper ---
// ALWAYS call this inside a db.transaction() block if combined with other updates!
function addBudgetTransaction(
  ownerType: string,
  ownerId: string,
  type: string,
  subtype: string,
  moneyDelta: number,
  resourcesDelta: Record<string, number> = {},
  createdByUserId: string | null = null,
  metadata: any = {}
) {
  const budget = db.prepare("SELECT * FROM budgets WHERE ownerType = ? AND ownerId = ?").get(ownerType, ownerId) as any;
  if (!budget) throw new Error(`Budget inesistente per ${ownerType} ${ownerId}`);

  const currentResources = JSON.parse(budget.resources || '{}');

  const newMoney = budget.moneyEUR + moneyDelta;
  if (newMoney < 0) throw new Error("Fondi del budget insufficienti per l'operazione.");

  const newResources = { ...currentResources };
  for (const [key, val] of Object.entries(resourcesDelta)) {
    newResources[key] = (newResources[key] || 0) + val;
    if (newResources[key] < 0) throw new Error(`Risorse insufficienti nel budget: ${key}`);
  }

  const now = Date.now();
  db.prepare("UPDATE budgets SET moneyEUR = ?, resources = ?, updatedAt = ? WHERE id = ?")
    .run(newMoney, JSON.stringify(newResources), now, budget.id);

  const txId = Math.random().toString(36).substring(2, 11);
  db.prepare(`
    INSERT INTO budget_transactions 
    (id, budgetId, type, subtype, moneyDelta, resourcesDelta, createdAt, createdByUserId, metadata)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    txId, budget.id, type, subtype, moneyDelta, JSON.stringify(resourcesDelta), now, createdByUserId, JSON.stringify(metadata)
  );

  return txId;
}

app.post("/api/actions/work", authenticate, (req: any, res) => {
  const user = req.user;
  // Require player to be in the SAME region physically
  const userRegion = user.regionId || 'IT';

  const { factoryId } = req.body;
  const factory = db.prepare("SELECT * FROM factories WHERE id = ?").get(factoryId) as any;
  if (!factory) return res.status(404).json({ error: "Nessuna fabbrica trovata" });
  if (user.level < factory.minLevel) return res.status(400).json({ error: `Richiede livello ${factory.minLevel}` });

  // Controllo immigrazione
  const currentRegion = db.prepare("SELECT workRestrictions FROM regions WHERE id = ?").get(userRegion) as any;
  const restrictionsActive = currentRegion?.workRestrictions === 1;
  const isResident = user.residenceId === userRegion;
  const hasWorkPermit = user.workPermitId === userRegion;

  if (restrictionsActive && !isResident && !hasWorkPermit) {
    return res.status(403).json({ error: "Questa nazione richiede un Permesso di Lavoro per operare fabbriche statali." });
  }

  // Calculate perks
  const pIstruzione = user.perks?.['ISTRUZIONE'] || 0;
  const lastWork = db.prepare("SELECT lastUsed FROM user_factory_cooldowns WHERE userId = ? AND factoryId = ?")
    .get(user.id, factoryId) as { lastUsed: number } | undefined;

  if (lastWork && Date.now() - lastWork.lastUsed < factory.cooldownSec * 1000) {
    return res.status(400).json({ error: "Factory on cooldown" });
  }

  // RESISTENZA reduces energy cost — capped at level 50 for max -50% reduction
  const resistenza = user.perks['RESISTENZA'] || 0;
  const energyReduction = Math.min(0.5, resistenza / 100); // 0% at lv0, 50% at lv50+
  const energyCost = Math.ceil(factory.energyCost * (1 - energyReduction));

  if (user.energy < energyCost) return res.status(400).json({ error: "Not enough energy" });

  // FORZA boosts public factory productivity (+3% per level)
  const forzaBoost = (user.perks['FORZA'] || 0) * 0.03;

  // PRESIDENTIAL_REPUBLIC: Double wage bonus for Leader and economic/foreign ministers
  let govBonus = 1;
  const regionData = db.prepare("SELECT governmentForm, ownerUserId, economicAdviserId, foreignMinisterId FROM regions WHERE id = ?").get(userRegion) as any;
  if (regionData && regionData.governmentForm === 'PRESIDENTIAL_REPUBLIC') {
    if (user.id === regionData.ownerUserId || user.id === regionData.economicAdviserId || user.id === regionData.foreignMinisterId) {
      govBonus = 2;
    }
  }

  const earnings = Math.floor(factory.payoutMoney * (1 + forzaBoost) * govBonus);

  // ISTRUZIONE increases XP cap (each level adds 10 to XP per work)
  const xpGain = GAME_CONFIG.XP_PER_WORK + pIstruzione * 2;

  // Calculate and apply taxes to the regional budget
  const taxRate = currentRegion?.marketTaxRate || 10;
  const taxes = Math.floor(earnings * (taxRate / 100));
  const netEarnings = earnings - taxes;

  try {
    db.transaction(() => {
      // Player updates
      db.prepare("UPDATE users SET money = money + ?, energy = energy - ? WHERE id = ?")
        .run(netEarnings, energyCost, user.id);

      db.prepare("INSERT OR REPLACE INTO user_factory_cooldowns (userId, factoryId, lastUsed) VALUES (?, ?, ?)")
        .run(user.id, factoryId, Date.now());

      // Regional Budget update
      if (taxes > 0) {
        // Find if State or Region budget should receive. We default to 'REGION' using userRegion
        addBudgetTransaction(
          'REGION', userRegion,
          'INCOME', 'TAX',
          taxes, {},
          user.id,
          { factoryId, grossEarnings: earnings, taxRate }
        );
      }
    })();
  } catch (err) {
    console.error("Lavoro fallito (budget transaction error):", err);
    return res.status(500).json({ error: "Errore durante il lavoro. Riprova." });
  }

  addXP(user.id, xpGain);

  res.json({ success: true, earnings: netEarnings, taxes, energyCost, xpGain });
});

app.get("/api/factories", authenticate, (req: any, res) => {
  const factories = db.prepare("SELECT * FROM factories").all() as any[];
  const cooldowns = db.prepare("SELECT factoryId, lastUsed FROM user_factory_cooldowns WHERE userId = ?").all(req.user.id) as any[];

  const cooldownMap = new Map(cooldowns.map(c => [c.factoryId, c]));
  const factoriesWithCooldown = factories.map(f => {
    const cd = cooldownMap.get(f.id);
    const remaining = cd ? Math.max(0, (f.cooldownSec * 1000) - (Date.now() - cd.lastUsed)) : 0;
    return { ...f, remainingCooldown: remaining };
  });

  res.json(factoriesWithCooldown);
});

app.post("/api/actions/propaganda", authenticate, (req: any, res) => {
  const user = req.user;
  const { regionId } = req.body;
  const perks = user.perks;

  if (!regionId) return res.status(400).json({ error: "Region ID required" });

  const energyEfficiency = (perks['RESISTENZA'] || 0) * 0.005; // 0.5% reduction per level
  const energyCost = Math.ceil(GAME_CONFIG.PROPAGANDA_ENERGY_COST * (1 - energyEfficiency));

  if (user.energy < energyCost) return res.status(400).json({ error: "Not enough energy" });
  if (!checkCooldown(user.id, "propaganda", GAME_CONFIG.PROPAGANDA_COOLDOWN)) return res.status(400).json({ error: "Action on cooldown" });

  const baseInfluence = 5 + Math.floor(Math.random() * 5);
  const influenceGain = baseInfluence; // Removed propaganda_boost perk

  db.prepare("UPDATE users SET influence = influence + ?, energy = energy - ? WHERE id = ?")
    .run(influenceGain, energyCost, user.id);

  db.prepare("UPDATE regions SET stability = MIN(100, stability + 10) WHERE id = ?")
    .run(regionId);

  addXP(user.id, GAME_CONFIG.XP_PER_PROPAGANDA);
  updateCooldown(user.id, "propaganda");

  res.json({ success: true, influenceGain });
});

app.post("/api/actions/invest", authenticate, async (req: any, res) => {
  const user = req.user;
  const { regionId } = req.body;
  const perks = user.perks;

  const moneyCost = GAME_CONFIG.INVEST_MONEY_COST;

  const energyEfficiency = (perks['RESISTENZA'] || 0) * 0.005;
  const energyCost = Math.ceil(GAME_CONFIG.INVEST_ENERGY_COST * (1 - energyEfficiency));

  if (user.money < moneyCost) return res.status(400).json({ error: "Not enough money" });
  if (user.energy < energyCost) return res.status(400).json({ error: "Not enough energy" });

  db.prepare("UPDATE users SET money = money - ?, energy = energy - ? WHERE id = ?")
    .run(moneyCost, energyCost, user.id);

  db.prepare("UPDATE regions SET stability = MIN(100, stability + 5), population = population + 1000 WHERE id = ?")
    .run(regionId);

  // Update Economy in Firestore
  if (process.env.FIREBASE_PROJECT_ID) {
    try {
      const fs = getFirestore();
      const countryRef = fs.collection("countries").doc(regionId.toUpperCase());
      const doc = await countryRef.get();
      if (doc.exists) {
        const currentEconomy = doc.data()?.economy || 0;
        await countryRef.update({ economy: Math.min(100, currentEconomy + 3) });
      }
    } catch (err) {
      console.error("Firestore update failed during invest:", err);
    }
  }

  res.json({ success: true });
});

app.post("/api/actions/craft-drink", authenticate, (req: any, res) => {
  const user = req.user;
  const cost = GAME_CONFIG.ENERGY_DRINK_COST_GOLD;
  if (user.gold < cost) return res.status(400).json({ error: `Oro insufficiente. Ti servono 🏅 ${cost}.` });

  db.prepare("UPDATE users SET gold = gold - ?, energyDrinks = energyDrinks + 1 WHERE id = ?").run(cost, user.id);
  res.json({ success: true, energyDrinks: user.energyDrinks + 1 });
});

app.post("/api/actions/use-drink", authenticate, (req: any, res) => {
  const user = req.user;
  if (user.energyDrinks <= 0) return res.status(400).json({ error: "Non hai Energy Drinks disponibili nell'inventario." });

  const now = Date.now();
  if (now - user.lastEnergyDrink < GAME_CONFIG.ENERGY_DRINK_COOLDOWN) {
    const remainingMin = Math.ceil((GAME_CONFIG.ENERGY_DRINK_COOLDOWN - (now - user.lastEnergyDrink)) / 60000);
    return res.status(400).json({ error: `Drink in cooldown. Attendi altri ${remainingMin} minuti.` });
  }

  db.prepare("UPDATE users SET energyDrinks = energyDrinks - 1, energy = ?, lastEnergyDrink = ? WHERE id = ?")
    .run(GAME_CONFIG.ENERGY_MAX, now, user.id);
  res.json({ success: true, newEnergy: GAME_CONFIG.ENERGY_MAX });
});

app.post("/api/actions/claim-medal", authenticate, (req: any, res) => {
  const user = req.user;
  const now = Date.now();

  if (now - user.lastMedalClaim < GAME_CONFIG.MEDAL_CLAIM_COOLDOWN) {
    const remainingMin = Math.ceil((GAME_CONFIG.MEDAL_CLAIM_COOLDOWN - (now - user.lastMedalClaim)) / 60000);
    return res.status(400).json({ error: `La prossima medaglia sarà disponibile tra ${remainingMin} minuti.` });
  }

  db.prepare("UPDATE users SET warMedals = warMedals + 1, lastMedalClaim = ? WHERE id = ?").run(now, user.id);
  res.json({ success: true, warMedals: user.warMedals + 1 });
});

// --- Residence and Permits API ---

app.post("/api/actions/travel", authenticate, (req: any, res) => {
  const user = req.user;
  const { regionId } = req.body;
  if (!regionId) return res.status(400).json({ error: "Nessuna destinazione specificata." });
  if (user.regionId === regionId) return res.status(400).json({ error: "Sei già in questa regione." });

  const region = db.prepare("SELECT workRestrictions, travelFee FROM regions WHERE id = ?").get(regionId) as any;
  if (!region) return res.status(404).json({ error: "Regione inesistente." });

  // Travel Fee Logic (only if borders are closed/restricted)
  let isRestricted = region.workRestrictions === 1;
  let travelFee = region.travelFee || 0;

  const sourceStateId = user.residenceId || user.regionId;

  // Bloc Open Borders & Migration Check
  const userBloc = db.prepare("SELECT blocId FROM bloc_memberships WHERE stateId = ? AND status = 'active'").get(sourceStateId) as any;
  const targetBloc = db.prepare("SELECT blocId FROM bloc_memberships WHERE stateId = ? AND status = 'active'").get(regionId) as any;
  if (userBloc && targetBloc && userBloc.blocId === targetBloc.blocId) {
    const blocReg = db.prepare("SELECT openBorders, migrationOpen FROM bloc_regulations WHERE blocId = ?").get(userBloc.blocId) as any;
    if (blocReg && (blocReg.openBorders || blocReg.migrationOpen)) {
      isRestricted = false;
      travelFee = 0;
    }
  }

  // State-to-State Migration Agreement Check (if not already opened by bloc)
  if (isRestricted || travelFee > 0) {
    const agreement = db.prepare("SELECT id FROM migration_agreements WHERE fromStateId = ? AND toStateId = ? AND status = 'ACTIVE'").get(regionId, sourceStateId) as any;
    if (agreement) {
      isRestricted = false;
      travelFee = 0;
    }
  }

  if (isRestricted && travelFee > 0) {
    if (user.money < travelFee) {
      return res.status(400).json({ error: `Fondi insufficienti per pagare la tassa di frontiera ($${travelFee}).` });
    }
  }

  try {
    db.transaction(() => {
      // 1. Move player and deduct fee (if applicable)
      if (isRestricted && travelFee > 0) {
        db.prepare("UPDATE users SET regionId = ?, money = money - ? WHERE id = ?").run(regionId, travelFee, user.id);
        // 2. Add income to state/regional budget
        addBudgetTransaction('REGION', regionId, 'INCOME', 'TRAVEL_FEE', travelFee, {}, user.id, { fromRegion: user.regionId });
      } else {
        db.prepare("UPDATE users SET regionId = ? WHERE id = ?").run(regionId, user.id);
      }
    })();
  } catch (err) {
    console.error("Travel error:", err);
    return res.status(500).json({ error: "Errore durante il viaggio" });
  }

  res.json({ success: true, regionId });
});

app.post("/api/budget/donate", authenticate, (req: any, res) => {
  const user = req.user;
  const { entityId, amount, currency } = req.body;

  if (user.level < 60) return res.status(403).json({ error: "Devi essere al Livello 60 per effettuare donazioni di Stato." });
  if (!entityId || !amount || amount <= 0) return res.status(400).json({ error: "Dati donazione non validi." });
  if (currency !== 'EUR' && currency !== 'GOLD') return res.status(400).json({ error: "Valuta non supportata." });

  const amountNum = Number(amount);

  if (currency === 'EUR' && user.money < amountNum) return res.status(400).json({ error: "Fondi in € insufficienti." });
  if (currency === 'GOLD' && user.gold < amountNum) return res.status(400).json({ error: "Fondi in Gold insufficienti." });

  // Conversion logic
  const conversionRate = 500000;
  const moneyDelta = currency === 'GOLD' ? amountNum * conversionRate : amountNum;

  try {
    db.transaction(() => {
      if (currency === 'EUR') {
        db.prepare("UPDATE users SET money = money - ? WHERE id = ?").run(amountNum, user.id);
      } else if (currency === 'GOLD') {
        db.prepare("UPDATE users SET gold = gold - ? WHERE id = ?").run(amountNum, user.id);
      }

      addBudgetTransaction('REGION', entityId, 'INCOME', 'DONATION', moneyDelta, {}, user.id, { originalCurrency: currency, originalAmount: amountNum });
    })();
    res.json({ success: true, donated: moneyDelta });
  } catch (err) {
    console.error("Donation error:", err);
    res.status(500).json({ error: "La donazione è fallita." });
  }
});

app.post("/api/budget/clean-radiation", authenticate, (req: any, res) => {
  const user = req.user;
  const { regionId } = req.body;
  if (!regionId) return res.status(400).json({ error: "Nessuna regione specificata." });

  // Only Governor/Leader can do this
  const region = db.prepare("SELECT ownerUserId, radiation FROM regions WHERE id = ?").get(regionId) as any;
  if (!region || region.ownerUserId !== user.id) return res.status(403).json({ error: "Azione riservata al Leader." });
  if (region.radiation <= 0) return res.status(400).json({ error: "Nessuna radiazione da pulire." });

  const cost = 10000;

  try {
    db.transaction(() => {
      addBudgetTransaction('REGION', regionId, 'EXPENSE', 'RADIATION_CLEAN', -cost, {}, user.id);
      db.prepare("UPDATE regions SET radiation = MAX(0, radiation - 10) WHERE id = ?").run(regionId);
    })();
    res.json({ success: true });
  } catch (err: any) {
    res.status(400).json({ error: err.message || "Fondi insufficienti." });
  }
});

app.post("/api/budget/explore", authenticate, (req: any, res) => {
  const user = req.user;
  const { regionId, type } = req.body; // type: 'normal' | 'deep'
  if (!regionId || (type !== 'normal' && type !== 'deep')) return res.status(400).json({ error: "Parametri esplorazione non validi." });

  const region = db.prepare("SELECT ownerUserId FROM regions WHERE id = ?").get(regionId) as any;
  if (!region || region.ownerUserId !== user.id) return res.status(403).json({ error: "Azione riservata al Leader." });

  const isDeep = type === 'deep';
  const cost = isDeep ? 50000 : 15000;

  try {
    db.transaction(() => {
      // In a full implementation, this might start a timer to increase resources. 
      // For now, it costs budget and instantly returns some random resources.
      const foundOil = isDeep ? Math.floor(Math.random() * 500) + 100 : Math.floor(Math.random() * 100) + 20;
      const foundItems: Record<string, number> = { oil: foundOil };

      addBudgetTransaction('REGION', regionId, 'EXPENSE', isDeep ? 'EXPLORE_DEEP' : 'EXPLORE_NORMAL', -cost, foundItems, user.id);
    })();
    res.json({ success: true, message: `Esplorazione completata!` });
  } catch (err: any) {
    res.status(400).json({ error: err.message || "Fondi insufficienti." });
  }
});

app.get("/api/budget/:ownerType/:ownerId", authenticate, (req: any, res) => {
  const { ownerType, ownerId } = req.params;
  const budget = db.prepare("SELECT * FROM budgets WHERE ownerType = ? AND ownerId = ?").get(ownerType, ownerId) as any;
  if (!budget) return res.status(404).json({ error: "Budget non trovato." });

  const transactions = db.prepare(`
    SELECT t.*, u.username as createdBy 
    FROM budget_transactions t
    LEFT JOIN users u ON t.createdByUserId = u.id
    WHERE t.budgetId = (SELECT id FROM budgets WHERE ownerType = ? AND ownerId = ?)
    ORDER BY t.createdAt DESC
    LIMIT 50
  `).all(ownerType, ownerId);

  res.json({ budget, transactions });
});

// --- MINISTERS API ---

app.post("/api/ministers/assign", authenticate, (req: any, res) => {
  const leader = req.user;
  const { userId, role, iso2: rawIso2 } = req.body; // iso2 is the state ID
  const iso2 = rawIso2?.toUpperCase().replace('NATION_', '');

  if (!userId || !role || !iso2) return res.status(400).json({ error: "Dati mancanti." });

  const region = db.prepare("SELECT ownerUserId, governmentForm FROM regions WHERE id = ?").get(iso2) as any;
  if (!region || region.ownerUserId !== leader.id) {
    return res.status(403).json({ error: "Solo il Leader può nominare i ministri." });
  }

  // Role validation
  if (role === 'foreign' && (region.governmentForm === 'DICTATORSHIP' || region.governmentForm === 'ONE_PARTY_SYSTEM')) {
    return res.status(403).json({ error: "Questa carica non esiste in questa forma di governo." });
  }

  // Constraint: One state at a time
  const existingAsMinister = db.prepare("SELECT stateId FROM ministers WHERE userId = ? AND status = 'ACTIVE'").get(userId) as any;
  if (existingAsMinister) {
    return res.status(400).json({ error: "L'utente ricopre già una carica ministeriale in un altro Stato." });
  }

  const targetUser = db.prepare("SELECT username FROM users WHERE id = ?").get(userId) as any;
  if (!targetUser) return res.status(404).json({ error: "Utente non trovato." });

  const title = (role === 'economics' && region.governmentForm === 'DICTATORSHIP') ? "Economic Advisor" : (role === 'economics' ? "Minister of Economics" : "Foreign Minister");

  try {
    db.transaction(() => {
      // Deactivate old minister in this role for this state if exists
      db.prepare("UPDATE ministers SET status = 'REVOKED' WHERE stateId = ? AND role = ?").run(iso2, role);

      db.prepare(`
        INSERT INTO ministers (id, stateId, userId, role, title, assignedByUserId, assignedAt)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(Math.random().toString(36).substring(2, 11), iso2, userId, role, title, leader.id, Date.now());

      // Update regions table caching
      if (role === 'economics') {
        db.prepare("UPDATE regions SET economicAdviserId = ? WHERE id = ?").run(userId, iso2);
      } else {
        db.prepare("UPDATE regions SET foreignMinisterId = ? WHERE id = ?").run(userId, iso2);
      }
    })();
    res.json({ success: true, title });
  } catch (err) {
    console.error("Minister assignment error:", err);
    res.status(500).json({ error: "Errore durante l'assegnazione." });
  }
});

app.post("/api/ministers/revoke", authenticate, (req: any, res) => {
  const leader = req.user;
  const { role, iso2: rawIso2 } = req.body;
  const iso2 = rawIso2?.toUpperCase().replace('NATION_', '');

  const region = db.prepare("SELECT ownerUserId FROM regions WHERE id = ?").get(iso2) as any;
  if (!region || region.ownerUserId !== leader.id) {
    return res.status(403).json({ error: "Solo il Leader può revocare i ministri." });
  }

  try {
    db.transaction(() => {
      db.prepare("UPDATE ministers SET status = 'REVOKED' WHERE stateId = ? AND role = ?").run(iso2, role);
      if (role === 'economics') {
        db.prepare("UPDATE regions SET economicAdviserId = NULL WHERE id = ?").run(iso2);
      } else {
        db.prepare("UPDATE regions SET foreignMinisterId = NULL WHERE id = ?").run(iso2);
      }
    })();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Errore durante la revoca." });
  }
});

app.get("/api/ministers/:iso2", authenticate, (req: any, res) => {
  const iso2 = (req.params.iso2 || '').toUpperCase().replace('NATION_', '');
  const ministers = db.prepare(`
    SELECT m.*, u.username 
    FROM ministers m
    JOIN users u ON m.userId = u.id
    WHERE (m.stateId = ? OR m.stateId = ('nation_' || ?)) AND m.status = 'ACTIVE'
  `).all(iso2, iso2) as any[];

  const wageEconomics = calculateMinisterWage(iso2, 'economics');
  const wageForeign = calculateMinisterWage(iso2, 'foreign');

  res.json({ ministers, wages: { economics: wageEconomics, foreign: wageForeign } });
});

app.post("/api/ministers/sanctions", authenticate, (req: any, res) => {
  const user = req.user;
  const { iso2: rawIso2, active, scope } = req.body; // scope: { resources: bool, weapons: bool, items: bool }
  const iso2 = rawIso2?.toUpperCase().replace('NATION_', '');

  // Check if user is Minister of Economics or Leader
  const region = db.prepare("SELECT ownerUserId, economicAdviserId FROM regions WHERE id = ?").get(iso2) as any;
  if (!region) return res.status(404).json({ error: "Regione non trovata." });
  if (region.ownerUserId !== user.id && region.economicAdviserId !== user.id) {
    return res.status(403).json({ error: "Azione riservata al Ministro dell'Economia o al Leader." });
  }

  try {
    db.prepare("UPDATE regions SET sanctionsActive = ?, sanctionsScope = ? WHERE id = ?")
      .run(active ? 1 : 0, JSON.stringify(scope || {}), iso2);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Errore durante l'aggiornamento delle sanzioni." });
  }
});

app.delete("/api/ministers/market-offer/:id", authenticate, (req: any, res) => {
  const user = req.user;
  const { id } = req.params;

  const offer = db.prepare("SELECT regionId FROM market_offers WHERE id = ?").get(id) as any;
  if (!offer) return res.status(404).json({ error: "Offerta non trovata." });

  const region = db.prepare("SELECT ownerUserId, economicAdviserId FROM regions WHERE id = ?").get(offer.regionId) as any;
  if (region.ownerUserId !== user.id && region.economicAdviserId !== user.id) {
    return res.status(403).json({ error: "Azione riservata al Ministro dell'Economia o al Leader di questo Stato." });
  }

  try {
    db.prepare("DELETE FROM market_offers WHERE id = ?").run(id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Errore durante la rimozione dell'offerta." });
  }
});

app.post("/api/actions/apply", authenticate, (req: any, res) => {
  const user = req.user;
  const { regionId, type } = req.body;

  if (!["residence", "work_permit"].includes(type)) return res.status(400).json({ error: "Tipo di richiesta non valido." });
  if (type === "residence" && user.residenceId === regionId) return res.status(400).json({ error: "Siedi già in questa regione." });
  if (type === "work_permit" && user.workPermitId === regionId) return res.status(400).json({ error: "Hai già un permesso di lavoro qui." });

  // Controlla se c'è già una richiesta in sospeso
  const existing = db.prepare("SELECT id FROM applications WHERE userId = ? AND regionId = ? AND type = ? AND status = 'pending'").get(user.id, regionId, type);
  if (existing) return res.status(400).json({ error: "Hai già inviato una richiesta in attesa di approvazione." });

  const region = db.prepare("SELECT ownerUserId FROM regions WHERE id = ?").get(regionId) as any;
  if (!region) return res.status(404).json({ error: "Regione inesistente." });

  const id = Math.random().toString(36).substring(2, 9);

  // Se la regione è neutrale, approvazione automatica
  if (!region.ownerUserId) {
    if (type === 'residence') {
      db.prepare("UPDATE users SET residenceId = ? WHERE id = ?").run(regionId, user.id);
    } else {
      db.prepare("UPDATE users SET workPermitId = ? WHERE id = ?").run(regionId, user.id);
    }
    db.prepare("INSERT INTO applications (id, userId, username, regionId, type, status, createdAt) VALUES (?, ?, ?, ?, ?, 'accepted', ?)")
      .run(id, user.id, user.username, regionId, type, Date.now());
    return res.json({ success: true, autoAccepted: true });
  }

  // Altrimenti, metti in coda
  db.prepare("INSERT INTO applications (id, userId, username, regionId, type, status, createdAt) VALUES (?, ?, ?, ?, ?, 'pending', ?)")
    .run(id, user.id, user.username, regionId, type, Date.now());

  res.json({ success: true, autoAccepted: false });
});

app.get("/api/applications/:regionId", authenticate, (req: any, res) => {
  const user = req.user;
  const regionId = (req.params.regionId || '').toUpperCase().replace('NATION_', '');
  const region = db.prepare("SELECT ownerUserId, leaderUserId FROM regions WHERE id = ?").get(regionId) as any;

  if (!region || (region.ownerUserId !== user.id && region.leaderUserId !== user.id)) {
    return res.status(403).json({ error: "Non sei il Leader di questa regione." });
  }

  const apps = db.prepare("SELECT * FROM applications WHERE regionId = ? AND status = 'pending' ORDER BY createdAt DESC").all(regionId);
  res.json(apps);
});

app.get("/api/leader/orders/:regionId", authenticate, (req: any, res) => {
  // Stub for military orders - can be expanded later
  res.json([]);
});

app.post("/api/actions/resolve-application", authenticate, (req: any, res) => {
  const user = req.user;
  const { applicationId, action } = req.body; // action = 'accept' | 'reject'

  const application = db.prepare("SELECT * FROM applications WHERE id = ?").get(applicationId) as any;
  if (!application) return res.status(404).json({ error: "Richiesta non trovata." });

  const regionInfo = db.prepare("SELECT leaderUserId, governmentForm FROM regions WHERE id = ?").get(application.regionId) as any;
  if (!regionInfo) return res.status(404).json({ error: "Regione non trovata." });

  // Only Leader can resolve RESIDENCE requests.
  if (application.type === 'residence') {
    if (regionInfo.leaderUserId !== user.id) {
      return res.status(403).json({ error: "Solo il Leader può approvare o rifiutare le richieste di residenza." });
    }
  } else {
    // Fallback for work_permit: MP or Leader
    const isMp = db.prepare("SELECT userId FROM parliament_members WHERE userId = ? AND regionId = ?").get(user.id, application.regionId);
    if (!isMp && regionInfo.leaderUserId !== user.id) {
      return res.status(403).json({ error: "Permessi insufficienti." });
    }
  }

  if (action === 'accept') {
    if (application.type === 'residence') {
      db.prepare("UPDATE users SET residenceId = ? WHERE id = ?").run(application.regionId, application.userId);
      db.prepare("UPDATE users SET workPermitId = NULL WHERE id = ? AND workPermitId = ?").run(application.userId, application.regionId);
    } else if (application.type === 'work_permit') {
      db.prepare("UPDATE users SET workPermitId = ? WHERE id = ?").run(application.regionId, application.userId);
    }
    db.prepare("UPDATE applications SET status = 'accepted' WHERE id = ?").run(applicationId);
  } else {
    db.prepare("UPDATE applications SET status = 'rejected' WHERE id = ?").run(applicationId);
  }

  res.json({ success: true });
});

app.post("/api/actions/toggle-borders", authenticate, (req: any, res) => {
  const user = req.user;
  const { regionId, state } = req.body;
  const region = db.prepare("SELECT ownerUserId FROM regions WHERE id = ?").get(regionId) as any;

  if (!region || region.ownerUserId !== user.id) {
    return res.status(403).json({ error: "Non sei il Governatore di questa regione." });
  }

  db.prepare("UPDATE regions SET workRestrictions = ? WHERE id = ?").run(state ? 1 : 0, regionId);
  res.json({ success: true });
});

// --- Government & Ministers API ---
app.post("/api/government/assign-minister", authenticate, (req: any, res) => {
  const user = req.user;
  const { regionId, role, ministerId } = req.body; // role: 'economicAdviserId' | 'foreignMinisterId', ministerId: string | null

  if (!regionId || !role) return res.status(400).json({ error: "Missing parameters." });
  if (role !== "economicAdviserId" && role !== "foreignMinisterId") return res.status(400).json({ error: "Invalid role." });

  const region = db.prepare("SELECT leaderUserId, governmentForm FROM regions WHERE id = ?").get(regionId) as any;
  if (!region) return res.status(404).json({ error: "Region not found." });
  if (region.leaderUserId !== user.id) return res.status(403).json({ error: "Solo il Leader può assegnare i ministri." });

  // Validate form rules
  const autocracies = ["DICTATORSHIP", "ONE_PARTY_SYSTEM", "EXECUTIVE_MONARCHY"];
  if (role === "foreignMinisterId" && autocracies.includes(region.governmentForm)) {
    return res.status(400).json({ error: "Questa forma di governo non prevede un Ministro degli Esteri." });
  }

  // Assign or remove
  if (ministerId) {
    const targetUser = db.prepare("SELECT id FROM users WHERE id = ?").get(ministerId);
    if (!targetUser) return res.status(404).json({ error: "Utente non trovato." });
    db.prepare(`UPDATE regions SET ${role} = ? WHERE id = ?`).run(ministerId, regionId);
  } else {
    db.prepare(`UPDATE regions SET ${role} = NULL WHERE id = ?`).run(regionId);
  }

  res.json({ success: true, role, ministerId });
});

app.post("/api/government/transition", authenticate, (req: any, res) => {
  const user = req.user;
  const { regionId, targetForm } = req.body;

  if (!regionId || !targetForm) return res.status(400).json({ error: "Missing parameters." });

  const region = db.prepare("SELECT leaderUserId, governmentForm FROM regions WHERE id = ?").get(regionId) as any;
  if (!region) return res.status(404).json({ error: "Region not found." });
  // If no leader (Parliamentary), allow anyone who can trigger it? 
  // Actually, usually Transition is a Law/Dictator action. 
  // Let's assume for manual transition we need the current leader or dictator.
  if (region.leaderUserId && region.leaderUserId !== user.id) {
    return res.status(403).json({ error: "Azione riservata al Leader dello Stato." });
  }

  const currentForm = region.governmentForm;

  // Dictionary of allowed direct transitions
  const allowedTransitions = [
    { from: "DICTATORSHIP", to: "ONE_PARTY_SYSTEM" },
    { from: "DICTATORSHIP", to: "EXECUTIVE_MONARCHY" },
    { from: "ONE_PARTY_SYSTEM", to: "DICTATORSHIP" },
    { from: "EXECUTIVE_MONARCHY", to: "DICTATORSHIP" },
    { from: "DICTATORSHIP", to: "PRESIDENTIAL_REPUBLIC" }, // Dictator stepping down manually
  ];

  const isValid = allowedTransitions.some(t => t.from === currentForm && t.to === targetForm);

  if (!isValid) {
    return res.status(400).json({
      error: `Transizione diretta da ${currentForm} a ${targetForm} non consentita. Passa per il Parlamento o usa le azioni corrette.`
    });
  }

  try {
    db.transaction(() => {
      db.prepare(`UPDATE regions SET governmentForm = ? WHERE id = ?`).run(targetForm, regionId);

      // Transition-specific logic
      if (targetForm === 'PARLIAMENTARY_REPUBLIC') {
        db.prepare("UPDATE regions SET leaderUserId = NULL, leaderTitle = 'None', nextLeaderElectionAt = NULL WHERE id = ?").run(regionId);
      } else if (['DICTATORSHIP', 'ONE_PARTY_SYSTEM', 'EXECUTIVE_MONARCHY'].includes(targetForm)) {
        // Current transitioning user becomes Dictator/King
        const newTitle = targetForm === 'EXECUTIVE_MONARCHY' ? 'Sovrano' : 'Dittatore';
        db.prepare("UPDATE regions SET leaderUserId = ?, leaderTitle = ?, nextLeaderElectionAt = NULL WHERE id = ?").run(user.id, newTitle, regionId);
      } else if (['PRESIDENTIAL_REPUBLIC', 'DOMINANT_PARTY'].includes(targetForm)) {
        // Reset election timer
        const nextElec = Date.now() + (5 * 24 * 60 * 60 * 1000);
        db.prepare("UPDATE regions SET leaderTitle = 'Leader', nextLeaderElectionAt = ? WHERE id = ?").run(nextElec, regionId);
      }
    })(); // Execute the transaction
    return res.json({ success: true, newForm: targetForm });
  } catch (err) {
    console.error("Transition error:", err);
    return res.status(500).json({ error: "Errore durante il cambio di governo." });
  }
});

// --- Leader System Specific API ---

app.post("/api/leader/candidate", authenticate, (req: any, res) => {
  const user = req.user;
  const { regionId } = req.body;

  const region = db.prepare("SELECT governmentForm, nextLeaderElectionAt FROM regions WHERE id = ?").get(regionId) as any;
  if (!region) return res.status(404).json({ error: "Regione non trovata." });
  if (!['PRESIDENTIAL_REPUBLIC', 'DOMINANT_PARTY'].includes(region.governmentForm)) {
    return res.status(400).json({ error: "Questa forma di governo non prevede elezioni del Leader." });
  }

  // Voter/Candidate must be a citizen
  if (user.residenceId !== regionId) {
    return res.status(403).json({ error: "Devi essere cittadino per candidarti." });
  }

  try {
    db.prepare("INSERT INTO leader_candidates (regionId, userId, votes) VALUES (?, ?, 0)").run(regionId, user.id);
    res.json({ success: true });
  } catch (e) {
    res.status(400).json({ error: "Sei già candidato." });
  }
});

app.post("/api/leader/vote", authenticate, (req: any, res) => {
  const user = req.user;
  const { regionId, candidateId } = req.body;

  const region = db.prepare("SELECT id FROM regions WHERE id = ?").get(regionId) as any;
  if (!region) return res.status(404).json({ error: "Regione non trovata." });
  if (user.residenceId !== regionId) return res.status(403).json({ error: "Devi essere cittadino per votare." });

  try {
    db.transaction(() => {
      db.prepare("INSERT INTO leader_votes (regionId, voterId, candidateId) VALUES (?, ?, ?)")
        .run(regionId, user.id, candidateId);
      db.prepare("UPDATE leader_candidates SET votes = votes + 1 WHERE regionId = ? AND userId = ?")
        .run(regionId, candidateId);
    })();
    res.json({ success: true });
  } catch (e) {
    res.status(400).json({ error: "Hai già votato in queste elezioni." });
  }
});

app.post("/api/leader/update-state-ui", authenticate, (req: any, res) => {
  const user = req.user;
  const { regionId, stateColor, stateHymn } = req.body;

  const region = db.prepare("SELECT leaderUserId FROM regions WHERE id = ?").get(regionId) as any;
  if (!region || region.leaderUserId !== user.id) return res.status(403).json({ error: "Solo il Leader può modificare queste impostazioni." });

  db.prepare("UPDATE regions SET stateColor = ?, stateHymn = ? WHERE id = ?")
    .run(stateColor || '#334155', stateHymn || '', regionId);

  res.json({ success: true });
});

app.post("/api/leader/orders", authenticate, (req: any, res) => {
  const user = req.user;
  const { regionId, title, body, audience } = req.body; // audience: 'CITIZENS', 'NEW_PLAYERS', 'ALL'

  const region = db.prepare("SELECT leaderUserId FROM regions WHERE id = ?").get(regionId) as any;
  if (!region || region.leaderUserId !== user.id) return res.status(403).json({ error: "Solo il Leader può emettere ordini." });

  const id = Math.random().toString(36).substring(2, 11);
  db.prepare("INSERT INTO leader_orders (id, regionId, authorUserId, title, body, createdAt, audience) VALUES (?, ?, ?, ?, ?, ?, ?)")
    .run(id, regionId, user.id, title, body, Date.now(), audience || 'ALL');

  res.json({ success: true, orderId: id });
});

app.get("/api/leader/orders/:regionId", (req, res) => {
  const { regionId } = req.params;
  const orders = db.prepare("SELECT * FROM leader_orders WHERE regionId = ? ORDER BY createdAt DESC LIMIT 10").all(regionId);
  res.json(orders);
});

// --- Nation Management API ---

app.post("/api/actions/change-displayed-nation", authenticate, (req: any, res) => {
  const user = req.user;
  const { nationId } = req.body;
  if (!nationId) return res.status(400).json({ error: "Nessuna nazione specificata." });

  db.prepare("UPDATE users SET displayedNation = ? WHERE id = ?").run(nationId, user.id);
  res.json({ success: true, displayedNation: nationId });
});

app.post("/api/actions/change-original-nation", authenticate, (req: any, res) => {
  const user = req.user;
  const { nationId } = req.body;
  if (!nationId) return res.status(400).json({ error: "Nessuna nazione specificata." });

  const now = Date.now();
  const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;
  if (now - user.lastOriginalNationChange < THIRTY_DAYS && user.lastOriginalNationChange !== 0) {
    const nextAvail = new Date(user.lastOriginalNationChange + THIRTY_DAYS).toLocaleDateString();
    return res.status(400).json({ error: `Puoi cambiare di nuovo la Nazione Originale il ${nextAvail}.` });
  }

  db.prepare("UPDATE users SET originalNation = ?, lastOriginalNationChange = ? WHERE id = ?").run(nationId, now, user.id);
  res.json({ success: true, originalNation: nationId, lastOriginalNationChange: now });
});

app.post("/api/actions/attack", authenticate, (req: any, res) => {
  const user = req.user;
  const { regionId } = req.body;
  const perks = user.perks;

  // RESISTENZA reduces energy in war too (same formula as work, capped at lv50)
  const resistenza = perks['RESISTENZA'] || 0;
  const energyReduction = Math.min(0.5, resistenza / 100);
  const energyCost = Math.ceil(GAME_CONFIG.ATTACK_ENERGY_COST * (1 - energyReduction));

  // Use medal if available to nullify energy cost
  let finalEnergyCost = energyCost;
  let usedMedal = false;

  if (user.warMedals > 0) {
    finalEnergyCost = 0;
    usedMedal = true;
  } else {
    if (user.energy < finalEnergyCost) return res.status(400).json({ error: "Not enough energy" });
  }

  if (!checkCooldown(user.id, "attack", GAME_CONFIG.ATTACK_COOLDOWN)) return res.status(400).json({ error: "Action on cooldown" });

  const region = db.prepare("SELECT * FROM regions WHERE id = ?").get(regionId) as any;
  if (!region) return res.status(404).json({ error: "Region not found" });

  // Bloc restriction
  const attackerBloc = db.prepare("SELECT blocId FROM bloc_memberships WHERE stateId = ? AND status = 'active'").get(user.regionId) as any;
  const defenderBloc = db.prepare("SELECT blocId FROM bloc_memberships WHERE stateId = ? AND status = 'active'").get(regionId) as any;
  if (attackerBloc && defenderBloc && attackerBloc.blocId === defenderBloc.blocId) {
    return res.status(403).json({ error: "Non puoi dichiarare guerra a un membro dello stesso Blocco Geopolitico." });
  }

  // Combined damage formula: FORZA (+5%/lv) + ISTRUZIONE (+2%/lv) + RESISTENZA (+3%/lv)
  const forzaBonus = (perks['FORZA'] || 0) * 0.05;
  const istruzBonus = (perks['ISTRUZIONE'] || 0) * 0.02;
  const resistBonus = (perks['RESISTENZA'] || 0) * 0.03;
  const totalDmgBonus = forzaBonus + istruzBonus + resistBonus;

  // Alpha-damage milestone bonuses for RESISTENZA (lv 50, 75, 100)
  let alphaBonus = 0;
  if (resistenza >= 50) alphaBonus += 0.10;
  if (resistenza >= 75) alphaBonus += 0.10;
  if (resistenza >= 100) alphaBonus += 0.15;

  const winProbability = Math.min(0.9, 0.3 + (user.influence / 1000) + totalDmgBonus + alphaBonus);
  const success = Math.random() < winProbability;

  if (usedMedal) {
    db.prepare("UPDATE users SET warMedals = warMedals - 1 WHERE id = ?").run(user.id);
  } else {
    db.prepare("UPDATE users SET energy = energy - ? WHERE id = ?").run(finalEnergyCost, user.id);
  }

  if (success) {
    db.prepare("UPDATE regions SET ownerUserId = ?, stability = stability - 20 WHERE id = ?")
      .run(user.id, regionId);

    const warId = Math.random().toString(36).substring(2, 9);
    db.prepare(`
      INSERT INTO wars (id, attackerCountryIso2, defenderCountryIso2, attackerUserId, defenderUserId, status, startedAt, endsAt, attackerScore, defenderScore, lastEventAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(warId, user.regionId, regionId, user.id, region.ownerUserId, 'ended', Date.now(), Date.now(), 100, 0, Date.now());

    addXP(user.id, GAME_CONFIG.XP_PER_ATTACK);
  } else {
    addXP(user.id, Math.floor(GAME_CONFIG.XP_PER_ATTACK / 2));
  }

  updateCooldown(user.id, "attack");
  res.json({ success, winProbability: Math.round(winProbability * 100) });
});

// --- War Interactive Deploy API ---
app.post("/api/wars/deploy", authenticate, (req: any, res) => {
  const user = req.user;
  const { warId, side, weaponId } = req.body;

  if (!warId || !side || !weaponId) return res.status(400).json({ error: "Dati mancanti." });
  if (side !== 'attacker' && side !== 'defender') return res.status(400).json({ error: "Schieramento non valido." });

  const war = db.prepare("SELECT * FROM wars WHERE id = ?").get(warId) as any;
  if (!war) return res.status(404).json({ error: "Guerra inesistente." });
  if (war.status !== 'active') return res.status(400).json({ error: "Questa guerra è già terminata." });

  const weapons: any = {
    infantry: { energy: 10, cash: 50, damage: 100 },
    tank: { energy: 30, cash: 500, damage: 1000 },
    airstrike: { energy: 50, cash: 2000, damage: 5000 }
  };

  const weapon = weapons[weaponId];
  if (!weapon) return res.status(400).json({ error: "Armamento sconosciuto." });

  if (user.energy < weapon.energy) return res.status(400).json({ error: `Energia insufficiente (richiesti ${weapon.energy}).` });
  if (user.money < weapon.cash) return res.status(400).json({ error: `Fondi insufficienti (richiesti $${weapon.cash}).` });

  // Damage Calculation
  let totalDamage = weapon.damage;
  const isPatriot = (side === 'attacker' && war.attackerCountryIso2 === user.originalNation) ||
    (side === 'defender' && war.defenderCountryIso2 === user.originalNation);

  if (isPatriot) totalDamage = Math.floor(totalDamage * 1.10);

  // Perks bonuses
  const forzaBonus = (user.perks?.['FORZA'] || 0) * 0.05;
  const resistBonus = (user.perks?.['RESISTENZA'] || 0) * 0.03;
  totalDamage = Math.floor(totalDamage * (1 + forzaBonus + resistBonus));

  try {
    db.transaction(() => {
      // Deduct resources
      db.prepare("UPDATE users SET energy = energy - ?, money = money - ? WHERE id = ?").run(weapon.energy, weapon.cash, user.id);

      // Update scores
      if (side === 'attacker') {
        db.prepare("UPDATE wars SET attackerScore = attackerScore + ? WHERE id = ?").run(totalDamage, warId);
      } else {
        db.prepare("UPDATE wars SET defenderScore = defenderScore + ? WHERE id = ?").run(totalDamage, warId);
      }
    })();

    res.json({ success: true, damageDealt: totalDamage, side });
  } catch (err) {
    res.status(500).json({ error: "Errore durante lo schieramento in battaglia." });
  }
});

// Articles API
app.get("/api/articles", authenticate, (req, res) => {
  const articles = db.prepare("SELECT * FROM articles ORDER BY createdAt DESC LIMIT 50").all();
  res.json(articles);
});

app.get("/api/articles/:id", authenticate, (req, res) => {
  const article = db.prepare("SELECT * FROM articles WHERE id = ?").get(req.params.id);
  if (!article) return res.status(404).json({ error: "Article not found" });
  res.json(article);
});

app.post("/api/articles", authenticate, (req: any, res) => {
  const { title, content } = req.body;
  if (!title || !content) return res.status(400).json({ error: "Title and content required" });

  // Rate limit: max 5 per hour
  const oneHourAgo = Date.now() - (60 * 60 * 1000);
  const count = db.prepare("SELECT COUNT(*) as count FROM articles WHERE authorId = ? AND createdAt > ?")
    .get(req.user.id, oneHourAgo) as { count: number };

  if (count.count >= 5) return res.status(429).json({ error: "Rate limit exceeded (max 5 articles per hour)" });

  const id = Math.random().toString(36).substring(2, 9);
  const now = Date.now();
  db.prepare("INSERT INTO articles (id, authorId, authorName, title, content, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?)")
    .run(id, req.user.id, req.user.username, title, content, now, now);

  res.json({ success: true, id });
});

app.put("/api/articles/:id", authenticate, (req: any, res) => {
  const { title, content } = req.body;
  const article = db.prepare("SELECT authorId FROM articles WHERE id = ?").get(req.params.id) as any;
  if (!article) return res.status(404).json({ error: "Article not found" });
  if (article.authorId !== req.user.id) return res.status(403).json({ error: "Forbidden" });

  db.prepare("UPDATE articles SET title = ?, content = ?, updatedAt = ? WHERE id = ?")
    .run(title, content, Date.now(), req.params.id);

  res.json({ success: true });
});

app.delete("/api/articles/:id", authenticate, (req: any, res) => {
  const article = db.prepare("SELECT authorId FROM articles WHERE id = ?").get(req.params.id) as any;
  if (!article) return res.status(404).json({ error: "Article not found" });
  if (article.authorId !== req.user.id) return res.status(403).json({ error: "Forbidden" });

  db.prepare("DELETE FROM articles WHERE id = ?").run(req.params.id);
  res.json({ success: true });
});

// Chat API
app.get("/api/chat", authenticate, (req, res) => {
  const messages = db.prepare(
    "SELECT id, userId, username, regionId, message, createdAt FROM chat_messages ORDER BY createdAt DESC LIMIT 50"
  ).all() as any[];
  res.json(messages.reverse()); // oldest first for display
});

app.post("/api/chat", authenticate, (req: any, res) => {
  const { message } = req.body;
  const user = req.user;
  if (!message || typeof message !== "string" || message.trim().length === 0) {
    return res.status(400).json({ error: "Messaggio vuoto" });
  }
  if (message.trim().length > 280) {
    return res.status(400).json({ error: "Messaggio troppo lungo (max 280 caratteri)" });
  }

  // Rate limit: 1 message per 5 seconds
  const lastMsg = db.prepare(
    "SELECT createdAt FROM chat_messages WHERE userId = ? ORDER BY createdAt DESC LIMIT 1"
  ).get(user.id) as { createdAt: number } | undefined;
  if (lastMsg && Date.now() - lastMsg.createdAt < 5000) {
    return res.status(429).json({ error: "Aspetta qualche secondo prima di inviare un altro messaggio" });
  }

  db.prepare(
    "INSERT INTO chat_messages (userId, username, regionId, message, createdAt) VALUES (?, ?, ?, ?, ?)"
  ).run(user.id, user.username, user.regionId || "?", message.trim(), Date.now());

  res.json({ success: true });
});

// Profile Avatar
app.post("/api/profile/avatar", authenticate, (req: any, res) => {
  const { avatarData } = req.body;
  if (!avatarData || typeof avatarData !== "string") {
    return res.status(400).json({ error: "Dati immagine mancanti" });
  }
  // Must be a valid base64 data URL (jpeg or png only)
  if (!avatarData.startsWith("data:image/")) {
    return res.status(400).json({ error: "Formato immagine non valido" });
  }
  // Limit: ~512KB base64
  if (avatarData.length > 700000) {
    return res.status(400).json({ error: "Immagine troppo grande (max ~512KB)" });
  }
  db.prepare("UPDATE users SET avatarData = ? WHERE id = ?")
    .run(avatarData, req.user.id);
  res.json({ success: true });
});

// Dev: Add currency (use for testing)
app.post("/api/dev/add-currency", authenticate, (req: any, res) => {
  const { cash = 10000, gold = 10000 } = req.body;
  db.prepare("UPDATE users SET money = money + ?, gold = gold + ? WHERE id = ?")
    .run(Number(cash), Number(gold), req.user.id);
  res.json({ success: true, cash, gold });
});

// ==========================================
// PLAYER-DRIVEN FACTORIES API
// ==========================================

const FACTORY_TYPES = ['oil', 'minerals', 'uranium', 'diamonds'];
const FACTORY_CREATE_COST = {
  oil: 5000,
  minerals: 5000,
  uranium: 15000,
  diamonds: 25000
};

app.get("/api/factories", authenticate, (req: any, res) => {
  const { regionId, ownerId } = req.query;
  let query = `
    SELECT f.*, u.username as ownerName 
    FROM factories f 
    LEFT JOIN users u ON f.ownerUserId = u.id 
    WHERE 1=1
  `;
  const params: any[] = [];

  if (regionId) {
    query += " AND f.regionId = ?";
    params.push(regionId);
  }
  if (ownerId) {
    query += " AND f.ownerUserId = ?";
    params.push(ownerId);
  }
  query += " ORDER BY f.level DESC, f.createdAt DESC";

  const factories = db.prepare(query).all(...params);
  res.json(factories);
});

app.post("/api/factories/create", authenticate, (req: any, res) => {
  const user = req.user;
  const { name, type, regionId } = req.body;

  if (!name || name.trim().length === 0) return res.status(400).json({ error: "Nome obbligatorio." });
  if (!FACTORY_TYPES.includes(type)) return res.status(400).json({ error: "Tipo di risorsa non valido." });

  const cost = FACTORY_CREATE_COST[type as keyof typeof FACTORY_CREATE_COST] || 5000;
  if (user.money < cost) return res.status(400).json({ error: `Fondi insufficienti. Costa $${cost.toLocaleString()}` });

  // Must be in the region (or have permit)
  if (user.regionId !== regionId && user.residenceId !== regionId && user.workPermitId !== regionId) {
    return res.status(403).json({ error: "Devi viaggiare in questa regione o averne la residenza/permesso." });
  }

  const region = db.prepare("SELECT id FROM regions WHERE id = ?").get(regionId);
  if (!region) return res.status(404).json({ error: "Regione inesistente." });

  try {
    db.transaction(() => {
      const id = Math.random().toString(36).substring(2, 11);
      db.prepare("INSERT INTO factories (id, name, type, regionId, ownerUserId, level, exp, wage, budget, createdAt) VALUES (?, ?, ?, ?, ?, 1, 0, 10, 0, ?)")
        .run(id, name.trim(), type, regionId, user.id, Date.now());
      db.prepare("UPDATE users SET money = money - ? WHERE id = ?").run(cost, user.id);
    })();
    res.json({ success: true, cost });
  } catch (err) {
    res.status(500).json({ error: "Errore nella creazione della fabbrica." });
  }
});

app.post("/api/factories/deposit", authenticate, (req: any, res) => {
  const user = req.user;
  const { factoryId, amount } = req.body;
  const numAmount = parseInt(amount, 10);

  if (isNaN(numAmount) || numAmount <= 0) return res.status(400).json({ error: "Importo non valido." });
  if (user.money < numAmount) return res.status(400).json({ error: "Fondi insufficienti." });

  const factory = db.prepare("SELECT ownerUserId FROM factories WHERE id = ?").get(factoryId) as any;
  if (!factory) return res.status(404).json({ error: "Fabbrica inesistente." });
  if (factory.ownerUserId !== user.id) return res.status(403).json({ error: "Non sei il proprietario." });

  try {
    db.transaction(() => {
      db.prepare("UPDATE factories SET budget = budget + ? WHERE id = ?").run(numAmount, factoryId);
      db.prepare("UPDATE users SET money = money - ? WHERE id = ?").run(numAmount, user.id);
    })();
    res.json({ success: true, deposited: numAmount });
  } catch (err) {
    res.status(500).json({ error: "Errore nel deposito." });
  }
});

app.post("/api/factories/update-wage", authenticate, (req: any, res) => {
  const user = req.user;
  const { factoryId, wage } = req.body;
  const numWage = parseInt(wage, 10);

  if (isNaN(numWage) || numWage <= 0) return res.status(400).json({ error: "Salario non valido." });

  const factory = db.prepare("SELECT ownerUserId FROM factories WHERE id = ?").get(factoryId) as any;
  if (!factory) return res.status(404).json({ error: "Fabbrica inesistente." });
  if (factory.ownerUserId !== user.id) return res.status(403).json({ error: "Non sei il proprietario." });

  db.prepare("UPDATE factories SET wage = ? WHERE id = ?").run(numWage, factoryId);
  res.json({ success: true, wage: numWage });
});

app.post("/api/factories/upgrade", authenticate, (req: any, res) => {
  const user = req.user;
  const { factoryId } = req.body;

  const factory = db.prepare("SELECT ownerUserId, level FROM factories WHERE id = ?").get(factoryId) as any;
  if (!factory) return res.status(404).json({ error: "Fabbrica inesistente." });
  if (factory.ownerUserId !== user.id) return res.status(403).json({ error: "Non sei il proprietario." });

  const costCash = 10000 * Math.pow(1.5, factory.level);
  if (user.money < costCash) return res.status(400).json({ error: `Fondi insufficienti per l'upgrade al lv ${factory.level + 1}. Costo: $${costCash.toLocaleString()}` });

  try {
    db.transaction(() => {
      db.prepare("UPDATE factories SET level = level + 1 WHERE id = ?").run(factoryId);
      db.prepare("UPDATE users SET money = money - ? WHERE id = ?").run(costCash, user.id);
    })();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Errore nell'upgrade." });
  }
});


// Change username
app.put("/api/profile/username", authenticate, (req: any, res) => {
  const { username } = req.body;
  if (!username || typeof username !== "string") return res.status(400).json({ error: "Username mancante" });
  const trimmed = username.trim();
  if (trimmed.length < 3 || trimmed.length > 20) return res.status(400).json({ error: "Username deve essere tra 3 e 20 caratteri" });
  if (!/^[a-zA-Z0-9_]+$/.test(trimmed)) return res.status(400).json({ error: "Solo lettere, numeri e underscore" });
  try {
    db.prepare("UPDATE users SET username = ? WHERE id = ?").run(trimmed, req.user.id);
    // Also update authorName in articles
    db.prepare("UPDATE articles SET authorName = ? WHERE authorId = ?").run(trimmed, req.user.id);
    res.json({ success: true, username: trimmed });
  } catch (e: any) {
    if (e.message?.includes("UNIQUE")) return res.status(409).json({ error: "Username già in uso" });
    res.status(500).json({ error: "Errore interno" });
  }
});

app.post("/api/work", authenticate, (req: any, res) => {
  const user = req.user;
  const userRegion = user.regionId || 'IT';
  const { factoryId } = req.body;

  const factory = db.prepare("SELECT * FROM factories WHERE id = ?").get(factoryId) as any;
  if (!factory) return res.status(404).json({ error: "Fabbrica non trovata." });

  // Require player to be in the same region physically
  if (factory.regionId !== userRegion) return res.status(400).json({ error: "Devi viaggiare in questa regione per lavorare qui." });

  // Controllo immigrazione
  const currentRegion = db.prepare("SELECT * FROM regions WHERE id = ?").get(factory.regionId) as any;
  const restrictionsActive = currentRegion?.workRestrictions === 1;
  const isResident = user.residenceId === factory.regionId;
  const hasWorkPermit = user.workPermitId === factory.regionId;

  if (restrictionsActive && !isResident && !hasWorkPermit && user.id !== factory.ownerUserId) {
    return res.status(403).json({ error: "Questa regione richiede un Permesso di Lavoro." });
  }

  // Cooldown
  const lastWork = db.prepare("SELECT lastUsed FROM user_factory_cooldowns WHERE userId = ? AND factoryId = ?")
    .get(user.id, factoryId) as { lastUsed: number } | undefined;

  // Base cooldown: 10 minutes (600s)
  if (lastWork && Date.now() - lastWork.lastUsed < 600 * 1000) {
    return res.status(400).json({ error: "Fabbrica in cooldown (10 min)." });
  }

  // Energy
  const perks = user.perks;
  const energyEfficiency = (perks['RESISTENZA'] || 0) * 0.005;
  const energyCost = Math.ceil(10 * (1 - energyEfficiency)); // Base 10 energy
  if (user.energy < energyCost) return res.status(400).json({ error: "Energia insufficiente." });

  // Check budget
  if (factory.budget < factory.wage) {
    return res.status(400).json({ error: "L'azienda non ha abbastanza fondi per pagarti il salario." });
  }

  // Check Owner Storage Space
  const owner = db.prepare("SELECT id FROM users WHERE id = ?").get(factory.ownerUserId) as any;
  if (!owner) return res.status(404).json({ error: "Proprietario inesistente." });

  const ownerInv = db.prepare("SELECT SUM(quantity) as vol FROM user_inventory WHERE userId = ?").get(owner.id) as { vol: number };
  const ownerPerksRaw = db.prepare("SELECT level FROM perks WHERE userId = ? AND perkId = 'RESISTENZA'").get(owner.id) as any;
  const ownerResistenza = ownerPerksRaw ? ownerPerksRaw.level : 0;

  const maxStorage = Math.floor(GAME_CONFIG.STORAGE_BASE_CAPACITY * (1 + (ownerResistenza * 0.01)));
  const currentVol = ownerInv?.vol || 0;

  // Calculate Output Amount
  // Base output: level * 2. 
  let outputBase = factory.level * 2;

  // Apply region multiplier
  let bonusMult = 1.0;
  if (factory.type === 'oil') bonusMult = currentRegion.oilBonus || 1.0;
  else if (factory.type === 'minerals') bonusMult = currentRegion.mineralsBonus || 1.0;
  else if (factory.type === 'uranium') bonusMult = currentRegion.uraniumBonus || 1.0;
  else if (factory.type === 'diamonds') bonusMult = currentRegion.diamondsBonus || 1.0;

  const finalOutput = Math.max(1, Math.floor(outputBase * bonusMult));

  // PRESIDENTIAL_REPUBLIC: Double wage bonus for Leader and economic/foreign ministers
  let govBonus = 1;
  if (currentRegion && currentRegion.governmentForm === 'PRESIDENTIAL_REPUBLIC') {
    if (user.id === currentRegion.ownerUserId || user.id === currentRegion.economicAdviserId || user.id === currentRegion.foreignMinisterId) {
      govBonus = 2;
    }
  }

  const finalWage = Math.floor(factory.wage * govBonus);

  if (factory.budget < finalWage) {
    return res.status(400).json({ error: "L'azienda non ha abbastanza fondi per pagarti il salario." });
  }

  if (currentVol + finalOutput > maxStorage) {
    return res.status(400).json({ error: "Il magazzino dell'azienda è pieno." });
  }

  // Execute Work Transaction
  try {
    db.transaction(() => {
      // Deduct budget, add xp to factory
      db.prepare("UPDATE factories SET budget = budget - ?, exp = exp + 1 WHERE id = ?").run(finalWage, factory.id);

      // Pay worker, deduct energy
      db.prepare("UPDATE users SET money = money + ?, energy = energy - ? WHERE id = ?").run(finalWage, energyCost, user.id);

      // Cooldown
      db.prepare("INSERT OR REPLACE INTO user_factory_cooldowns (userId, factoryId, lastUsed) VALUES (?, ?, ?)").run(user.id, factoryId, Date.now());

      // Give item to owner
      const existItem = db.prepare("SELECT quantity FROM user_inventory WHERE userId = ? AND itemId = ?").get(owner.id, factory.type) as any;
      if (existItem) {
        db.prepare("UPDATE user_inventory SET quantity = quantity + ? WHERE userId = ? AND itemId = ?").run(finalOutput, owner.id, factory.type);
      } else {
        db.prepare("INSERT INTO user_inventory (userId, itemId, quantity) VALUES (?, ?, ?)").run(owner.id, factory.type, finalOutput);
      }

      // 1% chance to drop 1 Gold for the worker
      if (Math.random() < 0.01) {
        db.prepare("UPDATE users SET gold = gold + 1 WHERE id = ?").run(user.id);
      }
    })();

    addXP(user.id, GAME_CONFIG.XP_PER_WORK);
    res.json({ success: true, earnings: factory.wage, output: finalOutput });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Errore durante il lavoro." });
  }
});

// Wars API
app.get("/api/wars", authenticate, (req, res) => {
  const active = db.prepare("SELECT * FROM wars WHERE status = 'active' ORDER BY startedAt DESC").all();
  const ended = db.prepare("SELECT * FROM wars WHERE status = 'ended' ORDER BY endsAt DESC LIMIT 20").all();
  res.json({ active, ended });
});

app.get("/api/wars/:id", authenticate, (req, res) => {
  const war = db.prepare("SELECT * FROM wars WHERE id = ?").get(req.params.id);
  if (!war) return res.status(404).json({ error: "War not found" });
  res.json(war);
});

app.post("/api/perks/upgrade", authenticate, async (req: any, res) => {
  const user = req.user;
  const { perkId, useGold } = req.body;

  const perkDef = PERKS_DEFS.find(p => p.id === perkId);
  if (!perkDef) return res.status(404).json({ error: "Perk non trovato" });

  const currentLevel = user.perks[perkId] || 0;

  const targetLevel = currentLevel + 1;
  const baseCashCost = (perkDef as any).baseCashCost || 2000;
  const baseGoldCost = (perkDef as any).baseGoldCost || 20;
  const baseTimeCashSec = (perkDef as any).baseTimeCashSec || 3600;
  const baseTimeGoldSec = (perkDef as any).baseTimeGoldSec || 1200;

  const cashCost = Math.round(baseCashCost * Math.pow(1.5, currentLevel));
  const goldCost = Math.ceil(baseGoldCost * Math.pow(1.4, currentLevel));
  const cashTimeSec = Math.round(baseTimeCashSec * Math.pow(1.3, currentLevel));
  const goldTimeSec = Math.round(baseTimeGoldSec * Math.pow(1.3, currentLevel));

  // --- Enforce ONE upgrade at a time (globally across all perks) ---
  let existingUpgrades: Record<string, any> = {};
  try {
    const row = db.prepare("SELECT perkUpgradesJson FROM users WHERE id = ?").get(user.id) as any;
    existingUpgrades = JSON.parse(row?.perkUpgradesJson || '{}');
  } catch { }

  const nowTs = Date.now();
  const anyActive = Object.entries(existingUpgrades).some(([id, upg]: [string, any]) =>
    upg.willCompleteAt > nowTs
  );
  if (anyActive) {
    return res.status(400).json({ error: "Hai già un potenziamento in corso. Puoi imparare solo una abilità alla volta." });
  }

  // Check if this specific perk already queued
  if (existingUpgrades[perkId]?.willCompleteAt > nowTs) {
    return res.status(400).json({ error: "Questo perk è già in fase di potenziamento." });
  }

  // Cash is always required as a base cost
  if (user.money < cashCost) {
    return res.status(400).json({ error: `Cash insufficiente. Costo: $${cashCost.toLocaleString()}` });
  }

  if (useGold && user.gold < goldCost) {
    return res.status(400).json({ error: `Gold insufficiente. Servono 🏅 ${goldCost}` });
  }

  const timeSec = useGold ? goldTimeSec : cashTimeSec;
  const willCompleteAt = nowTs + (timeSec * 1000);

  // Deduct currency
  if (useGold) {
    db.prepare("UPDATE users SET money = money - ?, gold = gold - ? WHERE id = ?")
      .run(cashCost, goldCost, user.id);
  } else {
    db.prepare("UPDATE users SET money = money - ? WHERE id = ?")
      .run(cashCost, user.id);
  }

  // Store upgrade timer
  existingUpgrades[perkId] = {
    startedAt: nowTs,
    willCompleteAt,
    targetLevel,
    usedGold: !!useGold,
  };

  db.prepare("UPDATE users SET perkUpgradesJson = ? WHERE id = ?")
    .run(JSON.stringify(existingUpgrades), user.id);

  // Optional Firestore sync
  if (process.env.FIREBASE_PROJECT_ID) {
    try {
      const fs = getFirestore();
      await fs.collection("users").doc(user.id).set({
        perkUpgrades: { [perkId]: existingUpgrades[perkId] }
      }, { merge: true });
    } catch (fsErr) {
      console.error("Firestore perk sync failed (non-critical):", fsErr);
    }
  }

  return res.json({ success: true, queued: true, willCompleteAt, timeSec });
});

app.post("/api/perks/booster", authenticate, async (req: any, res) => {
  const user = req.user;
  const { perkId, useGold } = req.body;

  const perkDef = PERKS_DEFS.find(p => p.id === perkId);
  if (!perkDef) return res.status(404).json({ error: "Perk non trovato" });

  const currentLevel = user.perks[perkId] || 0;

  // Check cooldown (only if there was a previous activation)
  let activeBoosters: Record<string, any> = {};
  try {
    activeBoosters = JSON.parse(user.boostersJson || '{}');
  } catch { activeBoosters = {}; }

  const nowTs = Date.now();
  const booster = activeBoosters[perkId];

  if (booster && nowTs < booster.lastActivatedAt + BOOSTER_CONFIG.COOLDOWN_MS) {
    const remainingCooldown = booster.lastActivatedAt + BOOSTER_CONFIG.COOLDOWN_MS - nowTs;
    const days = Math.floor(remainingCooldown / (24 * 60 * 60 * 1000));
    const hours = Math.floor((remainingCooldown % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
    return res.status(400).json({ error: `Booster in ricarica. Riprova fra ${days}g ${hours}h.` });
  }

  const price = useGold ? BOOSTER_CONFIG.GOLD_PRICE : BOOSTER_CONFIG.CASH_PRICE;
  if (useGold) {
    if (user.gold < price) return res.status(400).json({ error: `Oro insufficiente. Servono 🏅 ${price} Gold.` });
  } else {
    if (user.money < price) return res.status(400).json({ error: `Cash insufficiente. Costo: $${price.toLocaleString()}` });
  }

  // Duration decay formula: base / (1 + perkLevel * decay)
  const baseDuration = useGold ? BOOSTER_CONFIG.BASE_DURATION_GOLD_MS : BOOSTER_CONFIG.BASE_DURATION_CASH_MS;
  const duration = Math.round(baseDuration / (1 + currentLevel * BOOSTER_CONFIG.DURATION_DECAY));
  const expiresAt = nowTs + duration;

  // Deduct currency
  if (useGold) {
    db.prepare("UPDATE users SET gold = gold - ? WHERE id = ?").run(price, user.id);
  } else {
    db.prepare("UPDATE users SET money = money - ? WHERE id = ?").run(price, user.id);
  }

  // Save booster
  activeBoosters[perkId] = {
    expiresAt,
    lastActivatedAt: nowTs,
    isGold: !!useGold
  };

  db.prepare("UPDATE users SET boostersJson = ? WHERE id = ?")
    .run(JSON.stringify(activeBoosters), user.id);

  return res.json({
    success: true,
    expiresAt,
    duration,
    perkId
  });
});

// ==============================================================
// SANCTIONS SYSTEM
// ==============================================================

const canSellInState = (targetStateId: string, originStateId: string): boolean => {
  const sanction = db.prepare("SELECT id FROM sanctions WHERE fromStateId = ? AND targetStateId = ? AND status = 'ACTIVE'").get(targetStateId, originStateId);
  return !sanction;
};

app.get("/api/countries/:iso2/sanctions", authenticate, (req: any, res) => {
  try {
    const stateId = (req.params.iso2 || '').toUpperCase();
    if (!stateId) return res.status(400).json({ error: "ISO2 parameter missing" });

    const normalizedId = stateId.replace('NATION_', '').replace('nation_', '');
    
    const sanctions = db.prepare(`
        SELECT s.*, 
               COALESCE(n.name, r.name, s.targetStateId) as targetStateName 
        FROM sanctions s
        LEFT JOIN nations n ON (s.targetStateId = n.id OR ('nation_' || s.targetStateId) = n.id OR s.targetStateId = REPLACE(n.id, 'nation_', ''))
        LEFT JOIN regions r ON (s.targetStateId = r.id OR s.targetStateId = REPLACE(r.id, 'nation_', ''))
        WHERE (s.fromStateId = ? OR s.fromStateId = ? OR s.fromStateId = ('nation_' || ?) OR s.fromStateId = ('NATION_' || ?))
          AND s.status = 'ACTIVE'
    `).all(stateId, normalizedId, normalizedId, normalizedId);
    
    console.log(`[API] GET /api/countries/${stateId}/sanctions => Found ${sanctions.length} active sanctions (normalized: ${normalizedId})`);
    res.json(sanctions);
  } catch (err: any) {
    console.error(`[CRITICAL] Error fetching sanctions for ${req.params.iso2}:`, err.message);
    res.status(500).json({ error: "Internal server error while fetching sanctions." });
  }
});

app.post("/api/sanctions/apply", authenticate, (req: any, res) => {
  const user = req.user;
  const { targetStateId: rawTarget, fromStateId: rawFrom } = req.body;
  
  const targetStateId = rawTarget?.toUpperCase().replace('NATION_', '').replace('nation_', '');
  const finalFromStateId = (rawFrom || user.regionId)?.toUpperCase().replace('NATION_', '').replace('nation_', '');

  console.log(`[API] Sanction Apply request: ${finalFromStateId} -> ${targetStateId} (By: ${user.username})`);

  if (!targetStateId || targetStateId === finalFromStateId) {
    return res.status(400).json({ error: "Stato target non valido." });
  }

  // Check authority: Leader, Economics Minister, or Economic Advisor (dictatorship) of finalFromStateId
  const region = db.prepare("SELECT ownerUserId, economicAdviserId, dictatorship FROM regions WHERE id = ?").get(finalFromStateId) as any;
  if (!region) {
    console.log(`[API ERROR] Region not found: ${finalFromStateId}`);
    return res.status(404).json({ error: "Regione non trovata." });
  }

  const isLeader = region.ownerUserId === user.id;
  const isEconomicAdvisor = region.economicAdviserId === user.id;

  // Also check ministers table for 'economics' role
  const minister = db.prepare("SELECT id FROM ministers WHERE stateId = ? AND userId = ? AND role = 'economics' AND status = 'ACTIVE'").get(finalFromStateId, user.id);

  if (!isLeader && !isEconomicAdvisor && !minister) {
    console.log(`[AUTH] Refused sanction apply! User ${user.username} has no authority in ${finalFromStateId}`);
    return res.status(403).json({ error: "Non hai l'autorità per applicare sanzioni in questo Stato." });
  }

  try {
    const existing = db.prepare("SELECT id FROM sanctions WHERE fromStateId = ? AND targetStateId = ? AND status = 'ACTIVE'").get(finalFromStateId, targetStateId);
    if (existing) {
      console.log(`[API] Sanction already exists: ${finalFromStateId} -> ${targetStateId}`);
      return res.status(400).json({ error: "Sanzione già attiva per questo Stato." });
    }

    db.transaction(() => {
      const id = Math.random().toString(36).substring(2, 11);
      db.prepare("INSERT INTO sanctions (id, fromStateId, targetStateId, status, createdAt, createdByUserId) VALUES (?, ?, ?, 'ACTIVE', ?, ?)")
        .run(id, finalFromStateId, targetStateId, Date.now(), user.id);

      // Market Cleanup: Remove all existing offers originating from the target state in this region
      db.prepare("DELETE FROM market_offers WHERE regionId = ? AND originStateId = ?").run(finalFromStateId, targetStateId);
    })();

    console.log(`[API] Sanction SUCCESS: ${finalFromStateId} -> ${targetStateId}`);
    res.json({ success: true });
  } catch (err: any) {
    console.error(`[API ERROR] sanctions apply: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/sanctions/revoke", authenticate, (req: any, res) => {
  const user = req.user;
  const { sanctionId } = req.body;

  const sanction = db.prepare("SELECT * FROM sanctions WHERE id = ?").get(sanctionId) as any;
  if (!sanction) return res.status(404).json({ error: "Sanzione non trovata." });

  // Check authority in the fromState
  const region = db.prepare("SELECT ownerUserId, economicAdviserId FROM regions WHERE id = ?").get(sanction.fromStateId) as any;
  const minister = db.prepare("SELECT id FROM ministers WHERE stateId = ? AND userId = ? AND role = 'economics' AND status = 'ACTIVE'").get(sanction.fromStateId, user.id);

  if (region.ownerUserId !== user.id && region.economicAdviserId !== user.id && !minister) {
    return res.status(403).json({ error: "Non hai l'autorità per revocare sanzioni." });
  }

  try {
    db.prepare("UPDATE sanctions SET status = 'REVOKED', revokedAt = ?, revokedByUserId = ? WHERE id = ?")
      .run(Date.now(), user.id, sanctionId);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ==============================================================
// MARKET API (Player-Driven)
// ==============================================================

app.get("/api/market/offers", authenticate, (req: any, res) => {
  try {
    const offers = db.prepare(`
      SELECT o.*, 
        (SELECT MIN(price) FROM market_offers WHERE itemId = o.itemId) as minPrice
      FROM market_offers o 
      ORDER BY o.createdAt DESC LIMIT 100
    `).all();
    res.json(offers);
  } catch (err) {
    res.status(500).json({ error: "Errore nel caricamento del mercato." });
  }
});

app.post("/api/market/offer", authenticate, (req: any, res) => {
  const user = req.user;
  const { itemId, quantity, price } = req.body;

  if (!itemId || !quantity || !price || quantity <= 0 || price <= 0) {
    return res.status(400).json({ error: "Parametri non validi." });
  }

  try {
    // Check Cooldown
    const lastOffer = db.prepare("SELECT createdAt FROM market_offers WHERE sellerId = ? AND itemId = ? ORDER BY createdAt DESC LIMIT 1").get(user.id, itemId) as any;
    if (lastOffer && Date.now() - lastOffer.createdAt < GAME_CONFIG.MARKET_OFFER_COOLDOWN_MS) {
      return res.status(400).json({ error: "Devi attendere 5 minuti prima di pubblicare un'altra offerta per questo oggetto." });
    }

    // Check Inventory
    const userInv = db.prepare("SELECT quantity FROM user_inventory WHERE userId = ? AND itemId = ?").get(user.id, itemId) as any;
    if (!userInv || userInv.quantity < quantity) {
      return res.status(400).json({ error: "Non hai abbastanza risorse nell'inventario per creare questa offerta." });
    }

    // Get Tax Rate & Sanctions
    const region = db.prepare("SELECT marketTaxRate, sanctionsActive, sanctionsScope FROM regions WHERE id = ?").get(user.regionId) as any;
    const taxRate = region?.marketTaxRate !== undefined ? region.marketTaxRate : 10;

    // Sanctions Check (Directional)
    if (!canSellInState(user.regionId, user.originalNation)) {
      return res.status(403).json({ error: "Sanzioni commerciali attive: non puoi vendere prodotti della tua nazione in questo Stato." });
    }

    // Sanctions Check (Old Scope System - Keeping for compatibility if needed)
    if (region?.sanctionsActive) {
      const scope = JSON.parse(region.sanctionsScope || '{}');
      const itemType = getItemType(itemId); // Helper to determine 'resources', 'weapons', or 'items'

      if (scope[itemType] && user.originalNation !== user.regionId) {
        return res.status(403).json({ error: `Sanzioni attive: non puoi vendere ${itemType} in questo Stato se non è la tua nazione d'origine.` });
      }
    }

    // Transaction
    db.transaction(() => {
      // Deduct inventory
      db.prepare("UPDATE user_inventory SET quantity = quantity - ? WHERE userId = ? AND itemId = ?").run(quantity, user.id, itemId);
      db.prepare("DELETE FROM user_inventory WHERE userId = ? AND itemId = ? AND quantity <= 0").run(user.id, itemId);

      const offerId = Math.random().toString(36).substring(2, 11);
      db.prepare("INSERT INTO market_offers (id, sellerId, sellerName, itemId, quantity, price, regionId, taxRate, originStateId, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
        .run(offerId, user.id, user.username, itemId, quantity, price, user.regionId, taxRate, user.originalNation, Date.now());
    })();

    res.json({ success: true });
  } catch (err: any) {
    console.error("Market offer error:", err);
    res.status(500).json({ error: "Errore durante la creazione dell'offerta." });
  }
});

app.post("/api/market/buy", authenticate, (req: any, res) => {
  const user = req.user;
  const { offerId, quantity, isStateBuy } = req.body;

  if (!offerId || !quantity || quantity <= 0) {
    return res.status(400).json({ error: "Parametri non validi." });
  }

  try {
    const result = db.transaction(() => {
      const offer = db.prepare("SELECT * FROM market_offers WHERE id = ?").get(offerId) as any;
      if (!offer || offer.quantity < quantity) {
        throw new Error("L'offerta non esiste o la quantità richiesta non è disponibile.");
      }

      if (offer.sellerId === user.id && !isStateBuy) {
        throw new Error("Non puoi comprare la tua stessa offerta a meno che non sia per lo Stato.");
      }

      // Sanctions Check
      if (!canSellInState(offer.regionId, offer.originStateId)) {
        throw new Error("Sanzioni commerciali attive: impossibile acquistare prodotti provenienti da questo Stato.");
      }

      const totalPrice = offer.price * quantity;

      // Anti-abuse: check min price
      const minPriceOffer = db.prepare("SELECT MIN(price) as minPrice FROM market_offers WHERE itemId = ?").get(offer.itemId) as any;
      if (minPriceOffer && minPriceOffer.minPrice > 0) {
        const abusiveLimit = minPriceOffer.minPrice * GAME_CONFIG.MARKET_ANTI_ABUSE_PERCENTAGE;
        if (offer.price > abusiveLimit) {
          throw new Error(`Limite Anti-Abuso superato. Il prezzo massimo consentito per acquisti è $${Math.round(abusiveLimit)} (${Math.round(GAME_CONFIG.MARKET_ANTI_ABUSE_PERCENTAGE * 100)}% min).`);
        }
      }

      // Process Buy
      if (isStateBuy) {
        const region = db.prepare("SELECT ownerUserId, treasury FROM regions WHERE id = ?").get(user.residenceId || 'IT') as any;
        if (!region || region.ownerUserId !== user.id) throw new Error("Non sei autorizzato a usare i fondi del tuo Stato.");
        if (region.treasury < totalPrice) throw new Error("Lo Stato non ha abbastanza fondi.");

        db.prepare("UPDATE regions SET treasury = treasury - ? WHERE id = ?").run(totalPrice, user.residenceId || 'IT');

        const stateInv = db.prepare("SELECT quantity FROM state_inventory WHERE regionId = ? AND itemId = ?").get(user.residenceId || 'IT', offer.itemId) as any;
        if (stateInv) db.prepare("UPDATE state_inventory SET quantity = quantity + ? WHERE regionId = ? AND itemId = ?").run(quantity, user.residenceId || 'IT', offer.itemId);
        else db.prepare("INSERT INTO state_inventory (regionId, itemId, quantity) VALUES (?, ?, ?)").run(user.residenceId || 'IT', offer.itemId, quantity);
      } else {
        if (user.money < totalPrice) throw new Error("Non hai abbastanza contanti.");
        if (user.inventoryVolume + quantity > user.maxInventoryVolume) throw new Error("Non hai abbastanza spazio nel tuo Magazzino Privato.");

        db.prepare("UPDATE users SET money = money - ? WHERE id = ?").run(totalPrice, user.id);

        const userInv = db.prepare("SELECT quantity FROM user_inventory WHERE userId = ? AND itemId = ?").get(user.id, offer.itemId) as any;
        if (userInv) db.prepare("UPDATE user_inventory SET quantity = quantity + ? WHERE userId = ? AND itemId = ?").run(quantity, user.id, offer.itemId);
        else db.prepare("INSERT INTO user_inventory (userId, itemId, quantity) VALUES (?, ?, ?)").run(user.id, offer.itemId, quantity);
      }

      // Update Offer
      if (offer.quantity === quantity) db.prepare("DELETE FROM market_offers WHERE id = ?").run(offer.id);
      else db.prepare("UPDATE market_offers SET quantity = quantity - ? WHERE id = ?").run(quantity, offer.id);

      // Distribute taxes to destination region treasury and net to seller
      const taxRate = offer.taxRate !== null && offer.taxRate !== undefined ? offer.taxRate : 10;
      const taxAmount = Math.floor(totalPrice * (taxRate / 100));
      const netToSeller = totalPrice - taxAmount;

      db.prepare("UPDATE users SET money = money + ? WHERE id = ?").run(netToSeller, offer.sellerId);
      db.prepare("UPDATE regions SET treasury = treasury + ? WHERE id = ?").run(taxAmount, offer.regionId);

      // Log transaction
      const txnId = Math.random().toString(36).substring(2, 11);
      db.prepare("INSERT INTO market_transactions_log (id, buyerId, isStateBuy, sellerId, itemId, quantity, price, taxPaid, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
        .run(txnId, user.id, isStateBuy ? 1 : 0, offer.sellerId, offer.itemId, quantity, offer.price, taxAmount, Date.now());

      return { totalPrice, netToSeller, taxAmount };
    })();

    res.json({ success: true, ...result });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// ==============================================================
// WEAPON PRODUCTION API (SQLite)
// ==============================================================
const WEAPONS_DEF: Record<string, { timeMin: number, costCash: number, power: number, reqOil?: number, reqMinerals?: number, reqUranium?: number, reqDiamonds?: number }> = {
  rifle: { timeMin: 1, costCash: 100, power: 2, reqMinerals: 2 },
  drone: { timeMin: 8, costCash: 800, power: 20, reqMinerals: 10, reqOil: 5 },
  artillery: { timeMin: 5, costCash: 500, power: 12, reqMinerals: 15, reqOil: 2 },
  tank: { timeMin: 15, costCash: 1500, power: 40, reqMinerals: 30, reqOil: 15, reqUranium: 1 },
  missile: { timeMin: 30, costCash: 5000, power: 150, reqMinerals: 50, reqOil: 40, reqUranium: 10, reqDiamonds: 2 },
};

app.post("/api/produce", authenticate, (req: any, res) => {
  const user = req.user;
  const { weaponType, qty } = req.body;

  const weapon = WEAPONS_DEF[weaponType];
  if (!weapon) return res.status(400).json({ error: "Tipo di arma non valido" });

  const amount = Math.max(1, parseInt(qty) || 1);
  const totalCost = weapon.costCash * amount;

  if (user.money < totalCost) {
    return res.status(400).json({ error: `Fondi insufficienti. Costo totale: $${totalCost.toLocaleString()}` });
  }

  // Check required resources
  const reqOil = (weapon.reqOil || 0) * amount;
  const reqMinerals = (weapon.reqMinerals || 0) * amount;
  const reqUranium = (weapon.reqUranium || 0) * amount;
  const reqDiamonds = (weapon.reqDiamonds || 0) * amount;

  const hasOil = (user.inventory['oil'] || 0) >= reqOil;
  const hasMinerals = (user.inventory['minerals'] || 0) >= reqMinerals;
  const hasUranium = (user.inventory['uranium'] || 0) >= reqUranium;
  const hasDiamonds = (user.inventory['diamonds'] || 0) >= reqDiamonds;

  if (!hasOil || !hasMinerals || !hasUranium || !hasDiamonds) {
    return res.status(400).json({ error: "Non hai abbastanza risorse nel Magazzino Privato per produrre queste armi." });
  }

  // Calculate required vs freed space
  // We consume resources (freeing space) and output weapons (consuming space)
  const spaceFreed = reqOil + reqMinerals + reqUranium + reqDiamonds;
  const spaceConsumed = amount; // Each weapon takes 1 volume

  if (user.inventoryVolume - spaceFreed + spaceConsumed > user.maxInventoryVolume) {
    return res.status(400).json({ error: `Spazio nel Magazzino Privato insufficiente.` });
  }

  try {
    db.transaction(() => {
      const now = Date.now();
      let startOffset = 0;

      const lastQueue = db.prepare("SELECT willCompleteAt FROM production_queue WHERE userId = ? AND status IN ('queued', 'producing') ORDER BY willCompleteAt DESC LIMIT 1").get(user.id) as any;
      if (lastQueue) {
        const lastComplete = lastQueue.willCompleteAt || now;
        if (lastComplete > now) startOffset = lastComplete - now;
      }

      const startedAt = now + startOffset;
      const willCompleteAt = startedAt + weapon.timeMin * 60 * 1000 * amount;
      const prodId = Math.random().toString(36).substring(2, 11);

      db.prepare("INSERT INTO production_queue (id, userId, weaponType, qty, status, startedAt, willCompleteAt, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
        .run(prodId, user.id, weaponType, amount, 'queued', startedAt, willCompleteAt, Date.now());

      db.prepare("UPDATE users SET money = money - ? WHERE id = ?").run(totalCost, user.id);

      // Deduct resources
      if (reqOil > 0) db.prepare("UPDATE user_inventory SET quantity = quantity - ? WHERE userId = ? AND itemId = 'oil'").run(reqOil, user.id);
      if (reqMinerals > 0) db.prepare("UPDATE user_inventory SET quantity = quantity - ? WHERE userId = ? AND itemId = 'minerals'").run(reqMinerals, user.id);
      if (reqUranium > 0) db.prepare("UPDATE user_inventory SET quantity = quantity - ? WHERE userId = ? AND itemId = 'uranium'").run(reqUranium, user.id);
      if (reqDiamonds > 0) db.prepare("UPDATE user_inventory SET quantity = quantity - ? WHERE userId = ? AND itemId = 'diamonds'").run(reqDiamonds, user.id);

      // Cleanup 0 quantity items
      db.prepare("DELETE FROM user_inventory WHERE userId = ? AND quantity <= 0").run(user.id);
    })();

    res.json({ success: true, totalCost });
  } catch (err) {
    console.error("Produce error:", err);
    res.status(500).json({ error: "Errore nella produzione" });
  }
});

app.get("/api/produce/list", authenticate, (req: any, res) => {
  try {
    const queue = db.prepare("SELECT * FROM production_queue WHERE userId = ? ORDER BY createdAt DESC LIMIT 20").all(req.user.id) as any[];
    const items = queue.map(d => {
      const isReady = d.willCompleteAt <= Date.now() && d.status !== "claimed";
      return {
        ...d,
        status: isReady && d.status !== "claimed" ? "ready" : d.status,
      };
    });
    res.json(items);
  } catch (err) {
    console.error("Produce list error:", err);
    res.status(500).json({ error: "Errore nel caricamento" });
  }
});

app.post("/api/produce/claim", authenticate, (req: any, res) => {
  const { id } = req.body;
  if (!id) return res.status(400).json({ error: "Item ID required" });

  try {
    db.transaction(() => {
      const d = db.prepare("SELECT * FROM production_queue WHERE id = ? AND userId = ?").get(id, req.user.id) as any;
      if (!d) throw new Error("Item not found");
      if (d.status === "claimed") throw new Error("Già ritirato");
      if (d.willCompleteAt > Date.now()) throw new Error("Produzione non ancora completata");

      db.prepare("UPDATE production_queue SET status = 'claimed' WHERE id = ?").run(id);

      const qty = d.qty || 1;
      const userInv = db.prepare("SELECT quantity FROM user_inventory WHERE userId = ? AND itemId = ?").get(req.user.id, d.weaponType) as any;
      if (userInv) {
        db.prepare("UPDATE user_inventory SET quantity = quantity + ? WHERE userId = ? AND itemId = ?").run(qty, req.user.id, d.weaponType);
      } else {
        db.prepare("INSERT INTO user_inventory (userId, itemId, quantity) VALUES (?, ?, ?)").run(req.user.id, d.weaponType, qty);
      }
    })();

    res.json({ success: true });
  } catch (err: any) {
    console.error("Claim error:", err);
    res.status(400).json({ error: err.message || "Errore nel ritiro" });
  }
});

// --- Nation Management API ---
app.get("/api/nations/:id", authenticate, (req: any, res) => {
  try {
    const nation = db.prepare(`
      SELECT n.*, u.username as leaderName 
      FROM nations n 
      JOIN users u ON n.leaderUserId = u.id 
      WHERE n.id = ?
    `).get(req.params.id) as any;

    if (!nation) return res.status(404).json({ error: "Nazione non trovata." });

    const regions = db.prepare("SELECT id, name, population, economyLevel FROM regions WHERE nationId = ?").all(nation.id);

    res.json({ ...nation, regions });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/leader/nation/branding", authenticate, (req: any, res) => {
  const { name, logo, nationId } = req.body;
  if (!name) return res.status(400).json({ error: "Nome nazione obbligatorio." });

  const nation = db.prepare("SELECT * FROM nations WHERE id = ?").get(nationId) as any;
  if (!nation) return res.status(404).json({ error: "Nazione non trovata." });
  if (nation.leaderUserId !== req.user.id) return res.status(403).json({ error: "Azione riservata al Leader della Nazione." });

  try {
    db.prepare("UPDATE nations SET name = ?, logo = ?, updatedAt = ? WHERE id = ?")
      .run(name, logo || '🏛️', Date.now(), nationId);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// POLITICAL PARTIES API (Phase 7)
// ==========================================

app.post("/api/parties/create", authenticate, (req: any, res) => {
  const user = req.user;
  const { name, ideology, tag, description, logo } = req.body;
  const regionId = user.residenceId || "IT";

  if (!name || name.trim().length === 0) return res.status(400).json({ error: "Nome obbligatorio." });
  if (user.gold < 100) return res.status(400).json({ error: "Fondi in Gold insufficienti (costa 100 Gold)." });

  const existingMember = db.prepare("SELECT partyId FROM party_members WHERE userId = ?").get(user.id) as any;
  if (existingMember) return res.status(400).json({ error: "Sei già membro di un partito." });

  const partyId = Math.random().toString(36).substring(2, 11);
  const now = Date.now();

  try {
    db.transaction(() => {
      // Create party
      db.prepare("INSERT INTO parties (id, name, ideology, tag, description, logo, regionId, leaderUserId, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
        .run(partyId, name.trim(), ideology || "", tag || "", description || "", logo || "", regionId, user.id, now);

      // Add founder as leader
      db.prepare("INSERT INTO party_members (userId, partyId, role, joinedAt) VALUES (?, ?, 'leader', ?)")
        .run(user.id, partyId, now);

      // Deduct gold
      db.prepare("UPDATE users SET gold = gold - 100 WHERE id = ?").run(user.id);

      // Log creation
      const logId = Math.random().toString(36).substring(2, 11);
      db.prepare("INSERT INTO party_logs (id, partyId, action, details, timestamp) VALUES (?, ?, 'created', ?, ?)")
        .run(logId, partyId, `Partito creato da ${user.username} in ${regionId}`, now);
    })();
    res.json({ success: true, partyId });
  } catch (err: any) {
    res.status(500).json({ error: "Errore nella creazione del partito: " + err.message });
  }
});

app.put("/api/parties/edit", authenticate, (req: any, res) => {
  const user = req.user;
  const { partyId, name, ideology, tag, description, logo } = req.body;

  const party = db.prepare("SELECT leaderUserId FROM parties WHERE id = ?").get(partyId) as any;
  if (!party) return res.status(404).json({ error: "Partito inesistente." });
  if (party.leaderUserId !== user.id) return res.status(403).json({ error: "Solo il leader può modificare le info del partito." });

  if (!name || name.trim().length === 0) return res.status(400).json({ error: "Nome obbligatorio." });

  db.prepare("UPDATE parties SET name = ?, ideology = ?, tag = ?, description = ?, logo = ? WHERE id = ?")
    .run(name.trim(), ideology || "", tag || "", description || "", logo || "", partyId);

  res.json({ success: true });
});

app.get("/api/parties", authenticate, (req: any, res) => {
  // Returns all parties with member counts
  const parties = db.prepare(`
    SELECT p.*, 
           u.username as leaderName,
           (SELECT COUNT(*) FROM party_members WHERE partyId = p.id) as memberCount
    FROM parties p
    LEFT JOIN users u ON p.leaderUserId = u.id
    ORDER BY memberCount DESC, p.createdAt DESC
  `).all();
  res.json(parties);
});

app.get("/api/parties/my", authenticate, (req: any, res) => {
  const membership = db.prepare("SELECT partyId FROM party_members WHERE userId = ?").get(req.user.id) as any;
  if (!membership) return res.status(404).json({ error: "Non sei in nessun partito." });
  res.redirect(`/api/parties/${membership.partyId}`);
});

app.get("/api/parties/:id", authenticate, (req: any, res) => {
  const { id } = req.params;
  const party = db.prepare("SELECT p.*, u.username as leaderName FROM parties p LEFT JOIN users u ON p.leaderUserId = u.id WHERE p.id = ?").get(id) as any;
  if (!party) return res.status(404).json({ error: "Partito non trovato" });

  const members = db.prepare("SELECT pm.*, u.username, u.level, u.lastLogin FROM party_members pm JOIN users u ON pm.userId = u.id WHERE pm.partyId = ? ORDER BY pm.role ASC, pm.joinedAt ASC").all(id);

  // Calculate active members (login <= 24h, joinedAt >= 72h, level >= 60)
  const now = Date.now();
  const activeMembersCount = members.filter((m: any) =>
    m.level >= 60 &&
    now - (m.lastLogin || 0) <= 24 * 60 * 60 * 1000 &&
    now - m.joinedAt >= 72 * 60 * 60 * 1000
  ).length;

  res.json({ party, members, activeMembersCount });
});

app.post("/api/parties/roles", authenticate, (req: any, res) => {
  const user = req.user;
  const { partyId, targetUserId, newRole } = req.body;

  if (!['secretary', 'member'].includes(newRole)) return res.status(400).json({ error: "Ruolo non valido." });

  const party = db.prepare("SELECT leaderUserId FROM parties WHERE id = ?").get(partyId) as any;
  if (!party || party.leaderUserId !== user.id) return res.status(403).json({ error: "Solo il leader può assegnare i ruoli." });

  if (targetUserId === user.id) return res.status(400).json({ error: "Non puoi modificare il tuo stesso ruolo in questo modo." });

  const targetMember = db.prepare("SELECT role FROM party_members WHERE userId = ? AND partyId = ?").get(targetUserId, partyId) as any;
  if (!targetMember) return res.status(404).json({ error: "Il giocatore non è in questo partito." });

  db.prepare("UPDATE party_members SET role = ? WHERE userId = ?").run(newRole, targetUserId);
  res.json({ success: true, newRole });
});

app.post("/api/parties/kick", authenticate, (req: any, res) => {
  const user = req.user;
  const { partyId, targetUserId } = req.body;

  const myMembership = db.prepare("SELECT role FROM party_members WHERE userId = ? AND partyId = ?").get(user.id, partyId) as any;
  if (!myMembership || (myMembership.role !== 'leader' && myMembership.role !== 'secretary')) {
    return res.status(403).json({ error: "Non hai i permessi per espellere." });
  }

  const targetMember = db.prepare("SELECT role FROM party_members WHERE userId = ? AND partyId = ?").get(targetUserId, partyId) as any;
  if (!targetMember) return res.status(404).json({ error: "Il giocatore non è in questo partito." });

  if (targetMember.role === 'leader') return res.status(403).json({ error: "Non puoi espellere il leader." });
  if (myMembership.role === 'secretary' && targetMember.role === 'secretary') return res.status(403).json({ error: "Un segretario non può espellere un altro segretario." });

  db.prepare("DELETE FROM party_members WHERE userId = ?").run(targetUserId);

  // Log action
  const logId = Math.random().toString(36).substring(2, 11);
  db.prepare("INSERT INTO party_logs (id, partyId, action, details, timestamp) VALUES (?, ?, 'kick', ?, ?)")
  db.prepare("INSERT INTO party_logs (id, partyId, action, details, timestamp) VALUES (?, ?, 'kick', ?, ?)")
    .run(logId, partyId, `Utente rimosso dal partito. Esecutore: ${user.username}`, Date.now());

  res.json({ success: true });
});

const getItemType = (itemId: string): string => {
  const resources = ['oil', 'minerals', 'uranium', 'diamonds'];
  const weapons = ['infantry', 'tank', 'airstrike'];
  if (resources.includes(itemId)) return 'resources';
  if (weapons.includes(itemId)) return 'weapons';
  return 'items';
};

const calculatePartyCaps = (partyId: string) => {
  const members = db.prepare("SELECT pm.userId, u.level, u.lastLogin, pm.joinedAt FROM party_members pm JOIN users u ON pm.userId = u.id WHERE pm.partyId = ?").all(partyId) as any[];
  const now = Date.now();

  const activeMembers = members.filter(m =>
    m.level >= 60 &&
    now - (m.lastLogin || 0) <= 24 * 60 * 60 * 1000 &&
    now - m.joinedAt >= 72 * 60 * 60 * 1000
  );

  const activeCount = activeMembers.length;
  // Dynamic CAPS based on active members
  const maxGoldPerUser = Math.min(200, 50 + (activeCount * 5));
  const maxGoldTotal = Math.min(5000, activeCount * 100);

  return { activeCount, activeMembers, maxGoldPerUser, maxGoldTotal };
};

app.post("/api/parties/set-wage", authenticate, (req: any, res) => {
  const user = req.user;
  const { partyId, targetUserId, salaryCash, salaryGold } = req.body;

  const party = db.prepare("SELECT leaderUserId FROM parties WHERE id = ?").get(partyId) as any;
  if (!party || party.leaderUserId !== user.id) return res.status(403).json({ error: "Solo il leader può impostare i salari." });

  const targetMember = db.prepare("SELECT role FROM party_members WHERE userId = ? AND partyId = ?").get(targetUserId, partyId) as any;
  if (!targetMember) return res.status(404).json({ error: "Il giocatore non è in questo partito." });

  const cash = Math.max(0, parseInt(salaryCash) || 0);
  const gold = Math.max(0, parseInt(salaryGold) || 0);

  const caps = calculatePartyCaps(partyId);
  if (gold > caps.maxGoldPerUser) {
    return res.status(400).json({ error: `Il limite di Gold per utente è ${caps.maxGoldPerUser} (basato su ${caps.activeCount} membri attivi).` });
  }

  db.prepare("UPDATE party_members SET salaryCash = ?, salaryGold = ? WHERE userId = ? AND partyId = ?")
    .run(cash, gold, targetUserId, partyId);

  res.json({ success: true, salaryCash: cash, salaryGold: gold });
});

app.post("/api/parties/pay-wages", authenticate, (req: any, res) => {
  const user = req.user;
  const { partyId } = req.body;

  const party = db.prepare("SELECT leaderUserId FROM parties WHERE id = ?").get(partyId) as any;
  if (!party || party.leaderUserId !== user.id) return res.status(403).json({ error: "Solo il leader può pagare i salari." });

  // Prevent double payment within 24h
  const lastPayment = db.prepare("SELECT timestamp FROM party_logs WHERE partyId = ? AND action = 'pay_wages' ORDER BY timestamp DESC LIMIT 1").get(partyId) as any;
  if (lastPayment && Date.now() - lastPayment.timestamp < 24 * 60 * 60 * 1000) {
    const hoursLeft = Math.ceil((24 * 60 * 60 * 1000 - (Date.now() - lastPayment.timestamp)) / (60 * 60 * 1000));
    return res.status(400).json({ error: `I salari sono già stati pagati. Riprova tra ${hoursLeft} ore.` });
  }

  const caps = calculatePartyCaps(partyId);

  // Get all members who have a salary > 0 and are ACTIVE
  const activeIds = new Set(caps.activeMembers.map((m: any) => m.userId));

  const toPay = db.prepare("SELECT userId, salaryCash, salaryGold FROM party_members WHERE partyId = ? AND (salaryCash > 0 OR salaryGold > 0)").all(partyId) as any[];
  const validToPay = toPay.filter(m => activeIds.has(m.userId)); // ONLY pay active members

  let totalCash = 0;
  let totalGold = 0;

  validToPay.forEach(m => {
    totalCash += m.salaryCash;
    totalGold += m.salaryGold;
  });

  if (totalGold > caps.maxGoldTotal) {
    return res.status(400).json({ error: `Il totale di Gold (${totalGold}) supera il limite massimo distribuibile di ${caps.maxGoldTotal}. Ridurre gli stipendi.` });
  }

  if (user.money < totalCash || user.gold < totalGold) {
    return res.status(400).json({ error: `Fondi insufficienti sul tuo conto personale. Ti servono $${totalCash} e ${totalGold} Gold.` });
  }

  if (validToPay.length === 0) {
    return res.status(400).json({ error: "Nessun membro attivo riceve stipendi o le condizioni di attività non sono soddisfatte." });
  }

  try {
    db.transaction(() => {
      // Deduct from Leader
      db.prepare("UPDATE users SET money = money - ?, gold = gold - ? WHERE id = ?").run(totalCash, totalGold, user.id);

      // Pay members
      for (const m of validToPay) {
        db.prepare("UPDATE users SET money = money + ?, gold = gold + ? WHERE id = ?").run(m.salaryCash, m.salaryGold, m.userId);
      }

      // Log
      db.prepare("INSERT INTO party_logs (id, partyId, action, details, timestamp) VALUES (?, ?, 'pay_wages', ?, ?)")
        .run(Math.random().toString(36).substring(2, 11), partyId, `Pagati totali $${totalCash} e ${totalGold} Gold a ${validToPay.length} membri.`, Date.now());
    })();
    res.json({ success: true, paidMembers: validToPay.length, totalCash, totalGold });
  } catch (err) {
    res.status(500).json({ error: "Errore durante il pagamento dei salari." });
  }
});

app.post("/api/parties/contribute", authenticate, (req: any, res) => {
  const user = req.user;
  const { targetUserId, itemType, amount } = req.body;
  const numAmount = parseInt(amount) || 0;

  if (numAmount <= 0) return res.status(400).json({ error: "Quantità non valida." });
  if (user.id === targetUserId) return res.status(400).json({ error: "Non puoi inviare a te stesso." });

  const myMembership = db.prepare("SELECT partyId, joinedAt FROM party_members WHERE userId = ?").get(user.id) as any;
  if (!myMembership) return res.status(403).json({ error: "Non fai parte di alcun partito." });

  if (Date.now() - myMembership.joinedAt < 7 * 24 * 60 * 60 * 1000) {
    return res.status(403).json({ error: "Devi essere nel partito da almeno 7 giorni per inviare contributi." });
  }

  const targetMembership = db.prepare("SELECT partyId FROM party_members WHERE userId = ? AND partyId = ?").get(targetUserId, myMembership.partyId) as any;
  if (!targetMembership) return res.status(404).json({ error: "Il destinatario non fa parte del tuo partito." });

  try {
    db.transaction(() => {
      if (itemType === 'cash') {
        if (user.money < numAmount) throw new Error("Cash insufficiente.");
        db.prepare("UPDATE users SET money = money - ? WHERE id = ?").run(numAmount, user.id);
        db.prepare("UPDATE users SET money = money + ? WHERE id = ?").run(numAmount, targetUserId);
      } else if (itemType === 'gold') {
        if (user.gold < numAmount) throw new Error("Gold insufficiente.");
        db.prepare("UPDATE users SET gold = gold - ? WHERE id = ?").run(numAmount, user.id);
        db.prepare("UPDATE users SET gold = gold + ? WHERE id = ?").run(numAmount, targetUserId);
      } else {
        // Must be an item in inventory
        const userInv = db.prepare("SELECT quantity FROM user_inventory WHERE userId = ? AND itemId = ?").get(user.id, itemType) as any;
        if (!userInv || userInv.quantity < numAmount) throw new Error("Oggetto insufficiente in magazzino.");

        // Dest Storage Check (Simplified: normally requires parsing max volume, but we'll let it slide or just enforce generic limit)
        // For accurate tracking, we assume party contributions ignore minor storage caps or we could load target's full volume. Let's just transfer.

        db.prepare("UPDATE user_inventory SET quantity = quantity - ? WHERE userId = ? AND itemId = ?").run(numAmount, user.id, itemType);

        const targetInv = db.prepare("SELECT quantity FROM user_inventory WHERE userId = ? AND itemId = ?").get(targetUserId, itemType) as any;
        if (targetInv) {
          db.prepare("UPDATE user_inventory SET quantity = quantity + ? WHERE userId = ? AND itemId = ?").run(numAmount, targetUserId, itemType);
        } else {
          db.prepare("INSERT INTO user_inventory (userId, itemId, quantity) VALUES (?, ?, ?)").run(targetUserId, itemType, numAmount);
        }
      }

      // Cleanup 0 quantity items
      db.prepare("DELETE FROM user_inventory WHERE userId = ? AND quantity <= 0").run(user.id);

      db.prepare("INSERT INTO party_logs (id, partyId, action, details, timestamp) VALUES (?, ?, 'contribution', ?, ?)")
        .run(Math.random().toString(36).substring(2, 11), myMembership.partyId, `${user.username} ha inviato ${numAmount} ${itemType} a ID:${targetUserId}`, Date.now());

    })();
    res.json({ success: true });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.post("/api/parties/invite", authenticate, (req: any, res) => {
  const user = req.user;
  const { targetUserId } = req.body;

  const myMembership = db.prepare("SELECT partyId, role FROM party_members WHERE userId = ?").get(user.id) as any;
  if (!myMembership || (myMembership.role !== 'leader' && myMembership.role !== 'secretary')) {
    return res.status(403).json({ error: "Solo Leader e Segretari possono invitare." });
  }

  const targetMembership = db.prepare("SELECT partyId FROM party_members WHERE userId = ?").get(targetUserId) as any;
  if (targetMembership) return res.status(400).json({ error: "L'utente fa già parte di un partito." });

  const existingInvite = db.prepare("SELECT id FROM party_invites WHERE partyId = ? AND userId = ? AND status = 'pending'").get(myMembership.partyId, targetUserId) as any;
  if (existingInvite) return res.status(400).json({ error: "L'utente ha già un invito pendente per questo partito." });

  db.prepare("INSERT INTO party_invites (id, partyId, userId, invitedBy, status, createdAt) VALUES (?, ?, ?, ?, 'pending', ?)")
    .run(Math.random().toString(36).substring(2, 11), myMembership.partyId, targetUserId, user.id, Date.now());

  res.json({ success: true });
});

app.get("/api/parties/my-invites", authenticate, (req: any, res) => {
  const invites = db.prepare(`
    SELECT pi.*, p.name as partyName, u.username as inviterName 
    FROM party_invites pi 
    JOIN parties p ON pi.partyId = p.id 
    JOIN users u ON pi.invitedBy = u.id 
    WHERE pi.userId = ? AND pi.status = 'pending'
  `).all(req.user.id);
  res.json(invites);
});

app.post("/api/parties/join", authenticate, (req: any, res) => {
  const user = req.user;
  const { inviteId } = req.body;

  const invite = db.prepare("SELECT partyId, status FROM party_invites WHERE id = ? AND userId = ?").get(inviteId, user.id) as any;
  if (!invite) return res.status(404).json({ error: "Invito non trovato." });
  if (invite.status !== 'pending') return res.status(400).json({ error: "L'invito non è più valido." });

  const existingMember = db.prepare("SELECT partyId FROM party_members WHERE userId = ?").get(user.id) as any;
  if (existingMember) return res.status(400).json({ error: "Fai già parte di un partito." });

  try {
    db.transaction(() => {
      db.prepare("UPDATE party_invites SET status = 'accepted' WHERE id = ?").run(inviteId);
      db.prepare("INSERT INTO party_members (userId, partyId, role, joinedAt) VALUES (?, ?, 'member', ?)")
        .run(user.id, invite.partyId, Date.now());
      // Auto reject other pending invites
      db.prepare("UPDATE party_invites SET status = 'rejected' WHERE userId = ? AND status = 'pending'").run(user.id);
    })();
    res.json({ success: true, partyId: invite.partyId });
  } catch (err) {
    res.status(500).json({ error: "Errore durante l'adesione." });
  }
});

app.post("/api/parties/primaries-vote", authenticate, (req: any, res) => {
  const user = req.user;
  const { candidateId } = req.body;

  const myMembership = db.prepare("SELECT partyId FROM party_members WHERE userId = ?").get(user.id) as any;
  if (!myMembership) return res.status(403).json({ error: "Non fai parte di alcun partito." });

  const targetMembership = db.prepare("SELECT partyId FROM party_members WHERE userId = ?").get(candidateId) as any;
  if (!targetMembership || targetMembership.partyId !== myMembership.partyId) return res.status(400).json({ error: "Il candidato non è nel tuo partito." });

  // 5 days cycle check
  const cyclePeriodMs = 5 * 24 * 60 * 60 * 1000;
  const currentCycleStart = Math.floor(Date.now() / cyclePeriodMs) * cyclePeriodMs;

  const existingVote = db.prepare("SELECT id FROM party_primaries WHERE voterId = ? AND createdAt >= ?").get(user.id, currentCycleStart) as any;
  if (existingVote) return res.status(400).json({ error: "Hai già votato in questo ciclo elettorale (5 giorni)." });

  db.prepare("INSERT INTO party_primaries (id, partyId, candidateId, voterId, createdAt) VALUES (?, ?, ?, ?, ?)")
    .run(Math.random().toString(36).substring(2, 11), myMembership.partyId, candidateId, user.id, Date.now());

  res.json({ success: true });
});
// ==========================================
// PARLIAMENT & ELECTIONS API
// ==========================================

app.get("/api/elections", authenticate, (req: any, res) => {
  const user = req.user;
  // Get active election for user's nationality (residenceId)
  const election = db.prepare("SELECT * FROM elections WHERE regionId = ? AND status = 'active' ORDER BY createdAt DESC LIMIT 1").get(user.residenceId) as any;
  if (!election) {
    return res.json({ election: null, parties: [], myVote: null });
  }

  // Get parties in that region
  const parties = db.prepare("SELECT id, name, tag, logo, ideology FROM parties WHERE regionId = ?").all(user.residenceId);

  // Get vote counts
  const votes = db.prepare("SELECT partyId, COUNT(*) as count FROM election_votes WHERE electionId = ? GROUP BY partyId").all(election.id) as any[];
  const partiesWithVotes = parties.map((p: any) => ({
    ...p,
    votes: votes.find((v: any) => v.partyId === p.id)?.count || 0
  }));

  const myVote = db.prepare("SELECT partyId FROM election_votes WHERE electionId = ? AND voterId = ?").get(election.id, user.id) as any;

  res.json({ election, parties: partiesWithVotes, myVote: myVote?.partyId });
});

app.post("/api/elections/vote", authenticate, (req: any, res) => {
  const user = req.user;
  const { electionId, partyId } = req.body;

  const election = db.prepare("SELECT regionId, status FROM elections WHERE id = ?").get(electionId) as any;
  if (!election || election.status !== 'active') return res.status(400).json({ error: "Elezione non attiva o inesistente." });
  if (election.regionId !== user.residenceId) return res.status(403).json({ error: "Puoi votare solo nella tua nazione di residenza." });

  const party = db.prepare("SELECT id FROM parties WHERE id = ? AND regionId = ?").get(partyId, user.residenceId);
  if (!party) return res.status(400).json({ error: "Partito non valido." });

  const existingVote = db.prepare("SELECT id FROM election_votes WHERE electionId = ? AND voterId = ?").get(electionId, user.id);
  if (existingVote) return res.status(400).json({ error: "Hai già votato in questa elezione." });

  db.prepare("INSERT INTO election_votes (id, electionId, voterId, partyId, timestamp) VALUES (?, ?, ?, ?, ?)")
    .run(Math.random().toString(36).substring(2, 11), electionId, user.id, partyId, Date.now());

  res.json({ success: true });
});

app.get("/api/parliament", authenticate, (req: any, res) => {
  const user = req.user;
  const members = db.prepare(`
    SELECT pm.userId, u.username, u.level, p.name as partyName, p.tag as partyTag, pm.electedAt
    FROM parliament_members pm
    JOIN users u ON pm.userId = u.id
    JOIN parties p ON pm.partyId = p.id
    WHERE pm.regionId = ?
    ORDER BY p.name ASC, u.level DESC
  `).all(user.residenceId);

  res.json(members);
});


// ==========================================
// STATE LAWS REGISTRY
// ==========================================

// ==========================================
// BLOCS API
// ==========================================

app.get("/api/blocs", authenticate, (req: any, res) => {
  try {
    // Return blocs that have >= 2 active members
    const blocs = db.prepare(`
      SELECT b.*, u.username as ownerName, 
             (SELECT COUNT(*) FROM bloc_memberships m WHERE m.blocId = b.id AND m.status = 'active') as memberCount,
             (SELECT COUNT(*) FROM bloc_memberships m2 
              JOIN regions r2 ON m2.stateId = r2.id 
              WHERE m2.blocId = b.id AND r2.ownerUserId = ? AND m2.status = 'active') as isMyBloc
      FROM blocs b
      LEFT JOIN regions r ON b.ownerStateId = r.id
      LEFT JOIN users u ON r.ownerUserId = u.id
      WHERE memberCount >= 2 OR isMyBloc > 0
      ORDER BY memberCount DESC, b.createdAt DESC
    `).all(req.user.id);
    res.json(blocs);
  } catch (err: any) {
    res.status(500).json({ error: "Errore nel caricamento dei blocchi." });
  }
});

app.get("/api/blocs-map", (req, res) => {
  try {
    const memberships = db.prepare(`
      SELECT m.stateId, m.blocId, b.name as blocName 
      FROM bloc_memberships m 
      JOIN blocs b ON m.blocId = b.id 
      WHERE m.status = 'active'
    `).all();
    res.json(memberships);
  } catch (err: any) {
    res.status(500).json({ error: "Errore mappa blocchi." });
  }
});

app.get("/api/blocs/:id", authenticate, (req: any, res) => {
  try {
    const user = req.user;
    const blocId = req.params.id;
    const bloc = db.prepare(`
      SELECT b.*, u.username as ownerName, r.name as ownerStateName
      FROM blocs b
      LEFT JOIN regions r ON b.ownerStateId = r.id
      LEFT JOIN users u ON r.ownerUserId = u.id
      WHERE b.id = ?
    `).get(blocId) as any;

    if (!bloc) return res.status(404).json({ error: "Blocco non trovato." });

    const members = db.prepare(`
      SELECT m.*, r.name as stateName, u.username as leaderName, r.ownerUserId
      FROM bloc_memberships m
      JOIN regions r ON m.stateId = r.id
      LEFT JOIN users u ON r.ownerUserId = u.id
      WHERE m.blocId = ? AND m.status = 'active'
    `).all(blocId) as any[];

    const regulations = db.prepare("SELECT * FROM bloc_regulations WHERE blocId = ?").get(blocId) || { openBorders: 0, defaultMilitaryAgreement: 0 };

    // Check se user is a leader of any member state
    const isMemberLeader = members.some(m => m.ownerUserId === user.id);

    let applications = [];
    let proposals = [];

    if (isMemberLeader) {
      applications = db.prepare(`
        SELECT a.*, r.name as stateName, u.username as leaderName
        FROM bloc_applications a
        JOIN regions r ON a.stateId = r.id
        LEFT JOIN users u ON r.ownerUserId = u.id
        WHERE a.blocId = ? AND a.status = 'pending'
      `).all(blocId);

      for (const app of applications as any[]) {
        app.votes = db.prepare("SELECT * FROM bloc_votes WHERE targetId = ?").all(app.id);
      }

      proposals = db.prepare("SELECT * FROM bloc_regulation_proposals WHERE blocId = ? AND status = 'pending'").all(blocId);
      for (const prop of proposals as any[]) {
        prop.votes = db.prepare("SELECT * FROM bloc_votes WHERE targetId = ?").all(prop.id);
      }
    }

    res.json({ bloc, members, regulations, applications, proposals, isMemberLeader });
  } catch (err: any) {
    res.status(500).json({ error: "Errore nel caricamento dei dettagli del blocco." });
  }
});

app.post("/api/blocs/:id/update", authenticate, (req: any, res) => {
  try {
    const user = req.user;
    const blocId = req.params.id;
    const { name, description, logo } = req.body;

    if (!name || name.trim().length === 0) return res.status(400).json({ error: "Nome obbligatorio." });

    const bloc = db.prepare("SELECT ownerStateId FROM blocs WHERE id = ?").get(blocId) as any;
    if (!bloc) return res.status(404).json({ error: "Blocco non trovato." });

    const region = db.prepare("SELECT ownerUserId FROM regions WHERE id = ?").get(bloc.ownerStateId) as any;
    if (!region || region.ownerUserId !== user.id) {
      return res.status(403).json({ error: "Solo il fondatore può modificare il blocco." });
    }

    db.prepare("UPDATE blocs SET name = ?, description = ?, logo = ? WHERE id = ?")
      .run(name.trim(), description || '', logo || '', blocId);

    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: "Errore durante l'aggiornamento del blocco." });
  }
});

app.post("/api/blocs/create", authenticate, (req: any, res) => {
  try {
    const user = req.user;
    const { name, description, logo, stateId } = req.body;

    if (!name || name.trim().length === 0) return res.status(400).json({ error: "Nome obbligatorio." });
    if (!stateId) return res.status(400).json({ error: "Devi selezionare uno Stato da te guidato." });

    const region = db.prepare("SELECT ownerUserId FROM regions WHERE id = ?").get(stateId) as any;
    if (!region || region.ownerUserId !== user.id) {
      return res.status(403).json({ error: "Solo il Leader dello Stato può creare un blocco a suo nome." });
    }

    const existingMembership = db.prepare("SELECT blocId FROM bloc_memberships WHERE stateId = ? AND status = 'active'").get(stateId);
    if (existingMembership) {
      return res.status(400).json({ error: "Questo Stato fa già parte di un blocco." });
    }

    const id = Math.random().toString(36).substring(2, 11);

    db.transaction(() => {
      db.prepare("INSERT INTO blocs (id, name, logo, description, ownerStateId, createdAt) VALUES (?, ?, ?, ?, ?, ?)")
        .run(id, name.trim(), logo || '', description || '', stateId, Date.now());

      db.prepare("INSERT INTO bloc_memberships (blocId, stateId, status, joinedAt) VALUES (?, ?, 'active', ?)")
        .run(id, stateId, Date.now());

      db.prepare("INSERT OR IGNORE INTO bloc_regulations (blocId, openBorders, defaultMilitaryAgreement) VALUES (?, 0, 0)")
        .run(id);
    })();

    res.json({ success: true, blocId: id });
  } catch (err: any) {
    if (err.message.includes("UNIQUE")) return res.status(409).json({ error: "Esiste già un blocco con questo nome." });
    res.status(500).json({ error: "Errore durante la creazione del blocco." });
  }
});

app.post("/api/blocs/:id/apply", authenticate, (req: any, res) => {
  try {
    const user = req.user;
    const blocId = req.params.id;
    const { stateId } = req.body;

    if (!stateId) return res.status(400).json({ error: "Stato non specificato." });

    const region = db.prepare("SELECT ownerUserId FROM regions WHERE id = ?").get(stateId) as any;
    if (!region || region.ownerUserId !== user.id) return res.status(403).json({ error: "Solo il Leader dello Stato può richiederne l'ingresso." });

    const existingMembership = db.prepare("SELECT blocId FROM bloc_memberships WHERE stateId = ? AND status = 'active'").get(stateId);
    if (existingMembership) return res.status(400).json({ error: "Questo Stato fa già parte di un blocco." });

    const existingApp = db.prepare("SELECT id FROM bloc_applications WHERE blocId = ? AND stateId = ? AND status = 'pending'").get(blocId, stateId);
    if (existingApp) return res.status(400).json({ error: "Hai già una candidatura in sospeso per questo blocco." });

    const id = Math.random().toString(36).substring(2, 11);
    db.prepare("INSERT INTO bloc_applications (id, blocId, stateId, createdAt, status) VALUES (?, ?, ?, ?, 'pending')")
      .run(id, blocId, stateId, Date.now());

    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: "Errore durante la candidatura." });
  }
});

app.post("/api/blocs/applications/:id/vote", authenticate, (req: any, res) => {
  try {
    const user = req.user;
    const appId = req.params.id;
    const { voterStateId, choice } = req.body;
    const voteChoice = choice ? 1 : 0;

    const application = db.prepare("SELECT * FROM bloc_applications WHERE id = ?").get(appId) as any;
    if (!application) return res.status(404).json({ error: "Candidatura non trovata." });
    if (application.status !== 'pending') return res.status(400).json({ error: "Questa candidatura non è più in sospeso." });

    const blocId = application.blocId;

    const membership = db.prepare("SELECT status FROM bloc_memberships WHERE blocId = ? AND stateId = ? AND status = 'active'").get(blocId, voterStateId);
    if (!membership) return res.status(403).json({ error: "Lo Stato votante non è un membro attivo di questo blocco." });

    const voterRegion = db.prepare("SELECT ownerUserId FROM regions WHERE id = ?").get(voterStateId) as any;
    if (!voterRegion || voterRegion.ownerUserId !== user.id) return res.status(403).json({ error: "Solo il Leader dello Stato può votare." });

    const existingVote = db.prepare("SELECT * FROM bloc_votes WHERE targetId = ? AND voterStateId = ?").get(appId, voterStateId);
    if (existingVote) return res.status(400).json({ error: "Questo Stato ha già votato per questa candidatura." });

    db.transaction(() => {
      db.prepare("INSERT INTO bloc_votes (targetId, voterStateId, choice, createdAt) VALUES (?, ?, ?, ?)")
        .run(appId, voterStateId, voteChoice, Date.now());

      const activeMembersCount = (db.prepare("SELECT COUNT(*) as c FROM bloc_memberships WHERE blocId = ? AND status = 'active'").get(blocId) as any).c;
      const votes = db.prepare("SELECT choice, COUNT(*) as c FROM bloc_votes WHERE targetId = ? GROUP BY choice").all(appId) as any[];

      const yesVotes = votes.find(v => v.choice === 1)?.c || 0;
      const noVotes = votes.find(v => v.choice === 0)?.c || 0;
      const totalVotes = yesVotes + noVotes;

      const requiredToPass = Math.floor(activeMembersCount / 2) + 1;
      const requiredToReject = activeMembersCount - requiredToPass + 1;

      if (yesVotes >= requiredToPass) {
        db.prepare("UPDATE bloc_applications SET status = 'approved' WHERE id = ?").run(appId);
        db.prepare("INSERT INTO bloc_memberships (blocId, stateId, status, joinedAt) VALUES (?, ?, 'active', ?)")
          .run(blocId, application.stateId, Date.now());
      } else if (noVotes >= requiredToReject || totalVotes === activeMembersCount) {
        db.prepare("UPDATE bloc_applications SET status = 'rejected' WHERE id = ?").run(appId);
      }
    })();

    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: "Errore durante il voto." });
  }
});

app.post("/api/blocs/:id/regulations/propose", authenticate, (req: any, res) => {
  try {
    const user = req.user;
    const blocId = req.params.id;
    const { proposerStateId, type, proposedValue } = req.body;
    const value = proposedValue ? 1 : 0;

    if (!['openBorders', 'migrationOpen', 'defaultMilitaryAgreement'].includes(type)) {
      return res.status(400).json({ error: "Tipo di regolamento non valido." });
    }

    const membership = db.prepare("SELECT status FROM bloc_memberships WHERE blocId = ? AND stateId = ? AND status = 'active'").get(blocId, proposerStateId);
    if (!membership) return res.status(403).json({ error: "Solo i membri attivi possono proporre regolamenti." });

    const region = db.prepare("SELECT ownerUserId FROM regions WHERE id = ?").get(proposerStateId) as any;
    if (!region || region.ownerUserId !== user.id) return res.status(403).json({ error: "Solo il Leader può proporre regolamenti." });

    const existingProp = db.prepare("SELECT id FROM bloc_regulation_proposals WHERE blocId = ? AND type = ? AND status = 'pending'").get(blocId, type);
    if (existingProp) return res.status(400).json({ error: "C'è già una proposta in sospeso per questo regolamento." });

    const id = Math.random().toString(36).substring(2, 11);
    db.transaction(() => {
      db.prepare("INSERT INTO bloc_regulation_proposals (id, blocId, type, proposedValue, createdAt, status) VALUES (?, ?, ?, ?, ?, 'pending')")
        .run(id, blocId, type, value, Date.now());
      db.prepare("INSERT INTO bloc_votes (targetId, voterStateId, choice, createdAt) VALUES (?, ?, 1, ?)")
        .run(id, proposerStateId, Date.now());
    })();

    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: "Errore durante la proposta." });
  }
});

app.post("/api/blocs/regulations/proposals/:id/vote", authenticate, (req: any, res) => {
  try {
    const user = req.user;
    const propId = req.params.id;
    const { voterStateId, choice } = req.body;
    const voteChoice = choice ? 1 : 0;

    const proposal = db.prepare("SELECT * FROM bloc_regulation_proposals WHERE id = ?").get(propId) as any;
    if (!proposal) return res.status(404).json({ error: "Proposta non trovata." });
    if (proposal.status !== 'pending') return res.status(400).json({ error: "Questa proposta non è in votazione." });

    const blocId = proposal.blocId;

    const membership = db.prepare("SELECT status FROM bloc_memberships WHERE blocId = ? AND stateId = ? AND status = 'active'").get(blocId, voterStateId);
    if (!membership) return res.status(403).json({ error: "Lo Stato votante non è membro di questo blocco." });

    const voterRegion = db.prepare("SELECT ownerUserId FROM regions WHERE id = ?").get(voterStateId) as any;
    if (!voterRegion || voterRegion.ownerUserId !== user.id) return res.status(403).json({ error: "Solo il Leader può votare." });

    const existingVote = db.prepare("SELECT * FROM bloc_votes WHERE targetId = ? AND voterStateId = ?").get(propId, voterStateId);
    if (existingVote) return res.status(400).json({ error: "Questo Stato ha già votato." });

    db.transaction(() => {
      db.prepare("INSERT INTO bloc_votes (targetId, voterStateId, choice, createdAt) VALUES (?, ?, ?, ?)")
        .run(propId, voterStateId, voteChoice, Date.now());

      const activeMembersCount = (db.prepare("SELECT COUNT(*) as c FROM bloc_memberships WHERE blocId = ? AND status = 'active'").get(blocId) as any).c;
      const votes = db.prepare("SELECT choice, COUNT(*) as c FROM bloc_votes WHERE targetId = ? GROUP BY choice").all(propId) as any[];

      const yesVotes = votes.find(v => v.choice === 1)?.c || 0;
      const noVotes = votes.find(v => v.choice === 0)?.c || 0;
      const totalVotes = yesVotes + noVotes;

      const requiredToPass = Math.floor(activeMembersCount / 2) + 1;
      const requiredToReject = activeMembersCount - requiredToPass + 1;

      if (yesVotes >= requiredToPass) {
        db.prepare("UPDATE bloc_regulation_proposals SET status = 'approved' WHERE id = ?").run(propId);
        const fieldName = proposal.type;
        if (fieldName === 'openBorders') {
          db.prepare("UPDATE bloc_regulations SET openBorders = ? WHERE blocId = ?").run(proposal.proposedValue, blocId);
        } else if (fieldName === 'migrationOpen') {
          db.prepare("UPDATE bloc_regulations SET migrationOpen = ? WHERE blocId = ?").run(proposal.proposedValue, blocId);
        } else {
          db.prepare("UPDATE bloc_regulations SET defaultMilitaryAgreement = ? WHERE blocId = ?").run(proposal.proposedValue, blocId);
        }
      } else if (noVotes >= requiredToReject || totalVotes === activeMembersCount) {
        db.prepare("UPDATE bloc_regulation_proposals SET status = 'rejected' WHERE id = ?").run(propId);
      }
    })();

    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: "Errore durante il voto." });
  }
});

export const LawRegistry: Record<string, {
  category: string;
  icon: string;
  title: string;
  description: string;
  threshold: number; // e.g. 0.5 for >50%, 0.8 for >=80%
  delayDays: number; // how long it stays in pending (e.g. 1)
  validate: (region: any, params: any, proposer: any) => string | null; // returns error string or null
  execute: (region: any, params: any, sourceLawId?: string) => void;
}> = {
  change_market_tax: {
    category: "Economia e Tasse",
    icon: "BadgeDollarSign",
    title: "Modifica tassa di mercato",
    description: "Imposta la tassa sulle transazioni di mercato nella regione.",
    threshold: 0.5,
    delayDays: 1,
    validate: (region, params) => {
      const tax = parseInt(params.tax);
      if (isNaN(tax) || tax < 0 || tax > 100) return "Tassa non valida (deve essere tra 0 e 100)";
      return null;
    },
    execute: (region, params) => {
      db.prepare("UPDATE regions SET marketTaxRate = ? WHERE id = ?").run(parseInt(params.tax), region.id);
    }
  },
  change_salary_tax: {
    category: "Economia e Tasse",
    icon: "Briefcase",
    title: "Modifica tassa sui salari",
    description: "Imposta la percentuale di tassazione sugli stipendi guadagnati nelle fabbriche.",
    threshold: 0.5,
    delayDays: 1,
    validate: (region, params) => {
      const tax = parseInt(params.tax);
      if (isNaN(tax) || tax < 0 || tax > 100) return "Tassa non valida (deve essere tra 0 e 100)";
      return null;
    },
    execute: (region, params) => {
      db.prepare("UPDATE regions SET taxes = ? WHERE id = ?").run(parseInt(params.tax), region.id);
    }
  },
  transfer_budget: {
    category: "Economia e Tasse",
    icon: "ArrowRightLeft",
    title: "Trasferimento Budget",
    description: "Trasferisce denaro dal budget statale a un'altra nazione.",
    threshold: 0.5,
    delayDays: 1,
    validate: (region, params) => {
      const amount = parseInt(params.amount);
      if (isNaN(amount) || amount <= 0) return "Importo non valido.";

      const budget = db.prepare("SELECT moneyEUR FROM budgets WHERE ownerType = 'REGION' AND ownerId = ?").get(region.id) as any;
      if (!budget || budget.moneyEUR < amount) return "Spesa superiore ai fondi in bilancio attuali.";

      const target = db.prepare("SELECT id FROM regions WHERE id = ?").get(params.targetRegionId);
      if (!target) return "Nazione destinataria inesistente.";
      if (params.targetRegionId === region.id) return "Non puoi trasferire budget a te stesso.";

      return null;
    },
    execute: (region, params) => {
      const amount = parseInt(params.amount);

      // Ensure we still have the money at execution time
      const currentBudget = db.prepare("SELECT moneyEUR FROM budgets WHERE ownerType = 'REGION' AND ownerId = ?").get(region.id) as any;
      if (currentBudget && currentBudget.moneyEUR >= amount) {
        db.transaction(() => {
          addBudgetTransaction('REGION', region.id, 'TRANSFER', 'BUDGET_TRANSFER', -amount, {}, null, { to: params.targetRegionId });
          addBudgetTransaction('REGION', params.targetRegionId, 'TRANSFER', 'BUDGET_TRANSFER', amount, {}, null, { from: region.id });
        })();
      }
    }
  },
  proclaim_dictatorship: {
    category: "Politica Interna",
    icon: "Crown",
    title: "Proclamazione Dittatura",
    description: "Il Leader diventa dittatore assoluto. Le leggi passano senza voto.",
    threshold: 0.8,
    delayDays: 1,
    validate: (region, params, proposer) => {
      const now = Date.now();
      const THIRTY_ONE_DAYS = 31 * 24 * 60 * 60 * 1000;
      if (now - region.foundationDate < THIRTY_ONE_DAYS && region.foundationDate !== 0) {
        return "Devono passare almeno 31 giorni dalla fondazione dello Stato.";
      }
      if (region.ownerUserId !== proposer.id) {
        return "Solo il Leader attuale può proclamare la dittatura.";
      }
      return null;
    },
    execute: (region, params, sourceLawId) => {
      // Find the proposer from the law record
      const law = db.prepare("SELECT proposerId FROM laws WHERE id = ?").get(sourceLawId) as any;
      const proposerId = law ? law.proposerId : region.ownerUserId;

      db.prepare("UPDATE regions SET dictatorship = 1, governmentForm = 'DICTATORSHIP', leaderUserId = ?, ownerUserId = ?, leaderTitle = 'Dittatore' WHERE id = ?")
        .run(proposerId, proposerId, region.id);
    }
  },
  revoke_dictatorship: {
    category: "Politica Interna",
    icon: "Scale",
    title: "Ritorno alla Democrazia",
    description: "Revoca lo stato di Dittatura. Il parlamento torna ad avere potere.",
    threshold: 0.8,
    delayDays: 1,
    validate: (region) => {
      if (!region.dictatorship) return "Lo stato non è in dittatura.";
      return null;
    },
    execute: (region) => {
      db.prepare("UPDATE regions SET dictatorship = 0, governmentForm = 'PRESIDENTIAL_REPUBLIC', leaderTitle = 'Presidente' WHERE id = ?").run(region.id);
    }
  },
  change_state_name: {
    category: "Politica Interna",
    icon: "Flag",
    title: "Cambio nome dello Stato",
    description: "Modifica il nome ufficiale della nazione.",
    threshold: 0.5,
    delayDays: 1,
    validate: (region, params) => {
      if (!params.name || params.name.length > 22) return "Nome non valido (max 22 caratteri).";
      const existing = db.prepare("SELECT id FROM regions WHERE name = ? AND id != ?").get(params.name, region.id);
      if (existing) return "Nome già in uso da un'altra nazione.";
      return null;
    },
    execute: (region, params) => {
      db.prepare("UPDATE regions SET name = ? WHERE id = ?").run(params.name, region.id);
    }
  },
  change_parliament_size: {
    category: "Politica Interna",
    icon: "Users",
    title: "Dimensione Parlamento",
    description: "Modifica il numero dei seggi in Parlamento (da 10 a 100).",
    threshold: 0.8,
    delayDays: 1,
    validate: (region, params) => {
      const size = parseInt(params.size);
      if (isNaN(size) || size < 10 || size > 100) return "Dimensione non valida (min 10, max 100).";
      return null;
    },
    execute: (region, params) => {
      db.prepare("UPDATE regions SET parliamentSize = ? WHERE id = ?").run(parseInt(params.size), region.id);
    }
  },
  change_parliament_duration: {
    category: "Politica Interna",
    icon: "Clock",
    title: "Durata Mandato",
    description: "Modifica i giorni di durata del mandato parlamentare (da 3 a 30).",
    threshold: 0.8,
    delayDays: 1,
    validate: (region, params) => {
      const days = parseInt(params.days);
      if (isNaN(days) || days < 3 || days > 30) return "Durata non valida (min 3, max 30).";
      return null;
    },
    execute: (region, params) => {
      db.prepare("UPDATE regions SET parliamentDuration = ? WHERE id = ?").run(parseInt(params.days), region.id);
    }
  },
  open_borders: {
    category: "Politica Interna",
    icon: "Unlock",
    title: "Apri Confini",
    description: "Permette a chiunque di prendere la residenza o il permesso di lavoro.",
    threshold: 0.5,
    delayDays: 1,
    validate: (region) => {
      if (region.residencePolicy === 'open') return "I confini sono già aperti.";
      return null;
    },
    execute: (region) => {
      db.prepare("UPDATE regions SET residencePolicy = 'open' WHERE id = ?").run(region.id);
    }
  },
  close_borders: {
    category: "Politica Interna",
    icon: "Lock",
    title: "Chiudi Confini",
    description: "Blocca l'immigrazione. Solo il Leader può approvare visti lavorativi.",
    threshold: 0.5,
    delayDays: 1,
    validate: (region) => {
      if (region.residencePolicy === 'closed') return "I confini sono già chiusi.";
      return null;
    },
    execute: (region) => {
      db.prepare("UPDATE regions SET residencePolicy = 'closed' WHERE id = ?").run(region.id);
    }
  },
  build_hospital: {
    category: "Costruzioni Statali",
    icon: "Heart",
    title: "Costruzione Ospedale",
    description: "Aumenta la Salute (Health) della nazione di 1 punto. Costo: $25.000",
    threshold: 0.5,
    delayDays: 1,
    validate: (region) => {
      if (region.health >= 11) return "Livello Salute già al massimo (11).";
      const budget = db.prepare("SELECT moneyEUR FROM budgets WHERE ownerType = 'REGION' AND ownerId = ?").get(region.id) as any;
      if (!budget || budget.moneyEUR < 25000) return "Fondi statali in bilancio insufficienti ($25.000 richiesti).";
      return null;
    },
    execute: (region) => {
      const currentRegion = db.prepare("SELECT health FROM regions WHERE id = ?").get(region.id) as any;
      if (currentRegion && currentRegion.health < 11) {
        db.transaction(() => {
          addBudgetTransaction('REGION', region.id, 'EXPENSE', 'BUILDING', -25000, {}, null, { building: 'hospital' });
          db.prepare("UPDATE regions SET health = health + 1 WHERE id = ?").run(region.id);
        })();
      }
    }
  },
  migration_agreement: {
    category: "Diplomazia",
    icon: "PlaneTakeoff",
    title: "Accordo di Migrazione",
    description: "Permette ai cittadini di un'altra nazione di viaggiare liberamente nel nostro territorio.",
    threshold: 0.5,
    delayDays: 1,
    validate: (region, params) => {
      if (!params || !params.targetRegionId) return "ID Nazione bersaglio obbligatorio.";
      if (params.targetRegionId === region.id) return "Non puoi fare un accordo con te stesso.";
      const target = db.prepare("SELECT id FROM regions WHERE id = ?").get(params.targetRegionId);
      if (!target) return "Nazione bersaglio inesistente.";
      const existing = db.prepare("SELECT status FROM migration_agreements WHERE fromStateId = ? AND toStateId = ?").get(region.id, params.targetRegionId) as any;
      if (existing && existing.status === 'ACTIVE') return "Esiste già un accordo attivo con questa nazione.";
      return null;
    },
    execute: (region, params, sourceLawId) => {
      const id = Math.random().toString(36).substring(2, 11);
      const now = Date.now();
      db.prepare(`
        INSERT INTO migration_agreements (id, fromStateId, toStateId, status, type, createdAt, activatedAt, revokedAt, sourceLawId, updatedAt)
        VALUES (?, ?, ?, 'ACTIVE', 'UNILATERAL', ?, ?, NULL, ?, ?)
        ON CONFLICT(fromStateId, toStateId) DO UPDATE SET status = 'ACTIVE', type = 'UNILATERAL', activatedAt = ?, revokedAt = NULL, sourceLawId = ?, updatedAt = ?
      `).run(id, region.id, params.targetRegionId, now, now, sourceLawId || null, now, now, sourceLawId || null, now);

      // Check if it's now BILATERAL
      const inverse = db.prepare("SELECT status FROM migration_agreements WHERE fromStateId = ? AND toStateId = ?").get(params.targetRegionId, region.id) as any;
      if (inverse && inverse.status === 'ACTIVE') {
        db.prepare("UPDATE migration_agreements SET type = 'BILATERAL' WHERE fromStateId = ? AND toStateId = ?").run(region.id, params.targetRegionId);
        db.prepare("UPDATE migration_agreements SET type = 'BILATERAL' WHERE fromStateId = ? AND toStateId = ?").run(params.targetRegionId, region.id);
      }
    }
  },
  revoke_migration_agreement: {
    category: "Diplomazia",
    icon: "PlaneLanding",
    title: "Revoca Accordo Migrazione",
    description: "Annulla l'accordo di migrazione con un'altra nazione.",
    threshold: 0.5,
    delayDays: 1,
    validate: (region, params) => {
      if (!params || !params.targetRegionId) return "ID Nazione bersaglio obbligatorio.";
      const existing = db.prepare("SELECT status FROM migration_agreements WHERE fromStateId = ? AND toStateId = ?").get(region.id, params.targetRegionId) as any;
      if (!existing || existing.status !== 'ACTIVE') return "Non c'è un accordo attivo da revocare.";
      return null;
    },
    execute: (region, params, sourceLawId) => {
      const now = Date.now();
      db.prepare("UPDATE migration_agreements SET status = 'INACTIVE', type = 'UNILATERAL', revokedAt = ?, sourceLawId = ?, updatedAt = ? WHERE fromStateId = ? AND toStateId = ?")
        .run(now, sourceLawId || null, now, region.id, params.targetRegionId);
      // Reset the other side to unilateral if it was bilateral
      db.prepare("UPDATE migration_agreements SET type = 'UNILATERAL' WHERE fromStateId = ? AND toStateId = ?").run(params.targetRegionId, region.id);
    }
  },
  build_military_base: {
    category: "Costruzioni Statali",
    icon: "ShieldAlert",
    title: "Base Militare",
    description: "Aumenta la potenza Militare della nazione di 1 punto. Costo: $50.000",
    threshold: 0.5,
    delayDays: 1,
    validate: (region) => {
      if (region.military >= 11) return "Livello Militare già al massimo (11).";
      const budget = db.prepare("SELECT moneyEUR FROM budgets WHERE ownerType = 'REGION' AND ownerId = ?").get(region.id) as any;
      if (!budget || budget.moneyEUR < 50000) return "Fondi statali in bilancio insufficienti ($50.000 richiesti).";
      return null;
    },
    execute: (region) => {
      const currentRegion = db.prepare("SELECT military FROM regions WHERE id = ?").get(region.id) as any;
      if (currentRegion && currentRegion.military < 11) {
        db.transaction(() => {
          addBudgetTransaction('REGION', region.id, 'EXPENSE', 'BUILDING', -50000, {}, null, { building: 'military_base' });
          db.prepare("UPDATE regions SET military = military + 1 WHERE id = ?").run(region.id);
        })();
      }
    }
  },
  build_school: {
    category: "Costruzioni Statali",
    icon: "GraduationCap",
    title: "Costruzione Scuola",
    description: "Aumenta l'Istruzione (Education) della nazione di 1 punto. Costo: $20.000",
    threshold: 0.5,
    delayDays: 1,
    validate: (region) => {
      if (region.education >= 11) return "Livello Istruzione già al massimo (11).";
      const budget = db.prepare("SELECT moneyEUR FROM budgets WHERE ownerType = 'REGION' AND ownerId = ?").get(region.id) as any;
      if (!budget || budget.moneyEUR < 20000) return "Fondi statali in bilancio insufficienti ($20.000 richiesti).";
      return null;
    },
    execute: (region) => {
      const currentRegion = db.prepare("SELECT education FROM regions WHERE id = ?").get(region.id) as any;
      if (currentRegion && currentRegion.education < 11) {
        db.transaction(() => {
          addBudgetTransaction('REGION', region.id, 'EXPENSE', 'BUILDING', -20000, {}, null, { building: 'school' });
          db.prepare("UPDATE regions SET education = education + 1 WHERE id = ?").run(region.id);
        })();
      }
    }
  },
  declare_war: {
    category: "Guerra e Diplomazia",
    icon: "Swords",
    title: "Dichiarazione di Guerra",
    description: "Avvia una guerra contro la nazione bersaglio.",
    threshold: 0.5,
    delayDays: 1,
    validate: (region, params) => {
      if (!params || !params.targetRegionId) return "ID Nazione bersaglio obbligatorio.";
      const target = db.prepare("SELECT id FROM regions WHERE id = ?").get(params.targetRegionId);
      if (!target) return "Nazione bersaglio inesistente.";
      if (params.targetRegionId === region.id) return "Non puoi dichiarare guerra a te stesso.";
      const existingWar = db.prepare("SELECT id FROM wars WHERE status = 'active' AND ((attackerCountryIso2 = ? AND defenderCountryIso2 = ?) OR (attackerCountryIso2 = ? AND defenderCountryIso2 = ?))").get(region.id, params.targetRegionId, params.targetRegionId, region.id);
      if (existingWar) return "Sei già in guerra con questa nazione.";

      // Bloc restriction
      const attackerBloc = db.prepare("SELECT blocId FROM bloc_memberships WHERE stateId = ? AND status = 'active'").get(region.id) as any;
      const defenderBloc = db.prepare("SELECT blocId FROM bloc_memberships WHERE stateId = ? AND status = 'active'").get(params.targetRegionId) as any;
      if (attackerBloc && defenderBloc && attackerBloc.blocId === defenderBloc.blocId) {
        return "Non puoi dichiarare guerra a un membro dello stesso Blocco Geopolitico.";
      }

      const activeWars = db.prepare("SELECT COUNT(*) as c FROM wars WHERE status = 'active' AND (attackerCountryIso2 = ? OR defenderCountryIso2 = ?)").get(region.id, region.id) as any;
      const baseCost = 50000;
      const cost = Math.floor(baseCost * (1 + 0.25 * activeWars.c));
      const budget = db.prepare("SELECT moneyEUR FROM budgets WHERE ownerType = 'REGION' AND ownerId = ?").get(region.id) as any;
      if (!budget || budget.moneyEUR < cost) return `Fondi in bilancio insufficienti ($${cost} richiesti assecondando le guerre simultanee).`;

      return null;
    },
    execute: (region, params) => {
      const activeWars = db.prepare("SELECT COUNT(*) as c FROM wars WHERE status = 'active' AND (attackerCountryIso2 = ? OR defenderCountryIso2 = ?)").get(region.id, region.id) as any;
      const baseCost = 50000;
      const cost = Math.floor(baseCost * (1 + 0.25 * activeWars.c));

      db.transaction(() => {
        addBudgetTransaction('REGION', region.id, 'EXPENSE', 'WAR_START', -cost, {}, null, { target: params.targetRegionId });

        db.prepare(`
          INSERT INTO wars (id, attackerCountryIso2, defenderCountryIso2, status, startedAt, endsAt, attackerScore, defenderScore, lastEventAt)
          VALUES (?, ?, ?, 'active', ?, ?, 0, 0, ?)
        `).run(
          `war_${Date.now()}_${region.id}_${params.targetRegionId}`,
          region.id,
          params.targetRegionId,
          Date.now(),
          Date.now() + (24 * 60 * 60 * 1000), // 24h default
          Date.now()
        );
      })();
    }
  },
  peace_treaty: {
    category: "Guerra e Diplomazia",
    icon: "Handshake",
    title: "Trattato di Pace",
    description: "Propone o accetta la fine delle ostilità con una nazione in guerra.",
    threshold: 0.5,
    delayDays: 1,
    validate: (region, params) => {
      if (!params || !params.targetRegionId) return "ID Nazione bersaglio obbligatorio.";
      const target = db.prepare("SELECT id FROM regions WHERE id = ?").get(params.targetRegionId);
      if (!target) return "Nazione bersaglio inesistente.";
      const existingWar = db.prepare("SELECT id FROM wars WHERE status = 'active' AND ((attackerCountryIso2 = ? AND defenderCountryIso2 = ?) OR (attackerCountryIso2 = ? AND defenderCountryIso2 = ?))").get(region.id, params.targetRegionId, params.targetRegionId, region.id);
      if (!existingWar) return "Non c'è una guerra attiva con questa nazione.";
      return null;
    },
    execute: (region, params) => {
      const existingWar = db.prepare("SELECT * FROM wars WHERE status = 'active' AND ((attackerCountryIso2 = ? AND defenderCountryIso2 = ?) OR (attackerCountryIso2 = ? AND defenderCountryIso2 = ?))").get(region.id, params.targetRegionId, params.targetRegionId, region.id) as any;

      db.transaction(() => {
        if (existingWar) {
          // Determine winner based on scores
          let winner = null;
          let loser = null;
          if (existingWar.attackerScore > existingWar.defenderScore) {
            winner = existingWar.attackerCountryIso2;
            loser = existingWar.defenderCountryIso2;
          } else if (existingWar.defenderScore > existingWar.attackerScore) {
            winner = existingWar.defenderCountryIso2;
            loser = existingWar.attackerCountryIso2;
          }

          // Execute War Loot Transfer if there's a clear winner
          if (winner && loser) {
            const loserBudget = db.prepare("SELECT id, moneyEUR, resources FROM budgets WHERE ownerType = 'REGION' AND ownerId = ?").get(loser) as any;
            if (loserBudget && loserBudget.moneyEUR > 0) {
              const stolenMoney = loserBudget.moneyEUR;
              const stolenResourcesRaw = loserBudget.resources || '{}';

              // Empty the loser
              addBudgetTransaction('REGION', loser, 'WAR_LOOT', 'LOOT_LOST', -stolenMoney, {}, null, { to: winner, warId: existingWar.id });

              // Add to the winner
              addBudgetTransaction('REGION', winner, 'WAR_LOOT', 'LOOT_WON', stolenMoney, {}, null, { from: loser, warId: existingWar.id });

              console.log(`War ended. ${winner} looted ${stolenMoney} EUR from ${loser}`);
            }
          }
        }

        db.prepare(`UPDATE wars SET status = 'ended', endsAt = ? WHERE id = ?`).run(Date.now(), existingWar?.id);
      })();
    }
  },
  apply_sanctions: {
    category: "Diplomazia",
    icon: "ShieldAlert",
    title: "Applica Sanzioni",
    description: "Impedisce il commercio e gli spostamenti da/verso la nazione bersaglio.",
    threshold: 0.5,
    delayDays: 1,
    validate: (region, params) => {
      if (!params || !params.targetRegionId) return "ID Nazione bersaglio obbligatorio.";
      const target = db.prepare("SELECT id FROM regions WHERE id = ?").get(params.targetRegionId);
      if (!target) return "Nazione bersaglio inesistente.";
      if (params.targetRegionId === region.id) return "Non puoi sanzionare te stesso.";
      
      const existing = db.prepare("SELECT id FROM sanctions WHERE fromStateId = ? AND targetStateId = ? AND status = 'ACTIVE'").get(region.id, params.targetRegionId);
      if (existing) return "Esiste già una sanzione attiva contro questa nazione.";
      return null;
    },
    execute: (region, params, sourceLawId) => {
      const now = Date.now();
      const law = db.prepare("SELECT proposerId FROM laws WHERE id = ?").get(sourceLawId) as any;
      const creatorId = law ? law.proposerId : region.ownerUserId;
      
      db.prepare(`
        INSERT INTO sanctions (id, fromStateId, targetStateId, status, createdAt, createdByUserId)
        VALUES (?, ?, ?, 'ACTIVE', ?, ?)
      `).run(`sanc_${Date.now()}_${region.id}_${params.targetRegionId}`, region.id, params.targetRegionId, now, creatorId);
    }
  },
  revoke_sanctions: {
    category: "Diplomazia",
    icon: "Unlock",
    title: "Revoca Sanzioni",
    description: "Annulla le sanzioni attive verso una nazione.",
    threshold: 0.5,
    delayDays: 1,
    validate: (region, params) => {
      if (!params || !params.targetRegionId) return "ID Nazione bersaglio obbligatorio.";
      const existing = db.prepare("SELECT id FROM sanctions WHERE fromStateId = ? AND targetStateId = ? AND status = 'ACTIVE'").get(region.id, params.targetRegionId);
      if (!existing) return "Non c'è una sanzione attiva da revocare.";
      return null;
    },
    execute: (region, params, sourceLawId) => {
      const now = Date.now();
      const law = db.prepare("SELECT proposerId FROM laws WHERE id = ?").get(sourceLawId) as any;
      const revokerId = law ? law.proposerId : region.ownerUserId;
      
      db.prepare("UPDATE sanctions SET status = 'REVOKED', revokedAt = ?, revokedByUserId = ? WHERE fromStateId = ? AND targetStateId = ? AND status = 'ACTIVE'")
        .run(now, revokerId, region.id, params.targetRegionId);
    }
  }
};

app.get("/api/parliament/laws", authenticate, (req: any, res) => {
  try {
    const laws = db.prepare(`
      SELECT l.*, u.username as proposerName 
      FROM laws l 
      JOIN users u ON l.proposerId = u.id 
      WHERE l.regionId = ? 
      ORDER BY l.createdAt DESC
    `).all(req.user.residenceId);

    const lawsWithVotes = laws.map((l: any) => {
      const votes = db.prepare("SELECT vote, COUNT(*) as count FROM law_votes WHERE lawId = ? GROUP BY vote").all(l.id) as any[];
      return {
        ...l,
        yesVotes: votes.find((v: any) => v.vote === 'yes')?.count || 0,
        noVotes: votes.find((v: any) => v.vote === 'no')?.count || 0,
        myVote: db.prepare("SELECT vote FROM law_votes WHERE lawId = ? AND voterId = ?").get(l.id, req.user.id)
      };
    });

    const registryForFrontend = Object.entries(LawRegistry).reduce((acc: any, [key, law]: any) => {
      acc[key] = {
        category: law.category,
        icon: law.icon,
        title: law.title,
        description: law.description,
        threshold: law.threshold,
        delayDays: law.delayDays
      };
      return acc;
    }, {});

    res.json({ laws: lawsWithVotes, registry: registryForFrontend });
  } catch (err: any) {
    require('fs').writeFileSync('debug_api.txt', err.stack || err.toString());
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/parliament/laws/propose", authenticate, (req: any, res) => {
  const user = req.user;
  const { type, params } = req.body; // params is an object

  try {
    const lawDef = LawRegistry[type];
    if (!lawDef) return res.status(400).json({ error: "Tipo di legge sconosciuto." });

    // Verify permission
    const region = db.prepare("SELECT * FROM regions WHERE id = ?").get(user.residenceId) as any;
    if (!region) return res.status(404).json({ error: "Regione non trovata." });

    const isMp = db.prepare("SELECT userId FROM parliament_members WHERE userId = ? AND regionId = ?").get(user.id, user.residenceId);
    const isLeader = region.ownerUserId === user.id;
    const isForeignMinister = region.foreignMinisterId === user.id;
    const isMigrationLaw = type === 'migration_agreement' || type === 'revoke_migration_agreement';

    if (!isMp && !isLeader && !(isForeignMinister && isMigrationLaw)) {
      return res.status(403).json({ error: "Solo Parlamentari, Leader o Ministro Esteri (per accordi migratori) possono proporre leggi." });
    }

    // specific dict check
    if (type === "proclaim_dictatorship") {
      region.dictatorshipAttempts = (region.dictatorshipAttempts || 0) + 1;
      if (region.dictatorshipAttempts > 2) {
        return res.status(400).json({ error: "Hai già raggiunto il limite di 2 tentativi di dittatura in questo mandato parlamentare." });
      }
      db.prepare("UPDATE regions SET dictatorshipAttempts = ? WHERE id = ?").run(region.dictatorshipAttempts, region.id);
    }

    // Validate params
    const validationError = lawDef.validate(region, params, user);
    if (validationError) return res.status(400).json({ error: validationError });

    // Prevent multiple active laws of the SAME TYPE to avoid conflicts
    const activeLaw = db.prepare("SELECT id FROM laws WHERE regionId = ? AND type = ? AND status IN ('pending', 'pending_assent')").get(region.id, type);
    if (activeLaw) return res.status(400).json({ error: "Una proposta simile è già in votazione o in attesa di sanzione." });

    // Format params
    const paramsStr = JSON.stringify(params || {});
    const lawId = Math.random().toString(36).substring(2, 11);

    // Check Dictatorship / Autocracies
    const autocracies = ["DICTATORSHIP", "ONE_PARTY_SYSTEM"];
    if (region.dictatorship || autocracies.includes(region.governmentForm)) {
      if (!isLeader) return res.status(403).json({ error: "In questo regime solo il Leader può legiferare." });
      db.prepare("INSERT INTO laws (id, regionId, proposerId, type, params, status, createdAt, expiresAt) VALUES (?, ?, ?, ?, ?, 'passed', ?, ?)")
        .run(lawId, region.id, user.id, type, paramsStr, Date.now(), Date.now());

      lawDef.execute(region, params, lawId);
      return res.json({ success: true, lawId, immediate: true });
    }

    // Normal Democracy / Executive Monarchy (goes to Parliament first)
    // Check if proposer is a minister with "Fast-Pass" power for this law type
    const isEconomicsMinister = region.economicAdviserId === user.id;
    const lawCat = lawDef.category;

    const canFastPass = (isEconomicsMinister && (lawCat === "Economia e Tasse" || lawCat === "Costruzioni Statali")) ||
      (isForeignMinister && (type === 'open_borders' || type === 'close_borders'));

    if (canFastPass) {
      db.prepare("INSERT INTO laws (id, regionId, proposerId, type, params, status, createdAt, expiresAt) VALUES (?, ?, ?, ?, ?, 'passed', ?, ?)")
        .run(lawId, region.id, user.id, type, paramsStr, Date.now(), Date.now());
      lawDef.execute(region, params, lawId);
      return res.json({ success: true, lawId, immediate: true, message: "Legge approvata immediatamente grazie ai tuoi poteri ministeriali." });
    }

    const expiresAt = Date.now() + (lawDef.delayDays * 24 * 60 * 60 * 1000);
    db.prepare("INSERT INTO laws (id, regionId, proposerId, type, params, status, createdAt, expiresAt) VALUES (?, ?, ?, ?, ?, 'pending', ?, ?)")
      .run(lawId, region.id, user.id, type, paramsStr, Date.now(), expiresAt);

    res.json({ success: true, lawId, immediate: false });
  } catch (err: any) {
    require('fs').writeFileSync('debug_api.txt', err.stack || err.toString());
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/parliament/laws/vote", authenticate, (req: any, res) => {
  const user = req.user;
  const { lawId, vote } = req.body; // vote: 'yes' or 'no', or 'assent' / 'veto'

  const law = db.prepare("SELECT * FROM laws WHERE id = ?").get(lawId) as any;
  if (!law) return res.status(404).json({ error: "Legge non trovata." });

  const region = db.prepare("SELECT * FROM regions WHERE id = ?").get(law.regionId) as any;
  if (!region) return res.status(404).json({ error: "Regione non trovata." });

  // Handle Assent Phase (Executive Monarchy)
  if (law.status === 'pending_assent') {
    if (region.governmentForm !== "EXECUTIVE_MONARCHY") {
      return res.status(400).json({ error: "L'Assenso del Sovrano si applica solo in Monarchia Esecutiva." });
    }

    const isEconomyLaw = LawRegistry[law.type]?.category === "Economia e Tasse";
    const canAssent = (isEconomyLaw && (user.id === region.economicAdviserId || user.id === region.ownerUserId)) ||
      (!isEconomyLaw && user.id === region.ownerUserId);

    if (!canAssent) {
      return res.status(403).json({ error: "Non hai l'autorità per sanzionare o porre veto a questa legge." });
    }

    if (vote === 'yes' || vote === 'assent') {
      db.prepare("UPDATE laws SET status = 'passed' WHERE id = ?").run(lawId);
      try {
        const params = law.params ? JSON.parse(law.params) : {};
        LawRegistry[law.type]?.execute(region, params, law.id);
      } catch (e) {
        console.error(`Error executing law ${law.type} after assent:`, e);
      }
      return res.json({ success: true, result: 'passed' });
    } else {
      db.prepare("UPDATE laws SET status = 'rejected' WHERE id = ?").run(lawId);
      return res.json({ success: true, result: 'vetoed' });
    }
  }

  // Normal Voting Phase
  if (law.status !== 'pending') return res.status(400).json({ error: "Votazione chiusa." });

  const isMp = db.prepare("SELECT userId FROM parliament_members WHERE userId = ? AND regionId = ?").get(user.id, law.regionId);
  const isLeader = region.ownerUserId === user.id;

  if (!isMp && !isLeader) {
    return res.status(403).json({ error: "Solo i Parlamentari o il Leader possono votare le leggi." });
  }

  const existingVote = db.prepare("SELECT id FROM law_votes WHERE lawId = ? AND voterId = ?").get(lawId, user.id);
  if (existingVote) return res.status(400).json({ error: "Hai già votato." });

  db.prepare("INSERT INTO law_votes (id, lawId, voterId, vote, timestamp) VALUES (?, ?, ?, ?, ?)")
    .run(Math.random().toString(36).substring(2, 11), lawId, user.id, vote === 'yes' ? 'yes' : 'no', Date.now());

  res.json({ success: true });
});

app.post("/api/parliament/laws/withdraw", authenticate, (req: any, res) => {
  const user = req.user;
  const { lawId } = req.body;

  const law = db.prepare("SELECT proposerId, status FROM laws WHERE id = ?").get(lawId) as any;
  if (!law) return res.status(404).json({ error: "Legge non trovata." });
  if (law.status !== 'pending' && law.status !== 'pending_assent') return res.status(400).json({ error: "Puoi ritirare solo leggi attualmente in votazione." });
  if (law.proposerId !== user.id) return res.status(403).json({ error: "Solo il creatore della proposta può ritirarla." });

  db.prepare("UPDATE laws SET status = 'withdrawn' WHERE id = ?").run(lawId);
  res.json({ success: true });
});

app.get("/api/leaderboard", authenticate, (req, res) => {
  const leaders = db.prepare("SELECT username, influence, money FROM users ORDER BY influence DESC LIMIT 10").all();
  res.json(leaders);
});

// Election Cronjob Simulation
function checkAndResolveElections() {
  const regions = db.prepare("SELECT id FROM regions").all() as any[];
  const now = Date.now();
  const electionDuration = 3 * 24 * 60 * 60 * 1000; // 3 days

  // Fetch all active elections in one query instead of per-region (avoids N+1)
  const activeElections = db.prepare("SELECT * FROM elections WHERE status = 'active'").all() as any[];
  const activeElectionByRegion = new Map(activeElections.map((e: any) => [e.regionId, e]));

  for (const r of regions) {
    const activeElection = activeElectionByRegion.get(r.id);

    if (!activeElection) {
      // Start a new election
      db.prepare("INSERT INTO elections (id, regionId, status, createdAt, closesAt) VALUES (?, ?, 'active', ?, ?)")
        .run(Math.random().toString(36).substring(2, 11), r.id, now, now + electionDuration);
    } else if (activeElection.closesAt <= now) {
      // Resolve election
      db.transaction(() => {
        db.prepare("UPDATE elections SET status = 'closed' WHERE id = ?").run(activeElection.id);

        const partyVotes = db.prepare("SELECT partyId, COUNT(*) as count FROM election_votes WHERE electionId = ? GROUP BY partyId").all(activeElection.id) as any[];
        const totalVotes = partyVotes.reduce((sum, pv) => sum + pv.count, 0);

        db.prepare("DELETE FROM parliament_members WHERE regionId = ?").run(r.id);

        if (totalVotes > 0) {
          const totalSeats = 20;
          for (const pv of partyVotes) {
            const wonSeats = Math.round((pv.count / totalVotes) * totalSeats);
            if (wonSeats > 0) {
              // Get top candidates from primaries for this party
              const cyclePeriodMs = 5 * 24 * 60 * 60 * 1000;
              const currentCycleStart = Math.floor(now / cyclePeriodMs) * cyclePeriodMs;

              const candidates = db.prepare(`
                SELECT candidateId, COUNT(*) as votes 
                FROM party_primaries 
                WHERE partyId = ? AND createdAt >= ?
                GROUP BY candidateId
                ORDER BY votes DESC
                LIMIT ?
              `).all(pv.partyId, currentCycleStart, wonSeats) as any[];

              // If party didn't have enough candidates in primaries, fallback to joining members by seniority/level
              let finalCandidates = candidates.map(c => c.candidateId);
              if (finalCandidates.length < wonSeats) {
                const fallback = db.prepare(`
                  SELECT pm.userId 
                  FROM party_members pm 
                  JOIN users u ON pm.userId = u.id 
                  WHERE pm.partyId = ? AND pm.userId NOT IN (${finalCandidates.map(id => `'${id}'`).join(',') || "''"})
                  ORDER BY u.level DESC, pm.joinedAt ASC
                  LIMIT ?
                `).all(pv.partyId, wonSeats - finalCandidates.length) as any[];
                finalCandidates = [...finalCandidates, ...fallback.map(f => f.userId)];
              }

              for (const mpId of finalCandidates) {
                db.prepare("INSERT INTO parliament_members (userId, regionId, partyId, electedAt) VALUES (?, ?, ?, ?)").run(mpId, r.id, pv.partyId, now);
              }
            }
          }
        }

        // Start next election
        db.prepare("INSERT INTO elections (id, regionId, status, createdAt, closesAt) VALUES (?, ?, 'active', ?, ?)")
          .run(Math.random().toString(36).substring(2, 11), r.id, now, now + electionDuration);
      })();
    }
  }
}

function checkAndResolveLeaderElections() {
  const now = Date.now();
  const regions = db.prepare(`
    SELECT id, governmentForm, nextLeaderElectionAt 
    FROM regions 
    WHERE governmentForm IN ('PRESIDENTIAL_REPUBLIC', 'DOMINANT_PARTY')
  `).all() as any[];

  for (const r of regions) {
    if (!r.nextLeaderElectionAt) {
      // Initialize timer if missing (5 days)
      const firstElection = now + (5 * 24 * 60 * 60 * 1000);
      db.prepare("UPDATE regions SET nextLeaderElectionAt = ? WHERE id = ?").run(firstElection, r.id);
      continue;
    }

    if (now >= r.nextLeaderElectionAt) {
      db.transaction(() => {
        // Resolve: find winner
        const winner = db.prepare(`
          SELECT userId, votes 
          FROM leader_candidates 
          WHERE regionId = ? 
          ORDER BY votes DESC 
          LIMIT 1
        `).get(r.id) as any;

        if (winner) {
          const title = r.governmentForm === 'PRESIDENTIAL_REPUBLIC' ? 'Presidente' : 'Leader';
          db.prepare("UPDATE regions SET leaderUserId = ?, leaderTitle = ? WHERE id = ?")
            .run(winner.userId, title, r.id);

          // REVOKE ALL MINISTERS upon new leader election
          db.prepare("UPDATE ministers SET status = 'REVOKED' WHERE stateId = ?").run(r.id);
          db.prepare("UPDATE regions SET economicAdviserId = NULL, foreignMinisterId = NULL WHERE id = ?").run(r.id);
        }

        // Reset
        db.prepare("DELETE FROM leader_candidates WHERE regionId = ?").run(r.id);
        db.prepare("DELETE FROM leader_votes WHERE regionId = ?").run(r.id);

        const nextElec = now + (5 * 24 * 60 * 60 * 1000);
        db.prepare("UPDATE regions SET nextLeaderElectionAt = ? WHERE id = ?").run(nextElec, r.id);
      })();
    }
  }
}

// Law Cronjob Simulation
function checkAndResolveLaws() {
  const now = Date.now();
  const pendingLaws = db.prepare(`
    SELECT l.*, r.governmentForm 
    FROM laws l 
    JOIN regions r ON l.regionId = r.id 
    WHERE l.status = 'pending' AND l.expiresAt <= ?
  `).all(now) as any[];

  db.transaction(() => {
    for (const law of pendingLaws) {
      const votes = db.prepare("SELECT vote, COUNT(*) as count FROM law_votes WHERE lawId = ? GROUP BY vote").all(law.id) as any[];
      const yes = votes.find((v: any) => v.vote === 'yes')?.count || 0;
      const no = votes.find((v: any) => v.vote === 'no')?.count || 0;
      const totalVotes = yes + no;

      const lawDef = LawRegistry[law.type];
      if (!lawDef) {
        db.prepare("UPDATE laws SET status = 'rejected' WHERE id = ?").run(law.id);
        continue;
      }

      // Calculate passRatio depending on government form
      // Presidential Republic: Yes > 50% of members voting
      // Parliamentary: often proportional or simple majority. We'll stick to threshold
      const passRatio = totalVotes > 0 ? (yes / totalVotes) : 0;

      let passed = false;
      if (lawDef.threshold === 0.5) {
        // Presidential instantly passes if Yes > 50% of TOTAL PARLIAMENT SEATS could be an advanced rule, 
        // but for now > 50% of votes cast is standard. Let's keep Yes > No
        passed = yes > no;
      } else {
        passed = totalVotes > 0 && passRatio >= lawDef.threshold;
      }

      if (passed) {
        if (law.governmentForm === "EXECUTIVE_MONARCHY") {
          // Send to Assent phase instead of passing immediately
          db.prepare("UPDATE laws SET status = 'pending_assent' WHERE id = ?").run(law.id);
          continue;
        }

        db.prepare("UPDATE laws SET status = 'passed' WHERE id = ?").run(law.id);

        try {
          const region = db.prepare("SELECT * FROM regions WHERE id = ?").get(law.regionId);
          const params = law.params ? JSON.parse(law.params) : { newValue: law.newValue };
          lawDef.execute(region, params, law.id);
        } catch (e) {
          console.error(`Error executing law ${law.type} (${law.id}):`, e);
        }
      } else {
        db.prepare("UPDATE laws SET status = 'rejected' WHERE id = ?").run(law.id);
      }
    }
  })();
}

// Budget Cronjob Automation
function budgetMaintenanceTick() {
  const regions = db.prepare("SELECT id, workRestrictions, residencePolicy FROM regions").all() as any[];

  // Cost definitions
  const borderClosedCost = 100; // $100 per minute
  const residenceRestrictedCost = 50; // $50 per minute

  db.transaction(() => {
    for (const r of regions) {
      let maintenanceCost = 0;
      let reasons: string[] = [];

      if (r.workRestrictions === 1) {
        maintenanceCost += borderClosedCost;
        reasons.push("Confini chiusi");
      }
      if (r.residencePolicy !== 'open') {
        maintenanceCost += residenceRestrictedCost;
        reasons.push("Residenza controllata");
      }

      if (maintenanceCost > 0) {
        try {
          addBudgetTransaction('REGION', r.id, 'SYSTEM_TICK', 'BORDERS_MAINTENANCE', -maintenanceCost, {}, null, { reasons });
        } catch (e) {
          // Budget insufficient, auto-open borders and free residence
          db.prepare("UPDATE regions SET workRestrictions = 0, residencePolicy = 'open' WHERE id = ?").run(r.id);
          console.log(`Region ${r.id} ran out of budget for maintenance. Borders auto-opened.`);
        }
      }
    }
  })();
}

// War Resolution Cronjob
function checkAndResolveWars() {
  const expiredWars = db.prepare("SELECT * FROM wars WHERE status = 'active' AND endsAt < ?").all(Date.now()) as any[];

  if (expiredWars.length === 0) return;

  for (const war of expiredWars) {
    db.transaction(() => {
      let winner = null;
      let loser = null;

      if (war.attackerScore > war.defenderScore) {
        winner = war.attackerCountryIso2;
        loser = war.defenderCountryIso2;
      } else if (war.defenderScore > war.attackerScore) {
        winner = war.defenderCountryIso2;
        loser = war.attackerCountryIso2;
      }

      if (winner && loser) {
        // Transfer Treasury (Loot)
        const loserBudget = db.prepare("SELECT moneyEUR FROM budgets WHERE ownerType = 'REGION' AND ownerId = ?").get(loser) as any;
        if (loserBudget && loserBudget.moneyEUR > 0) {
          const loot = loserBudget.moneyEUR;
          addBudgetTransaction('REGION', loser, 'WAR_LOOT', 'LOOT_LOST', -loot, {}, null, { to: winner, warId: war.id });
          addBudgetTransaction('REGION', winner, 'WAR_LOOT', 'LOOT_WON', loot, {}, null, { from: loser, warId: war.id });
          console.log(`[WAR] ${winner} looted ${loot} EUR from ${loser}`);
        }

        // Conquest Logic: If Attacker wins, they take over the region
        if (winner === war.attackerCountryIso2) {
          const attackerRegion = db.prepare("SELECT leaderUserId, nationId FROM regions WHERE id = ?").get(winner) as any;
          if (attackerRegion && attackerRegion.leaderUserId) {
            // Conquering means moving the region into the Attacker's Nation
            db.prepare("UPDATE regions SET ownerUserId = ?, nationId = ?, stability = 30 WHERE id = ?")
              .run(attackerRegion.leaderUserId, attackerRegion.nationId || `nation_${winner}`, loser);

            console.log(`[WAR] ${winner} CONQUERED ${loser}. Region added to nation: ${attackerRegion.nationId}`);
          }
        }
      }

      // Mark war as ended
      db.prepare("UPDATE wars SET status = 'ended', endsAt = ? WHERE id = ?").run(Date.now(), war.id);
    })();
  }
}

// Vite middleware for development
async function startServer() {
  checkAndResolveElections();
  checkAndResolveLeaderElections();
  checkAndResolveLaws();
  checkAndResolveWars();

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static("dist"));
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  }).on('error', (err: any) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`FATAL ERROR: Port ${PORT} is already in use.`);
    } else {
      console.error("FATAL ERROR: Server failed to start:", err);
    }
    process.exit(1);
  });

  // Global Budget Tick (every 60 seconds)
  setInterval(() => {
    try {
      budgetMaintenanceTick();
    } catch (e) {
      console.error("Budget tick error:", e);
    }
  }, 60 * 1000);

  // Global Economy Tick (every 10 minutes)
  // DISABLED: Regions are now passive containers.
  /*
  setInterval(() => {
    console.log("Running economy tick...");
    db.prepare(`
      UPDATE regions 
      SET population = population + CAST(population * 0.001 AS INTEGER),
          stability = MIN(100, stability + 1)
      WHERE stability < 100
    `).run();
  }, 10 * 60 * 1000);
  */

  // Game Cronjobs (Laws and Elections)
  setInterval(() => {
    checkAndResolveElections();
    checkAndResolveLaws();
    checkAndResolveWars();
  }, 60 * 1000); // Check every minute
}

startServer();
