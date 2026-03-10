const Database = require('better-sqlite3');
const db = new Database('game.db');
const rows = db.prepare("SELECT id, name FROM regions LIMIT 10").all();
rows.forEach(r => console.log(r.id + " -> " + r.name));
db.close();
process.exit(0);
