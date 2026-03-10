import Database from "better-sqlite3";
const db = new Database("game.db");

console.log("REGIONS TABLE:");
const regions = db.prepare("SELECT id, name FROM regions").all();
console.table(regions);

console.log("\nSANCTIONS TABLE:");
const sanctions = db.prepare("SELECT * FROM sanctions WHERE status = 'ACTIVE'").all();
console.table(sanctions);

db.close();
