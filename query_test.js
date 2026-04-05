import Database from 'better-sqlite3';

const db = new Database('game.db');
const iso2 = 'IT';

try {
  const query = `
      SELECT s.*, 
             COALESCE(n.name, r.name, s.targetStateId) as targetStateName 
      FROM sanctions s
      LEFT JOIN nations n ON s.targetStateId = n.id OR ('nation_' || s.targetStateId) = n.id
      LEFT JOIN regions r ON s.targetStateId = r.id
      WHERE s.fromStateId = ? AND s.status = 'ACTIVE'
  `;
  
  const results = db.prepare(query).all(iso2);
  console.log("BACKEND QUERY RESULTS FOR 'IT':");
  console.log(JSON.stringify(results, null, 2));

  // Check if case matters
  const resultsLower = db.prepare(query).all(iso2.toLowerCase());
  console.log("\nBACKEND QUERY RESULTS FOR 'it':");
  console.log(JSON.stringify(resultsLower, null, 2));

} catch (e) {
  console.error(e);
} finally {
  db.close();
}
