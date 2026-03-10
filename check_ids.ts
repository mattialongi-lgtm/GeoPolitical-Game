import Database from 'better-sqlite3';
const db = new Database('game.db');

try {
  console.log("--- Factories ownerUserId values ---");
  const factories = db.prepare("SELECT id, name, ownerUserId FROM factories").all();
  factories.forEach(f => {
    console.log(`Factory: ${f.name}, ownerUserId: ${f.ownerUserId}`);
  });

  console.log("\n--- Users ID and Firebase UID values ---");
  const users = db.prepare("SELECT id, username, firebase_uid FROM users").all();
  users.forEach(u => {
    console.log(`User: ${u.username}, ID: ${u.id}, FirebaseUID: ${u.firebase_uid}`);
  });

} catch (e) {
  console.error(e);
} finally {
  db.close();
}
