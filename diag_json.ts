import Database from "better-sqlite3";
import fs from "fs";
const db = new Database("game.db");

const regions = db.prepare("SELECT id, name FROM regions").all();
const sanctions = db.prepare("SELECT * FROM sanctions").all();

const output = {
    regions,
    sanctions
};

fs.writeFileSync("db_diag.json", JSON.stringify(output, null, 2));
db.close();
console.log("Diag written to db_diag.json");
