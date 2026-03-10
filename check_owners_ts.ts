import Database from 'better-sqlite3';
const db = new Database('game.db');

try {
  console.log("--- Factories Sample ---");
  const factories = db.prepare(`
    SELECT f.id, f.name, f.ownerUserId, u.username 
    FROM factories f 
    LEFT JOIN users u ON f.ownerUserId = u.id 
    LIMIT 10
  `).all();
  console.log(JSON.stringify(factories, null, 2));

  console.log("\n--- Users Sample ---");
  const users = db.prepare("SELECT id, username FROM users LIMIT 10").all();
  console.log(JSON.stringify(users, null, 2));

} catch (e) {
  console.error(e);
} finally {
  db.close();
}
