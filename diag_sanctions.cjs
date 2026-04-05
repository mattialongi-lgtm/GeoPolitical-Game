const Database = require('better-sqlite3');

try {
    const db = new Database('game.db', { verbose: console.log });
    console.log('Database opened.');

    const stateId = 'IT';
    const normalizedId = 'IT';

    console.log(`Querying sanctions for stateId: ${stateId}, normalizedId: ${normalizedId}`);

    const sanctions = db.prepare(`
        SELECT s.*, n.name as targetStateName 
        FROM sanctions s
        LEFT JOIN nations n ON s.targetStateId = REPLACE(n.id, 'nation_', '')
        WHERE (s.fromStateId = ? OR s.fromStateId = ?) AND s.status = 'ACTIVE'
    `).all(stateId, normalizedId);

    console.log('SANCTIONS FOUND:', JSON.stringify(sanctions, null, 2));

    const region = db.prepare('SELECT id, name, nationId FROM regions WHERE id = ?').get(stateId);
    console.log('REGION DATA:', JSON.stringify(region, null, 2));

    const nations = db.prepare('SELECT id, name FROM nations').all();
    console.log('ALL NATIONS:', JSON.stringify(nations, null, 2));

    db.close();
} catch (err) {
    console.error('DIAGNOSTIC ERROR:', err);
}
