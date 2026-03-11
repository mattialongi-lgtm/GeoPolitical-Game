import Database from 'better-sqlite3';
const db = new Database('game.db');

try {
  const factory = db.prepare("SELECT * FROM factories WHERE name LIKE '%Andrea%'").get() as any;
  if (factory) {
    console.log("FACTORY_FOUND:", JSON.stringify(factory));
    const user = db.prepare("SELECT id, username FROM users WHERE id = ?").get(factory.ownerUserId) as any;
    if (user) {
      console.log("USER_FOUND:", JSON.stringify(user));
    } else {
      console.log("USER_NOT_FOUND_FOR_ID:", factory.ownerUserId);
    }
  } else {
    console.log("FACTORY_NOT_FOUND");
  }
} catch (e) {
  console.error(e);
} finally {
  db.close();
}
