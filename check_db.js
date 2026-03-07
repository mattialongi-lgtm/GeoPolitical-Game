const Database = require('better-sqlite3');
const db = new Database('game.db');
const schema = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='regions'").get();
console.log(schema.sql);
const regions = db.prepare("SELECT * FROM regions LIMIT 1").get();
console.log(JSON.stringify(regions, null, 2));
db.close();
