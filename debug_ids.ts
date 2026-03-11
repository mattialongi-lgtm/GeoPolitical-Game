import Database from 'better-sqlite3';
const db = new Database('game.db');

try {
  const factories = db.prepare("SELECT * FROM factories").all();
  console.log("FACTORIES:");
  console.log(JSON.stringify(factories, null, 2));

  const users = db.prepare("SELECT id, username FROM users").all();
  console.log("\nUSERS (ID and Username):");
  console.log(JSON.stringify(users, null, 2));
} catch (e) {
  console.error(e);
} finally {
  db.close();
}
