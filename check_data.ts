import Database from "better-sqlite3";
const db = new Database("game.db");

console.log("--- SANCTIONS ---");
const sanctions = db.prepare("SELECT * FROM sanctions").all();
console.log(JSON.stringify(sanctions, null, 2));

console.log("\n--- REGIONS ---");
const regions = db.prepare("SELECT id, name FROM regions").all();
console.log(JSON.stringify(regions, null, 2));

db.close();
