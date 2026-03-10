const Database = require('better-sqlite3');
const db = new Database('game.db');

try {
    const sanctions = db.prepare("SELECT * FROM sanctions WHERE status = 'ACTIVE'").all();
    console.log("ACTIVE SANCTIONS IN DB:");
    console.log(JSON.stringify(sanctions, null, 2));

    const regions = db.prepare("SELECT id, name FROM regions").all();
    console.log("\nALL REGIONS IN DB:");
    console.log(JSON.stringify(regions, null, 2));
} catch (err) {
    console.error(err);
}
