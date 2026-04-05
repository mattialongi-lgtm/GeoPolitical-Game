import Database from 'better-sqlite3';
const db = new Database('game.db');

try {
  const info = db.pragma("table_info(factories)");
  console.log("Factories Columns:");
  info.forEach(c => console.log(c.name));
} catch (e) {
  console.error(e);
} finally {
  db.close();
}
