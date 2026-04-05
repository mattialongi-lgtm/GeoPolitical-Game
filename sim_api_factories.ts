import Database from 'better-sqlite3';
const db = new Database('game.db');

try {
  const regionId = 'IT';
  let query = `
    SELECT f.*, u.username as ownerName 
    FROM factories f 
    LEFT JOIN users u ON f.ownerUserId = u.id 
    WHERE 1=1
  `;
  const params: any[] = [];
  query += " AND f.regionId = ?";
  params.push(regionId);
  query += " ORDER BY f.level DESC, f.createdAt DESC";

  const factories = db.prepare(query).all(...params);
  console.log("RESPONSE_JSON:", JSON.stringify(factories, null, 2));
} catch (e) {
  console.error(e);
} finally {
  db.close();
}
