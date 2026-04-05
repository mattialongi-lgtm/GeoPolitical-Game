import Database from 'better-sqlite3';
import fs from 'fs';

const db = new Database('game.db');

try {
  const regions = db.prepare("SELECT id, name FROM regions").all();
  const nations = db.prepare("SELECT id, name FROM nations").all();
  const sanctions = db.prepare("SELECT * FROM sanctions").all();

  const output = {
    regions,
    nations,
    sanctions
  };

  fs.writeFileSync('inspect_db.json', JSON.stringify(output, null, 2));
  console.log("Database dump saved to inspect_db.json");

} catch (e) {
  console.error(e);
} finally {
  db.close();
}
