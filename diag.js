const Database = require('better-sqlite3');
const db = new Database('game.db');

try {
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
    console.log("TABLES:", tables.map(t => t.name).join(", "));

    if (tables.some(t => t.name === 'regions')) {
        const regionSchema = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='regions'").get();
        console.log("\nREGIONS SCHEMA:");
        console.log(regionSchema.sql);
        
        const firstRegion = db.prepare("SELECT * FROM regions LIMIT 1").get();
        console.log("\nFIRST REGION:");
        console.log(JSON.stringify(firstRegion, null, 2));
    }

    if (tables.some(t => t.name === 'sanctions')) {
        const sanctions = db.prepare("SELECT * FROM sanctions").all();
        console.log("\nSANCTIONS CONTENT:");
        console.table(sanctions);
    }

} catch (e) {
    console.error(e);
} finally {
    db.close();
}
