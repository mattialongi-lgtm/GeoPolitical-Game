import Database from "better-sqlite3";
import { execSync } from 'child_process';
import fetch from "node-fetch";

async function testFetch() {
    // We need to fetch with a cookie or jwt to authenticate.
    // Let's just create a raw auth token manually since we know the secret for local dev.
    const jwt = require("jsonwebtoken");
    const SECRET_KEY = "antigravitia_super_secret_key_2026";

    // We need a user to mock
    const db = new Database("game.db");
    const user = db.prepare("SELECT * FROM users LIMIT 1").get() as any;
    if (!user) {
        console.log("No user found");
        return;
    }

    const token = jwt.sign({ id: user.id, username: user.username }, SECRET_KEY);
    console.log("Token generated.");

    try {
        const res = await fetch("http://localhost:3000/api/parliament/laws", {
            headers: {
                "Cookie": `jwt=${token}`
            }
        });

        const text = await res.text();
        console.log("Response starts with:");
        console.log(text.substring(0, 500)); // print first 500 chars to check registry
    } catch (e) {
        console.log("Error:", e);
    }
}

testFetch();
