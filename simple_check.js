const Database = require('better-sqlite3');
const db = new Database('game.db');
try {
  const count = db.prepare("SELECT COUNT(*) as c FROM sanctions").get().c;
  console.log("TOTAL SANCTIONS: " + count);
  const rows = db.prepare("SELECT * FROM sanctions").all();
  console.log(JSON.stringify(rows));
} catch (e) {
  console.error(e);
} finally {
  db.close();
}
