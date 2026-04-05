const Database = require('better-sqlite3');
const db = new Database('game.db');

console.log('--- ALL SANCTIONS ---');
const sanctions = db.prepare('SELECT * FROM sanctions').all();
console.log(JSON.stringify(sanctions, null, 2));

console.log('--- ALL REGIONS ---');
const regions = db.prepare('SELECT id, name, nationId FROM regions').all();
console.log(JSON.stringify(regions, null, 2));

console.log('--- ALL NATIONS ---');
const nations = db.prepare('SELECT id, name FROM nations').all();
console.log(JSON.stringify(nations, null, 2));

db.close();
