const Database = require('better-sqlite3');
const db = new Database('game.db');

console.log("REGIONS SAMPLE:");
const regions = db.prepare("SELECT id, name FROM regions LIMIT 20").all();
console.table(regions);

console.log("\nNATIONS SAMPLE:");
const nations = db.prepare("SELECT id, name FROM nations LIMIT 20").all();
console.table(nations);

console.log("\nACTIVE SANCTIONS:");
const sanctions = db.prepare("SELECT * FROM sanctions WHERE status = 'ACTIVE'").all();
console.table(sanctions);

db.close();
