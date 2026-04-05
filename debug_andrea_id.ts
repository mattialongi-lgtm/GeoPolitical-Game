import Database from 'better-sqlite3';
const db = new Database('game.db');

try {
  const factory = db.prepare("SELECT * FROM factories WHERE name LIKE '%Andrea%'").get();
  console.log("Andrea's Factory Record:");
  console.log(JSON.stringify(factory, null, 2));

  if (factory && factory.ownerUserId) {
    const user = db.prepare("SELECT * FROM users WHERE id = ?").get(factory.ownerUserId);
    console.log("\nAssociated User Record:");
    console.log(JSON.stringify(user, null, 2));
  } else {
    console.log("\nNo ownerUserId found for this factory.");
  }
} catch (e) {
  console.error(e);
} finally {
  db.close();
}
