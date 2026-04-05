const Database = require('better-sqlite3');
const db = new Database('game.db');

console.log("SANCTIONS TABLE CONTENT:");
const sanctions = db.prepare("SELECT * FROM sanctions").all();
console.table(sanctions);

console.log("\nREGIONS (potential targets) CHECK:");
const regions = db.prepare("SELECT id, name FROM regions WHERE id IN (SELECT targetStateId FROM sanctions)").all();
console.table(regions);

process.exit();
