const db = require('better-sqlite3')('game.db');

const testIds = ['IT', 'nation_IT', 'nation_it', 'it'];

testIds.forEach(id => {
    try {
        const stateId = (id || '').toUpperCase();
        const normalizedId = stateId.replace('NATION_', '');
        
        console.log(`\nTesting ID: "${id}" => stateId: "${stateId}", normalizedId: "${normalizedId}"`);
        
        const sanctions = db.prepare(`
          SELECT s.*, 
                 COALESCE(n.name, r.name, s.targetStateId) as targetStateName 
          FROM sanctions s
          LEFT JOIN nations n ON s.targetStateId = n.id OR ('nation_' || s.targetStateId) = n.id
          LEFT JOIN regions r ON s.targetStateId = r.id
          WHERE (s.fromStateId = ? OR s.fromStateId = ?) AND s.status = 'ACTIVE'
        `).all(stateId, normalizedId);
        
        console.log(`Found ${sanctions.length} sanctions:`);
        sanctions.forEach(s => {
            console.log(` - ID: ${s.id}, Target: ${s.targetStateId}, Name: ${s.targetStateName}`);
        });
    } catch (err) {
        console.error(`Error for ID "${id}":`, err.message);
    }
});
