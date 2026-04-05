import Database from 'better-sqlite3';
const db = new Database('game.db');
try {
  const user = db.prepare("SELECT * FROM users WHERE id = 'wiwr8ax'").get();
  console.log(JSON.stringify(user, null, 2));
} catch (e) { console.error(e); }
finally { db.close(); }
