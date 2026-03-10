const Database = require('better-sqlite3');
const db = new Database('game.db');
const regions = db.prepare("SELECT id, name FROM regions").all();
console.log(JSON.stringify(regions, null, 2));
db.close();
