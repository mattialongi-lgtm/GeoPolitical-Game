const Database = require('better-sqlite3');
const db = new Database('game.db');

console.log("--- SANCTIONS TABLE ---");
const sanctions = db.prepare("SELECT * FROM sanctions").all();
console.log(JSON.stringify(sanctions, null, 2));

console.log("\n--- REGIONS TABLE (IT/FR) ---");
const regions = db.prepare("SELECT id, name FROM regions WHERE id IN ('IT', 'FR', 'nation_IT', 'nation_FR')").all();
console.log(JSON.stringify(regions, null, 2));

console.log("\n--- NATIONS TABLE ---");
const nations = db.prepare("SELECT id, name FROM nations").all();
console.log(JSON.stringify(nations, null, 2));
