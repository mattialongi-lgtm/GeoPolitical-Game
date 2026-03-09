import Database from "better-sqlite3";

console.log("Connecting to Database...");
const db = new Database("game.db");

// Get the user. Since this is local testing, we just get the first user
// or the one currently logged in. There's probably only one main user anyway.
const user = db.prepare("SELECT * FROM users ORDER BY lastLogin DESC LIMIT 1").get() as any;

if (user) {
    console.log(`Found user: ${user.username} (${user.id})`);

    // 1. Make them the owner of Italy and Dictator
    db.prepare("UPDATE regions SET ownerUserId = ?, residencePolicy = 'open', dictatorship = 1 WHERE id = 'IT'").run(user.id);
    console.log(`User ${user.username} is now the Dictator of Italy (IT).`);

    // 2. Put them in the parliament
    // We need a dummy party ID
    let partyId = 'test_party';
    try {
        db.prepare("INSERT OR IGNORE INTO parties (id, name, ideology, tag, description, regionId, leaderUserId, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)").run(
            partyId, "Governo Provvisorio", "Centrist", "GOV", "Partito d'emergenza", "IT", user.id, Date.now()
        );
    } catch (e) {
        // ignore if exists
    }

    try {
        db.prepare("INSERT OR REPLACE INTO parliament_members (userId, regionId, partyId, electedAt) VALUES (?, ?, ?, ?)").run(
            user.id, "IT", partyId, Date.now()
        );
        console.log(`User ${user.username} is now a Parliament Member of Italy.`);
    } catch (e) {
        console.error("Error adding to parliament:", e.message);
    }

    // Give some treasury money to IT so they can test buildings
    db.prepare("UPDATE regions SET treasury = 1000000 WHERE id = 'IT'").run();
    console.log("Added $1,000,000 to Italy's treasury for testing.");

    console.log("Done!");
} else {
    console.log("No users found in the database. Please create an account in the game first.");
}

db.close();
