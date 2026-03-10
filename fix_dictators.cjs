const Database = require('better-sqlite3');
const db = new Database('c:\\Users\\dearm\\.antigravity\\GeoPolitical-Game\\game.db');
try {
    const result = db.prepare("UPDATE regions SET leaderUserId = ownerUserId, leaderTitle = 'Dittatore', governmentForm = 'DICTATORSHIP' WHERE dictatorship = 1 AND leaderUserId IS NULL").run();
    console.log(`Updated ${result.changes} regions.`);
} catch (e) {
    console.error(e);
} finally {
    db.close();
}
