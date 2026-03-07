/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import jwt from "jsonwebtoken";
import cookieParser from "cookie-parser";
import * as admin from "firebase-admin";
import { GAME_CONFIG, PERKS_DEFS } from "./src/types";
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
const db = new Database("game.db");

// Migration: Add email and firebase_uid if they don't exist
try {
  db.exec("ALTER TABLE users ADD COLUMN email TEXT UNIQUE");
} catch (e) { }
try {
  db.exec("ALTER TABLE users ADD COLUMN firebase_uid TEXT UNIQUE");
} catch (e) { }

// Perks Migration: Rename old IDs to new ones
try {
  db.prepare("UPDATE perks SET perkId = 'FORZA' WHERE perkId = 'war_tactics'").run();
  db.prepare("UPDATE perks SET perkId = 'EDUCAZIONE' WHERE perkId = 'work_boost'").run();
  db.prepare("UPDATE perks SET perkId = 'INDUSTRIA' WHERE perkId = 'energy_efficiency'").run();
  db.prepare("UPDATE perks SET perkId = 'LOGISTICA' WHERE perkId = 'regen_boost'").run();
} catch (e) {
  console.error("Migration error:", e);
}

// Gold currency migration
try {
  db.exec("ALTER TABLE users ADD COLUMN gold INTEGER DEFAULT 0");
} catch (e) { }

// Avatar migration
try {
  db.exec("ALTER TABLE users ADD COLUMN avatarData TEXT");
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

// Regions refactor migrations
const runMigration = (cmd: string, label: string) => {
  try {
    db.exec(cmd);
    console.log(`Migration SUCCESS: ${label}`);
  } catch (e: any) {
    if (e.message.includes("duplicate column name") || e.message.includes("already exists")) {
      console.log(`Migration SKIPPED (already exists): ${label}`);
    } else {
      console.error(`Migration ERROR [${label}]:`, e.message);
    }
  }
};

runMigration("ALTER TABLE regions ADD COLUMN treasury INTEGER DEFAULT 0", "regions.treasury");
runMigration("ALTER TABLE regions ADD COLUMN economyLevel INTEGER DEFAULT 1", "regions.economyLevel");
runMigration("ALTER TABLE regions ADD COLUMN health INTEGER DEFAULT 1", "regions.health");
runMigration("ALTER TABLE regions ADD COLUMN education INTEGER DEFAULT 1", "regions.education");
runMigration("ALTER TABLE regions ADD COLUMN military INTEGER DEFAULT 1", "regions.military");
runMigration("ALTER TABLE regions RENAME COLUMN ownerId TO ownerUserId", "regions.ownerId -> ownerUserId");
runMigration("UPDATE regions SET stability = 10 WHERE stability > 10", "normalize stability");
runMigration("ALTER TABLE player_factories ADD COLUMN regionId TEXT", "player_factories.regionId");

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
    perkPoints INTEGER DEFAULT 0
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
    ownerUserId TEXT,
    FOREIGN KEY(ownerUserId) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS factories (
    id TEXT PRIMARY KEY,
    name TEXT,
    type TEXT,
    payoutMoney INTEGER,
    energyCost INTEGER,
    cooldownSec INTEGER,
    minLevel INTEGER DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS user_factory_cooldowns (
    userId TEXT,
    factoryId TEXT,
    lastUsed INTEGER,
    PRIMARY KEY(userId, factoryId),
    FOREIGN KEY(userId) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS articles (
    id TEXT PRIMARY KEY,
    authorId TEXT,
    authorName TEXT,
    title TEXT,
    content TEXT,
    createdAt INTEGER,
    updatedAt INTEGER,
    likeCount INTEGER DEFAULT 0,
    FOREIGN KEY(authorId) REFERENCES users(id)
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

  CREATE TABLE IF NOT EXISTS action_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    userId TEXT,
    action TEXT,
    details TEXT,
    timestamp INTEGER,
    FOREIGN KEY(userId) REFERENCES users(id)
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
`);

// Seed initial regions if empty
const regionCount = db.prepare("SELECT COUNT(*) as count FROM regions").get() as { count: number };
if (regionCount.count === 0) {
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
  const insertRegion = db.prepare("INSERT INTO regions (id, name, population, resources, health, education, military) VALUES (?, ?, ?, ?, 1, 1, 1)");
  countries.forEach(c => insertRegion.run(c.id, c.name, c.population, 50));
}

// Seed factories if empty
/*
const factoryCount = db.prepare("SELECT COUNT(*) as count FROM factories").get() as { count: number };
if (factoryCount.count === 0) {
  const initialFactories = [
    { id: 'f1', name: "Piccola Officina", type: "Manifattura", payoutMoney: 120, energyCost: 10, cooldownSec: 60, minLevel: 1 },
    { id: 'f2', name: "Fattoria Locale", type: "Agricoltura", payoutMoney: 150, energyCost: 12, cooldownSec: 120, minLevel: 2 },
    { id: 'f3', name: "Miniera di Ferro", type: "Estrazione", payoutMoney: 300, energyCost: 20, cooldownSec: 300, minLevel: 5 },
    { id: 'f4', name: "Fabbrica di Munizioni", type: "Militare", payoutMoney: 500, energyCost: 30, cooldownSec: 600, minLevel: 10 },
  ];
  const insertFactory = db.prepare("INSERT INTO factories (id, name, type, payoutMoney, energyCost, cooldownSec, minLevel) VALUES (?, ?, ?, ?, ?, ?, ?)");
  initialFactories.forEach(f => insertFactory.run(f.id, f.name, f.type, f.payoutMoney, f.energyCost, f.cooldownSec, f.minLevel));
}
*/

app.use(express.json());
app.use(cookieParser());

// Helper to get user perks
const getUserPerks = (userId: string) => {
  const perks = db.prepare("SELECT perkId, level FROM perks WHERE userId = ?").all(userId) as { perkId: string, level: number }[];
  const perkMap: Record<string, number> = {};
  perks.forEach(p => perkMap[p.perkId] = p.level);
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

// Middleware to verify JWT and update energy
const authenticate = async (req: any, res: any, next: any) => {
  const token = req.cookies.token;
  if (!token) return res.status(401).json({ error: "Unauthorized" });

  try {
    const decoded = jwt.verify(token, SECRET_KEY) as { id: string };
    const user = db.prepare("SELECT * FROM users WHERE id = ?").get(decoded.id) as any;
    if (!user) return res.status(401).json({ error: "User not found" });

    // Energy regeneration logic
    const perks = getUserPerks(user.id);
    const regenBonus = (perks['LOGISTICA'] || 0) * 5;
    const maxEnergy = GAME_CONFIG.ENERGY_MAX; // Fixed max energy for now
    const regenRate = GAME_CONFIG.ENERGY_REGEN_RATE + regenBonus;

    const now = Date.now();
    const hoursPassed = (now - user.lastEnergyUpdate) / (1000 * 60 * 60);
    const regen = Math.floor(hoursPassed * regenRate);

    if (regen > 0) {
      const newEnergy = Math.min(maxEnergy, user.energy + regen);
      db.prepare("UPDATE users SET energy = ?, lastEnergyUpdate = ? WHERE id = ?")
        .run(newEnergy, now, user.id);
      user.energy = newEnergy;
      user.lastEnergyUpdate = now;
    }

    user.perks = perks;
    user.maxEnergy = maxEnergy;

    // Check Perk completion-on-read in Firestore
    if (process.env.FIREBASE_PROJECT_ID) {
      const fs = getFirestore();
      const userRef = fs.collection("users").doc(user.id);
      const doc = await userRef.get();
      if (doc.exists) {
        const data = doc.data();
        let upgrades = data?.perkUpgrades || {};
        let needsUpdate = false;

        for (const [pId, upg] of Object.entries(upgrades)) {
          const upgrade = upg as any;
          if (upgrade.willCompleteAt <= now) {
            // Upgrade finished! Apply locally and to DB
            db.prepare("INSERT OR REPLACE INTO perks (userId, perkId, level) VALUES (?, ?, ?)")
              .run(user.id, pId, upgrade.targetLevel);
            user.perks[pId] = upgrade.targetLevel;

            // It's safer to use transactions to avoid double applying, but since we update SQLite,
            // we will handle it via optimistic UI/simple update for this assignment.
            delete upgrades[pId];
            needsUpdate = true;
          }
        }

        if (needsUpdate) {
          await userRef.update({ perkUpgrades: upgrades });
        }
        user.perkUpgrades = upgrades;
      } else {
        user.perkUpgrades = {};
      }
    } else {
      user.perkUpgrades = {};
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
        db.prepare("INSERT INTO users (id, username, email, firebase_uid, lastEnergyUpdate) VALUES (?, ?, ?, ?, ?)")
          .run(id, finalUsername, email, uid, Date.now());
        user = db.prepare("SELECT * FROM users WHERE id = ?").get(id);
      } catch (err) {
        // If username exists, try with suffix
        const altUsername = `${finalUsername}_${id}`;
        db.prepare("INSERT INTO users (id, username, email, firebase_uid, lastEnergyUpdate) VALUES (?, ?, ?, ?, ?)")
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
    SELECT r.*, u.username as ownerName,
           (SELECT COUNT(*) FROM player_factories WHERE regionId = r.id) as factoriesCount
    FROM regions r 
    LEFT JOIN users u ON r.ownerUserId = u.id
  `).all();
  res.json(regions);
});

app.get("/api/regions/:id", authenticate, (req, res) => {
  const region = db.prepare(`
    SELECT r.*, u.username as ownerName,
           (SELECT COUNT(*) FROM player_factories WHERE regionId = r.id) as factoriesCount
    FROM regions r 
    LEFT JOIN users u ON r.ownerUserId = u.id
    WHERE r.id = ?
  `).get(req.params.id);
  res.json(region);
});

app.get("/api/countries/:iso2", authenticate, async (req: any, res) => {
  const { iso2 } = req.params;
  if (!iso2 || iso2 === "-99") return res.status(400).json({ error: "Regione non disponibile" });

  try {
    // 1. Get base data from SQLite
    const region = db.prepare(`
      SELECT r.*, u.username as ownerName,
             (SELECT COUNT(*) FROM player_factories WHERE regionId = r.id) as factoriesCount
      FROM regions r 
      LEFT JOIN users u ON r.ownerUserId = u.id
      WHERE r.id = ?
    `).get(iso2.toUpperCase()) as any;

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

    // 3. Construct response prioritizing DB attributes
    const response = {
      ...gameStats, // Base stats like resources
      ...region,    // Persistent stats like health, education, military, treasury, economyLevel
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

app.post("/api/actions/work", authenticate, (req: any, res) => {
  const user = req.user;
  const { factoryId } = req.body;
  const perks = user.perks;

  const factory = db.prepare("SELECT * FROM factories WHERE id = ?").get(factoryId) as any;
  if (!factory) return res.status(404).json({ error: "Factory not found" });
  if (user.level < factory.minLevel) return res.status(400).json({ error: "Level too low" });

  const lastWork = db.prepare("SELECT lastUsed FROM user_factory_cooldowns WHERE userId = ? AND factoryId = ?")
    .get(user.id, factoryId) as { lastUsed: number } | undefined;

  if (lastWork && Date.now() - lastWork.lastUsed < factory.cooldownSec * 1000) {
    return res.status(400).json({ error: "Factory on cooldown" });
  }

  const energyEfficiency = (perks['INDUSTRIA'] || 0) * 0.05;
  const energyCost = Math.ceil(factory.energyCost * (1 - energyEfficiency));

  if (user.energy < energyCost) return res.status(400).json({ error: "Not enough energy" });

  const workBoost = (perks['EDUCAZIONE'] || 0) * 0.1;
  const earnings = Math.floor(factory.payoutMoney * (1 + workBoost));

  db.prepare("UPDATE users SET money = money + ?, energy = energy - ? WHERE id = ?")
    .run(earnings, energyCost, user.id);

  db.prepare("INSERT OR REPLACE INTO user_factory_cooldowns (userId, factoryId, lastUsed) VALUES (?, ?, ?)")
    .run(user.id, factoryId, Date.now());

  addXP(user.id, GAME_CONFIG.XP_PER_WORK);

  res.json({ success: true, earnings });
});

app.get("/api/factories", authenticate, (req: any, res) => {
  const factories = db.prepare("SELECT * FROM factories").all() as any[];
  const cooldowns = db.prepare("SELECT factoryId, lastUsed FROM user_factory_cooldowns WHERE userId = ?").all(req.user.id) as any[];

  const factoriesWithCooldown = factories.map(f => {
    const cd = cooldowns.find(c => c.factoryId === f.id);
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

  const energyEfficiency = (perks['INDUSTRIA'] || 0) * 0.05;
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

  const energyEfficiency = (perks['INDUSTRIA'] || 0) * 0.05;
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

app.post("/api/actions/attack", authenticate, (req: any, res) => {
  const user = req.user;
  const { regionId } = req.body;
  const perks = user.perks;

  const energyEfficiency = (perks['INDUSTRIA'] || 0) * 0.05;
  const energyCost = Math.ceil(GAME_CONFIG.ATTACK_ENERGY_COST * (1 - energyEfficiency));

  if (user.energy < energyCost) return res.status(400).json({ error: "Not enough energy" });
  if (!checkCooldown(user.id, "attack", GAME_CONFIG.ATTACK_COOLDOWN)) return res.status(400).json({ error: "Action on cooldown" });

  const region = db.prepare("SELECT * FROM regions WHERE id = ?").get(regionId) as any;
  if (!region) return res.status(404).json({ error: "Region not found" });

  const warTactics = (perks['FORZA'] || 0) * 0.05;
  const winProbability = Math.min(0.9, 0.3 + (user.influence / 1000) + warTactics);
  const success = Math.random() < winProbability;

  db.prepare("UPDATE users SET energy = energy - ? WHERE id = ?")
    .run(energyCost, user.id);

  if (success) {
    db.prepare("UPDATE regions SET ownerId = ?, stability = stability - 20 WHERE id = ?")
      .run(user.id, regionId);

    // Create a war entry
    const warId = Math.random().toString(36).substring(2, 9);
    db.prepare(`
      INSERT INTO wars (id, attackerCountryIso2, defenderCountryIso2, attackerUserId, defenderUserId, status, startedAt, endsAt, attackerScore, defenderScore, lastEventAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(warId, user.regionId, regionId, user.id, region.ownerId, 'ended', Date.now(), Date.now(), 100, 0, Date.now());

    addXP(user.id, GAME_CONFIG.XP_PER_ATTACK);
  } else {
    addXP(user.id, Math.floor(GAME_CONFIG.XP_PER_ATTACK / 2));
  }

  updateCooldown(user.id, "attack");
  res.json({ success });
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
  res.json({ success: true });
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

// Player Factories API
const FACTORY_ICONS = ["🏭", "⚙️", "🔧", "🏗️", "🔩", "💎", "🚀", "⚡", "🌐", "🛡️"];
const FACTORY_CREATE_GOLD_COST = 50;
const factoryUpgradeCost = (level: number) => Math.round(30 * Math.pow(1.8, level)); // gold cost to upgrade from level to level+1
const factoryPayout = (base: number, level: number) => Math.round(base * Math.pow(1.3, level - 1));

app.get("/api/player-factories", authenticate, (req: any, res) => {
  const factories = db.prepare(`
    SELECT pf.*, u.username as ownerName
    FROM player_factories pf
    LEFT JOIN users u ON pf.ownerId = u.id
    ORDER BY pf.level DESC, pf.createdAt DESC
  `).all() as any[];

  // Add cooldown info for current user
  const cooldowns = db.prepare(
    "SELECT factoryId, lastUsed FROM user_factory_cooldowns WHERE userId = ?"
  ).all(req.user.id) as any[];

  const result = factories.map(f => {
    const cd = cooldowns.find(c => c.factoryId === f.id);
    const remaining = cd ? Math.max(0, (f.cooldownSec * 1000) - (Date.now() - cd.lastUsed)) : 0;
    return {
      ...f,
      payout: factoryPayout(f.payoutBase, f.level),
      upgradeCost: factoryUpgradeCost(f.level),
      remainingCooldown: remaining,
      isOwner: f.ownerId === req.user.id,
    };
  });
  res.json(result);
});

app.post("/api/player-factories", authenticate, (req: any, res) => {
  const user = req.user;
  const { name, icon } = req.body;
  if (!name || typeof name !== "string" || name.trim().length < 2) {
    return res.status(400).json({ error: "Nome fabbrica obbligatorio (min 2 caratteri)" });
  }
  if (user.gold < FACTORY_CREATE_GOLD_COST) {
    return res.status(400).json({ error: `Servono ${FACTORY_CREATE_GOLD_COST} 🏅 Gold per creare una fabbrica` });
  }
  const id = Math.random().toString(36).substring(2, 9);
  const safeIcon = FACTORY_ICONS.includes(icon) ? icon : "🏭";
  const regionId = user.regionId || "IT"; // Default if not set

  db.prepare("UPDATE users SET gold = gold - ? WHERE id = ?").run(FACTORY_CREATE_GOLD_COST, user.id);
  db.prepare(`INSERT INTO player_factories (id, ownerId, ownerName, name, icon, level, payoutBase, energyCost, cooldownSec, regionId, createdAt)
    VALUES (?, ?, ?, ?, ?, 1, 80, 8, 90, ?, ?)`
  ).run(id, user.id, user.username, name.trim(), safeIcon, regionId, Date.now());
  res.json({ success: true, id, goldSpent: FACTORY_CREATE_GOLD_COST });
});

app.post("/api/player-factories/:id/upgrade", authenticate, (req: any, res) => {
  const user = req.user;
  const factory = db.prepare("SELECT * FROM player_factories WHERE id = ?").get(req.params.id) as any;
  if (!factory) return res.status(404).json({ error: "Fabbrica non trovata" });
  if (factory.ownerId !== user.id) return res.status(403).json({ error: "Non sei il proprietario" });
  const cost = factoryUpgradeCost(factory.level);
  if (user.gold < cost) return res.status(400).json({ error: `Servono ${cost} 🏅 Gold per l'upgrade` });
  db.prepare("UPDATE users SET gold = gold - ? WHERE id = ?").run(cost, user.id);
  db.prepare("UPDATE player_factories SET level = level + 1 WHERE id = ?").run(factory.id);
  res.json({ success: true, newLevel: factory.level + 1, goldSpent: cost });
});

app.post("/api/actions/work-factory", authenticate, (req: any, res) => {
  const user = req.user;
  const { factoryId } = req.body;
  const factory = db.prepare("SELECT * FROM player_factories WHERE id = ?").get(factoryId) as any;
  if (!factory) return res.status(404).json({ error: "Fabbrica non trovata" });

  const lastWork = db.prepare("SELECT lastUsed FROM user_factory_cooldowns WHERE userId = ? AND factoryId = ?")
    .get(user.id, factoryId) as { lastUsed: number } | undefined;
  if (lastWork && Date.now() - lastWork.lastUsed < factory.cooldownSec * 1000) {
    return res.status(400).json({ error: "Fabbrica in cooldown" });
  }

  const perks = user.perks;
  const energyEfficiency = (perks['INDUSTRIA'] || 0) * 0.05;
  const energyCost = Math.ceil(factory.energyCost * (1 - energyEfficiency));
  if (user.energy < energyCost) return res.status(400).json({ error: "Energia insufficiente" });

  const workBoost = (perks['EDUCAZIONE'] || 0) * 0.1;
  const payout = Math.floor(factoryPayout(factory.payoutBase, factory.level) * (1 + workBoost));

  db.prepare("UPDATE users SET money = money + ?, energy = energy - ? WHERE id = ?")
    .run(payout, energyCost, user.id);
  db.prepare("INSERT OR REPLACE INTO user_factory_cooldowns (userId, factoryId, lastUsed) VALUES (?, ?, ?)")
    .run(user.id, factoryId, Date.now());
  addXP(user.id, GAME_CONFIG.XP_PER_WORK);
  res.json({ success: true, earnings: payout });
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
  if (!perkDef) return res.status(404).json({ error: "Perk not found" });

  const currentLevel = user.perks[perkId] || 0;
  const targetLevel = currentLevel + 1;
  const baseCost = perkDef.baseCost || 500;
  const baseGoldCost = perkDef.baseGoldCost || 10;
  const timeBaseSeconds = perkDef.timeBaseSeconds || 60;

  // Formule come da richiesta
  const costCash = Math.round(baseCost * Math.pow(1.5, currentLevel));
  const buildTimeSec = Math.round(timeBaseSeconds * Math.pow(1.25, currentLevel));
  const goldCost = Math.ceil(baseGoldCost * Math.pow(1.4, currentLevel));

  if (useGold) {
    if (user.money < costCash) return res.status(400).json({ error: "Fondi in cash insufficienti per supportare il buyout" });
    if (user.gold < goldCost) return res.status(400).json({ error: `Oro insufficiente. Ti servono ${goldCost} Gold.` });

    // Instant completion via Gold buyout
    db.prepare("UPDATE users SET money = money - ?, gold = gold - ? WHERE id = ?")
      .run(costCash, goldCost, user.id);
    db.prepare("INSERT OR REPLACE INTO perks (userId, perkId, level) VALUES (?, ?, ?)")
      .run(user.id, perkId, targetLevel);

    return res.json({ success: true, newLevel: targetLevel, instant: true });
  } else {
    // Normal queued progression
    if (user.money < costCash) return res.status(400).json({ error: `Fondi insufficienti. Costo: $${costCash}` });

    // Check if already upgrading
    if (user.perkUpgrades?.[perkId]) {
      return res.status(400).json({ error: "Questo perk è già in fase di potenziamento." });
    }

    const now = Date.now();
    const willCompleteAt = now + (buildTimeSec * 1000);

    // Dedicate the money immediately
    db.prepare("UPDATE users SET money = money - ? WHERE id = ?").run(costCash, user.id);

    // Write the upgrade job to Firestore
    if (process.env.FIREBASE_PROJECT_ID) {
      const fs = getFirestore();
      const userRef = fs.collection("users").doc(user.id);

      const setDoc = {
        perkUpgrades: {
          [perkId]: {
            startedAt: now,
            willCompleteAt,
            targetLevel,
            costPaid: costCash
          }
        }
      };

      await userRef.set(setDoc, { merge: true });
    }

    return res.json({ success: true, queued: true, willCompleteAt });
  }
});

// ==============================================================
// WEAPON PRODUCTION API (Firestore subcollection productionQueue)
// ==============================================================
const WEAPONS_DEF: Record<string, { timeMin: number, costCash: number, power: number }> = {
  rifle: { timeMin: 1, costCash: 100, power: 2 },
  drone: { timeMin: 8, costCash: 800, power: 20 },
  artillery: { timeMin: 5, costCash: 500, power: 12 },
  tank: { timeMin: 15, costCash: 1500, power: 40 },
  missile: { timeMin: 30, costCash: 5000, power: 150 },
};

app.post("/api/produce", authenticate, async (req: any, res) => {
  const user = req.user;
  const { weaponType, qty } = req.body;

  const weapon = WEAPONS_DEF[weaponType];
  if (!weapon) return res.status(400).json({ error: "Tipo di arma non valido" });

  const amount = Math.max(1, parseInt(qty) || 1);
  const totalCost = weapon.costCash * amount;

  if (user.money < totalCost) {
    return res.status(400).json({ error: `Fondi insufficienti. Costo totale: $${totalCost.toLocaleString()}` });
  }

  try {
    const now = Date.now();
    let startOffset = 0;

    if (process.env.FIREBASE_PROJECT_ID) {
      const fs = getFirestore();
      const queueRef = fs.collection("users").doc(user.id).collection("productionQueue");

      // Find the latest willCompleteAt to queue after it
      const existingSnap = await queueRef.where("status", "in", ["queued", "producing"]).orderBy("willCompleteAt", "desc").limit(1).get();
      if (!existingSnap.empty) {
        const lastItem = existingSnap.docs[0].data();
        const lastComplete = lastItem.willCompleteAt || now;
        if (lastComplete > now) startOffset = lastComplete - now;
      }

      const startedAt = now + startOffset;
      const willCompleteAt = startedAt + weapon.timeMin * 60 * 1000 * amount;

      await queueRef.add({
        weaponType,
        qty: amount,
        status: "queued",
        startedAt,
        willCompleteAt,
        power: weapon.power * amount,
        costsPaid: { cashUsed: totalCost },
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });
    }

    // Deduct cash immediately
    db.prepare("UPDATE users SET money = money - ? WHERE id = ?").run(totalCost, user.id);

    res.json({ success: true, totalCost });
  } catch (err) {
    console.error("Produce error:", err);
    res.status(500).json({ error: "Errore nella produzione" });
  }
});

app.get("/api/produce/list", authenticate, async (req: any, res) => {
  if (!process.env.FIREBASE_PROJECT_ID) return res.json([]);
  try {
    const fs = getFirestore();
    const snap = await fs.collection("users").doc(req.user.id).collection("productionQueue")
      .orderBy("createdAt", "desc")
      .limit(20)
      .get();

    const items = snap.docs.map(doc => {
      const d = doc.data();
      const isReady = d.willCompleteAt <= Date.now() && d.status !== "claimed";
      return {
        id: doc.id,
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

app.post("/api/produce/claim", authenticate, async (req: any, res) => {
  if (!process.env.FIREBASE_PROJECT_ID) return res.status(501).json({ error: "Firestore not configured" });
  const { id } = req.body;
  if (!id) return res.status(400).json({ error: "Item ID required" });

  try {
    const fs = getFirestore();
    const docRef = fs.collection("users").doc(req.user.id).collection("productionQueue").doc(id);

    await fs.runTransaction(async txn => {
      const doc = await txn.get(docRef);
      if (!doc.exists) throw new Error("Item not found");

      const d = doc.data()!;
      if (d.status === "claimed") throw new Error("Già ritirato");
      if (d.willCompleteAt > Date.now()) throw new Error("Produzione non ancora completata");

      txn.update(docRef, { status: "claimed", claimedAt: Date.now() });
    });

    res.json({ success: true });
  } catch (err: any) {
    console.error("Claim error:", err);
    res.status(400).json({ error: err.message || "Errore nel ritiro" });
  }
});

app.get("/api/leaderboard", authenticate, (req, res) => {
  const leaders = db.prepare("SELECT username, influence, money FROM users ORDER BY influence DESC LIMIT 10").all();
  res.json(leaders);
});

// Vite middleware for development
async function startServer() {
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
  });

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
}

startServer();
