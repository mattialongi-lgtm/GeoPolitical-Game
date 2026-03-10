
import Database from "better-sqlite3";

const db = new Database("game.db");

// Force expire the active war between IT and FR
const now = Date.now();
const oneDayAgo = now - (24 * 60 * 60 * 1000 + 1000);

const war = db.prepare("SELECT * FROM wars WHERE attackerCountryIso2 = 'IT' AND defenderCountryIso2 = 'FR' AND status = 'active'").get() as any;

if (war) {
    console.log(`Found active war: ${war.id}. Expiring it...`);
    db.prepare("UPDATE wars SET endsAt = ? WHERE id = ?").run(oneDayAgo, war.id);
    console.log("War expired. Please restart server.ts or wait 60 seconds for the resolution ticker.");
} else {
    console.log("No active IT vs FR war found. Check the database.");
}

db.close();
