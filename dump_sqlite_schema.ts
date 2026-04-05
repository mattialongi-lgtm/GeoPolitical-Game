import Database from 'better-sqlite3';

const db = new Database('game.db');
const tables = db.prepare("SELECT name, sql FROM sqlite_master WHERE type='table'").all();

tables.forEach((t: any) => {
  console.log('--- ' + t.name + ' ---');
  console.log(t.sql);
  console.log('\n');
});

db.close();
