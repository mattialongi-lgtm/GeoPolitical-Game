/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import jwt from "jsonwebtoken";
import cookieParser from "cookie-parser";
import bcrypt from "bcrypt";
import * as admin from "firebase-admin";
import { GAME_CONFIG, PERKS_DEFS } from "./src/types";

const BCRYPT_ROUNDS = 12;

const app = express();
const PORT = 3000;
const SECRET_KEY = process.env.JWT_SECRET || "territorial-secret-key";

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
// SQLite does NOT enforce foreign keys by default — enable per connection
db.pragma("foreign_keys = ON");

db.exec(`
  CREATE TABLE IF NOT EXISTS _migrations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    applied_at TEXT NOT NULL DEFAULT (datetime('now'))
  )
`);

// One-time bcrypt migration for existing plaintext passwords
const usersWithPlaintext = db.prepare(
  "SELECT id, password FROM users WHERE password IS NOT NULL AND password NOT LIKE '$2b$%'"
).all() as { id: string; password: string }[];

for (const user of usersWithPlaintext) {
  const hashed = bcrypt.hashSync(user.password, BCRYPT_ROUNDS);
  db.prepare("UPDATE users SET password = ? WHERE id = ?").run(hashed, user.id);
}
if (usersWithPlaintext.length > 0) {
  console.log(`[bcrypt migration] Hashed ${usersWithPlaintext.length} plaintext passwords`);
}

// Migration: Add email and firebase_uid if they don't exist
try {
  db.exec("ALTER TABLE users ADD COLUMN email TEXT UNIQUE");
} catch (e) {}
try {
  db.exec("ALTER TABLE users ADD COLUMN firebase_uid TEXT UNIQUE");
} catch (e) {}

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE,
    email TEXT UNIQUE,
    firebase_uid TEXT UNIQUE,
    password TEXT,
    money INTEGER DEFAULT 1000,
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
    stability INTEGER DEFAULT 100,
    taxes INTEGER DEFAULT 10,
    ownerId TEXT,
    FOREIGN KEY(ownerId) REFERENCES users(id)
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
    FOREIGN KEY(userId) REFERENCES users(id),
    FOREIGN KEY(factoryId) REFERENCES factories(id)
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
  const insertRegion = db.prepare("INSERT INTO regions (id, name, population, resources) VALUES (?, ?, ?, ?)");
  countries.forEach(c => insertRegion.run(c.id, c.name, c.population, 50));
}

// Seed factories if empty
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
const authenticate = (req: any, res: any, next: any) => {
  const token = req.cookies.token;
  if (!token) return res.status(401).json({ error: "Unauthorized" });

  try {
    const decoded = jwt.verify(token, SECRET_KEY) as { id: string };
    const user = db.prepare("SELECT * FROM users WHERE id = ?").get(decoded.id) as any;
    if (!user) return res.status(401).json({ error: "User not found" });

    // Energy regeneration logic
    const perks = getUserPerks(user.id);
    const regenBonus = (perks['regen_boost'] || 0) * 5;
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
    req.user = user;
    next();
  } catch (err) {
    res.status(401).json({ error: "Invalid token" });
  }
};

// Auth Routes
app.post("/api/register", async (req, res) => {
  const { username, password } = req.body;
  const id = Math.random().toString(36).substring(2, 9);
  try {
    const hashedPassword = await bcrypt.hash(password, BCRYPT_ROUNDS);
    db.prepare("INSERT INTO users (id, username, password, lastEnergyUpdate) VALUES (?, ?, ?, ?)")
      .run(id, username, hashedPassword, Date.now());
    const token = jwt.sign({ id }, SECRET_KEY);
    res.cookie("token", token, { httpOnly: true, secure: true, sameSite: "none" });
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: "Username already exists" });
  }
});

app.post("/api/login", async (req, res) => {
  const { username, password } = req.body;
  const user = db.prepare("SELECT * FROM users WHERE username = ?").get(username) as any;
  const valid = user && await bcrypt.compare(password, user.password);
  if (!valid) return res.status(401).json({ error: "Invalid credentials" });

  const token = jwt.sign({ id: user.id }, SECRET_KEY);
  res.cookie("token", token, { httpOnly: true, secure: true, sameSite: "none" });
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
    res.cookie("token", token, { httpOnly: true, secure: true, sameSite: "none" });
    res.json({ success: true });
  } catch (err) {
    console.error("Firebase auth error:", err);
    res.status(401).json({ error: "Invalid Firebase token" });
  }
});

// Game Routes
app.get("/api/me", authenticate, (req: any, res) => {
  // Strip sensitive fields before sending to client
  const { password, firebase_uid, ...safeUser } = req.user;
  res.json(safeUser);
});

app.get("/api/regions", authenticate, (req, res) => {
  const regions = db.prepare(`
    SELECT r.*, u.username as ownerName 
    FROM regions r 
    LEFT JOIN users u ON r.ownerId = u.id
  `).all();
  res.json(regions);
});

app.get("/api/regions/:id", authenticate, (req, res) => {
  const region = db.prepare(`
    SELECT r.*, u.username as ownerName 
    FROM regions r 
    LEFT JOIN users u ON r.ownerId = u.id
    WHERE r.id = ?
  `).get(req.params.id);
  res.json(region);
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

  const energyEfficiency = (perks['energy_efficiency'] || 0) * 0.05;
  const energyCost = Math.ceil(factory.energyCost * (1 - energyEfficiency));
  
  if (user.energy < energyCost) return res.status(400).json({ error: "Not enough energy" });

  const workBoost = (perks['work_boost'] || 0) * 0.1;
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
  const perks = user.perks;

  const energyEfficiency = (perks['energy_efficiency'] || 0) * 0.05;
  const energyCost = Math.ceil(GAME_CONFIG.PROPAGANDA_ENERGY_COST * (1 - energyEfficiency));

  if (user.energy < energyCost) return res.status(400).json({ error: "Not enough energy" });
  if (!checkCooldown(user.id, "propaganda", GAME_CONFIG.PROPAGANDA_COOLDOWN)) return res.status(400).json({ error: "Action on cooldown" });

  const baseInfluence = 5 + Math.floor(Math.random() * 5);
  const influenceGain = baseInfluence; // Removed propaganda_boost perk

  db.prepare("UPDATE users SET influence = influence + ?, energy = energy - ? WHERE id = ?")
    .run(influenceGain, energyCost, user.id);
  
  addXP(user.id, GAME_CONFIG.XP_PER_PROPAGANDA);
  updateCooldown(user.id, "propaganda");

  res.json({ success: true, influenceGain });
});

app.post("/api/actions/invest", authenticate, (req: any, res) => {
  const user = req.user;
  const { regionId } = req.body;
  const perks = user.perks;

  // Validate region exists before deducting resources
  const region = db.prepare("SELECT id FROM regions WHERE id = ?").get(regionId) as any;
  if (!region) return res.status(404).json({ error: "Region not found" });

  const moneyCost = GAME_CONFIG.INVEST_MONEY_COST;

  const energyEfficiency = (perks['energy_efficiency'] || 0) * 0.05;
  const energyCost = Math.ceil(GAME_CONFIG.INVEST_ENERGY_COST * (1 - energyEfficiency));

  if (user.money < moneyCost) return res.status(400).json({ error: "Not enough money" });
  if (user.energy < energyCost) return res.status(400).json({ error: "Not enough energy" });

  db.prepare("UPDATE users SET money = money - ?, energy = energy - ? WHERE id = ?")
    .run(moneyCost, energyCost, user.id);
  
  db.prepare("UPDATE regions SET stability = MIN(100, stability + 5), population = population + 1000 WHERE id = ?")
    .run(regionId);

  res.json({ success: true });
});

app.post("/api/actions/attack", authenticate, (req: any, res) => {
  const user = req.user;
  const { regionId } = req.body;
  const perks = user.perks;

  const energyEfficiency = (perks['energy_efficiency'] || 0) * 0.05;
  const energyCost = Math.ceil(GAME_CONFIG.ATTACK_ENERGY_COST * (1 - energyEfficiency));

  if (user.energy < energyCost) return res.status(400).json({ error: "Not enough energy" });
  if (!checkCooldown(user.id, "attack", GAME_CONFIG.ATTACK_COOLDOWN)) return res.status(400).json({ error: "Action on cooldown" });

  const region = db.prepare("SELECT * FROM regions WHERE id = ?").get(regionId) as any;
  if (!region) return res.status(404).json({ error: "Region not found" });

  const warTactics = (perks['war_tactics'] || 0) * 0.05;
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

app.post("/api/profile/upgrade-perk", authenticate, (req: any, res) => {
  const user = req.user;
  const { perkId } = req.body;

  // Validate perkId against known perk definitions
  const validPerk = PERKS_DEFS.find(p => p.id === perkId);
  if (!validPerk) return res.status(400).json({ error: "Invalid perk ID" });

  const currentLevel = user.perks[perkId] || 0;
  // Progressive cost: 1 + currentLevel
  const cost = 1 + currentLevel;

  if (user.perkPoints < cost) {
    return res.status(400).json({ error: `Punti perk insufficienti. Necessari: ${cost}` });
  }

  db.prepare("INSERT OR REPLACE INTO perks (userId, perkId, level) VALUES (?, ?, ?)")
    .run(user.id, perkId, currentLevel + 1);
  
  db.prepare("UPDATE users SET perkPoints = perkPoints - ? WHERE id = ?")
    .run(cost, user.id);

  res.json({ success: true, newLevel: currentLevel + 1, cost });
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
  setInterval(() => {
    try {
      db.prepare(`
        UPDATE regions
        SET population = population + CAST(population * 0.001 AS INTEGER),
            stability = MIN(100, stability + 1)
        WHERE stability < 100
      `).run();
    } catch (err) {
      console.error("Economy tick failed:", err);
    }
  }, 10 * 60 * 1000);
}

startServer();
