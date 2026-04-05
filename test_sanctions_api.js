import Database from 'better-sqlite3';

const db = new Database('game.db');
const iso2 = 'IT';

try {
  console.log(`TESTING QUERY FOR iso2='${iso2}'`);
  
  const query = `
      SELECT s.*, 
             COALESCE(n.name, r.name, s.targetStateId) as targetStateName 
      FROM sanctions s
      LEFT JOIN nations n ON s.targetStateId = n.id OR ('nation_' || s.targetStateId) = n.id
      LEFT JOIN regions r ON s.targetStateId = r.id
      WHERE s.fromStateId = ? AND s.status = 'ACTIVE'
  `;
  
  const sanctions = db.prepare(query).all(iso2);
  console.log("RESULT:");
  console.log(JSON.stringify(sanctions, null, 2));

  console.log("\nRAW SANCTIONS TABLE (WHERE fromStateId='IT'):");
  const raw = db.prepare("SELECT * FROM sanctions WHERE fromStateId = ?").all(iso2);
  console.log(JSON.stringify(raw, null, 2));

} catch (e) {
  console.error(e);
} finally {
  db.close();
}
