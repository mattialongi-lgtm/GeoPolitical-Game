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
import { GAME_CONFIG } from "./src/types";

const app = express();
const PORT = 3000;
const SECRET_KEY = "territorial-secret-key"; 

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
    reputation INTEGER DEFAULT 0,
    regionId INTEGER DEFAULT 1,
    lastEnergyUpdate INTEGER
  );

  CREATE TABLE IF NOT EXISTS regions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE,
    population INTEGER DEFAULT 100000,
    resources INTEGER DEFAULT 50,
    stability INTEGER DEFAULT 100,
    taxes INTEGER DEFAULT 10,
    ownerId TEXT,
    FOREIGN KEY(ownerId) REFERENCES users(id)
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
  const regions = [
    { name: "Nordia", population: 120000, resources: 60 },
    { name: "Sudoria", population: 90000, resources: 40 },
    { name: "Estia", population: 150000, resources: 70 },
    { name: "Vestia", population: 110000, resources: 55 },
    { name: "Centria", population: 200000, resources: 80 },
  ];
  const insertRegion = db.prepare("INSERT INTO regions (name, population, resources) VALUES (?, ?, ?)");
  regions.forEach(r => insertRegion.run(r.name, r.population, r.resources));
}

app.use(express.json());
app.use(cookieParser());

// Middleware to verify JWT and update energy
const authenticate = (req: any, res: any, next: any) => {
  const token = req.cookies.token;
  if (!token) return res.status(401).json({ error: "Unauthorized" });

  try {
    const decoded = jwt.verify(token, SECRET_KEY) as { id: string };
    const user = db.prepare("SELECT * FROM users WHERE id = ?").get(decoded.id) as any;
    if (!user) return res.status(401).json({ error: "User not found" });

    // Energy regeneration logic
    const now = Date.now();
    const hoursPassed = (now - user.lastEnergyUpdate) / (1000 * 60 * 60);
    const regen = Math.floor(hoursPassed * GAME_CONFIG.ENERGY_REGEN_RATE);
    
    if (regen > 0) {
      const newEnergy = Math.min(GAME_CONFIG.ENERGY_MAX, user.energy + regen);
      db.prepare("UPDATE users SET energy = ?, lastEnergyUpdate = ? WHERE id = ?")
        .run(newEnergy, now, user.id);
      user.energy = newEnergy;
      user.lastEnergyUpdate = now;
    }

    req.user = user;
    next();
  } catch (err) {
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
    res.cookie("token", token, { httpOnly: true, secure: true, sameSite: "none" });
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
  res.json(req.user);
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
  if (user.energy < GAME_CONFIG.WORK_ENERGY_COST) return res.status(400).json({ error: "Not enough energy" });
  if (!checkCooldown(user.id, "work", GAME_CONFIG.WORK_COOLDOWN)) return res.status(400).json({ error: "Action on cooldown" });

  const earnings = 100 + Math.floor(Math.random() * 50);
  db.prepare("UPDATE users SET money = money + ?, energy = energy - ? WHERE id = ?")
    .run(earnings, GAME_CONFIG.WORK_ENERGY_COST, user.id);
  
  updateCooldown(user.id, "work");
  db.prepare("INSERT INTO action_logs (userId, action, details, timestamp) VALUES (?, ?, ?, ?)")
    .run(user.id, "Work", `Earned $${earnings}`, Date.now());

  res.json({ success: true, earnings });
});

app.post("/api/actions/propaganda", authenticate, (req: any, res) => {
  const user = req.user;
  if (user.energy < GAME_CONFIG.PROPAGANDA_ENERGY_COST) return res.status(400).json({ error: "Not enough energy" });
  if (!checkCooldown(user.id, "propaganda", GAME_CONFIG.PROPAGANDA_COOLDOWN)) return res.status(400).json({ error: "Action on cooldown" });

  const influenceGain = 5 + Math.floor(Math.random() * 5);
  db.prepare("UPDATE users SET influence = influence + ?, energy = energy - ? WHERE id = ?")
    .run(influenceGain, GAME_CONFIG.PROPAGANDA_ENERGY_COST, user.id);
  
  updateCooldown(user.id, "propaganda");
  db.prepare("INSERT INTO action_logs (userId, action, details, timestamp) VALUES (?, ?, ?, ?)")
    .run(user.id, "Propaganda", `Gained ${influenceGain} influence`, Date.now());

  res.json({ success: true, influenceGain });
});

app.post("/api/actions/invest", authenticate, (req: any, res) => {
  const user = req.user;
  const { regionId } = req.body;
  if (user.money < GAME_CONFIG.INVEST_MONEY_COST) return res.status(400).json({ error: "Not enough money" });
  if (user.energy < GAME_CONFIG.INVEST_ENERGY_COST) return res.status(400).json({ error: "Not enough energy" });

  db.prepare("UPDATE users SET money = money - ?, energy = energy - ? WHERE id = ?")
    .run(GAME_CONFIG.INVEST_MONEY_COST, GAME_CONFIG.INVEST_ENERGY_COST, user.id);
  
  db.prepare("UPDATE regions SET stability = MIN(100, stability + 5), population = population + 1000 WHERE id = ?")
    .run(regionId);

  db.prepare("INSERT INTO action_logs (userId, action, details, timestamp) VALUES (?, ?, ?, ?)")
    .run(user.id, "Invest", `Invested in region ${regionId}`, Date.now());

  res.json({ success: true });
});

app.post("/api/actions/attack", authenticate, (req: any, res) => {
  const user = req.user;
  const { regionId } = req.body;
  if (user.energy < GAME_CONFIG.ATTACK_ENERGY_COST) return res.status(400).json({ error: "Not enough energy" });
  if (!checkCooldown(user.id, "attack", GAME_CONFIG.ATTACK_COOLDOWN)) return res.status(400).json({ error: "Action on cooldown" });

  const region = db.prepare("SELECT * FROM regions WHERE id = ?").get(regionId) as any;
  if (!region) return res.status(404).json({ error: "Region not found" });

  // Simple deterministic attack logic
  const winProbability = 0.3 + (user.influence / 1000);
  const success = Math.random() < winProbability;

  db.prepare("UPDATE users SET energy = energy - ? WHERE id = ?")
    .run(GAME_CONFIG.ATTACK_ENERGY_COST, user.id);

  let details = "";
  if (success) {
    db.prepare("UPDATE regions SET ownerId = ?, stability = stability - 20 WHERE id = ?")
      .run(user.id, regionId);
    db.prepare("UPDATE users SET reputation = reputation + 10 WHERE id = ?").run(user.id);
    details = `Successful attack on ${region.name}. Region captured!`;
  } else {
    db.prepare("UPDATE users SET reputation = reputation - 5 WHERE id = ?").run(user.id);
    details = `Failed attack on ${region.name}.`;
  }

  updateCooldown(user.id, "attack");
  db.prepare("INSERT INTO action_logs (userId, action, details, timestamp) VALUES (?, ?, ?, ?)")
    .run(user.id, "Attack", details, Date.now());

  res.json({ success, details });
});

app.get("/api/leaderboard", authenticate, (req, res) => {
  const leaders = db.prepare("SELECT username, influence, reputation, money FROM users ORDER BY influence DESC LIMIT 10").all();
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
    console.log("Running economy tick...");
    db.prepare(`
      UPDATE regions 
      SET population = population + CAST(population * 0.001 AS INTEGER),
          stability = MIN(100, stability + 1)
      WHERE stability < 100
    `).run();
  }, 10 * 60 * 1000);
}

startServer();
