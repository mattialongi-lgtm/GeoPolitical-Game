const Database = require('better-sqlite3');
const fs = require('fs');
const db = new Database('game.db');

const data = {
  sanctions: db.prepare('SELECT * FROM sanctions').all(),
  regions: db.prepare('SELECT id, name, nationId FROM regions').all(),
  nations: db.prepare('SELECT id, name FROM nations').all()
};

fs.writeFileSync('diag_data.json', JSON.stringify(data, null, 2), 'utf8');
console.log('Data written to diag_data.json');
db.close();
