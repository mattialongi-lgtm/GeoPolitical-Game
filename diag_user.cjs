const Database = require('better-sqlite3');
const db = new Database('game.db');

const users = db.prepare('SELECT id, username, residenceId, regionId FROM users').all();
console.log('USERS:', JSON.stringify(users, null, 2));

db.close();
