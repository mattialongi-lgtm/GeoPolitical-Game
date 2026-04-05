import Database from "better-sqlite3";

const db = new Database("game.db");
const info = db.prepare("UPDATE laws SET expiresAt = ? WHERE status = 'pending'").run(Date.now() - 10000);
console.log(`Updated expiration for ${info.changes} pending laws.`);

// Also enable dictatorship for testing? No, the user can just use the UI if they want, but waiting is 1 day. Let's just resolve the pending ones.
