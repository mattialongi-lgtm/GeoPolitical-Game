import Database from 'better-sqlite3';
const db = new Database('game.db');

try {
  const row = db.prepare(`
    SELECT f.id, f.name, f.ownerUserId, u.username as ownerUsername
    FROM factories f 
    LEFT JOIN users u ON f.ownerUserId = u.id 
    WHERE f.name LIKE '%Andrea%'
  `).get();
  
  if (row) {
    console.log("ID:", row.id);
    console.log("Name:", row.name);
    console.log("OwnerID:", row.ownerUserId);
    console.log("OwnerUsername:", row.ownerUsername);
  } else {
    console.log("No factory found with 'Andrea' in name.");
  }

} catch (e) {
  console.error(e);
} finally {
  db.close();
}
