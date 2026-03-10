import Database from 'better-sqlite3';
const db = new Database('game.db');

try {
  console.log("--- Specific Factory Check: Andrea's Company ---");
  const specific = db.prepare(`
    SELECT f.id, f.name, f.ownerUserId, u.username 
    FROM factories f 
    LEFT JOIN users u ON f.ownerUserId = u.id 
    WHERE f.name LIKE '%Andrea%'
  `).all();
  console.log(JSON.stringify(specific, null, 2));

  console.log("\n--- Factory Count Check ---");
  const count = db.prepare("SELECT COUNT(*) as c FROM factories").get();
  console.log("Total factories:", count.c);

} catch (e) {
  console.error(e);
} finally {
  db.close();
}
