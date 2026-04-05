import Database from 'better-sqlite3';

const db = new Database('game.db');

try {
  console.log("--- REGIONS (ID, NAME) ---");
  const regions = db.prepare("SELECT id, name FROM regions").all();
  regions.forEach(r => console.log(`${r.id}: ${r.name}`));

  console.log("\n--- NATIONS (ID, NAME) ---");
  const nations = db.prepare("SELECT id, name FROM nations").all();
  nations.forEach(n => console.log(`${n.id}: ${n.name}`));

  console.log("\n--- ACTIVE SANCTIONS ---");
  const sanctions = db.prepare("SELECT * FROM sanctions WHERE status = 'ACTIVE'").all();
  console.log(JSON.stringify(sanctions, null, 2));

} catch (e) {
  console.error(e);
} finally {
  db.close();
}
