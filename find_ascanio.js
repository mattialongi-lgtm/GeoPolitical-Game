const sqlite = require('better-sqlite3');
const db = new sqlite('game.db');

const users = db.prepare("SELECT * FROM users WHERE username LIKE '%Ascanio%'").all();

console.log('--- USERS MATCHING Ascanio ---');
users.forEach(u => {
    console.log(`ID: ${u.id} | Username: ${u.username} | Level: ${u.level} | Gold: ${u.gold} | Money: ${u.money}`);
});

const regions = db.prepare("SELECT * FROM regions WHERE id = 'IT'").all();
console.log('\n--- REGION ITALY ---');
console.log(JSON.stringify(regions, null, 2));
