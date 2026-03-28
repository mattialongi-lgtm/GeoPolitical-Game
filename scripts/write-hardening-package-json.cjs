const fs = require('node:fs');

fs.mkdirSync('.hardening-dist', { recursive: true });
fs.writeFileSync('.hardening-dist/package.json', JSON.stringify({ type: 'commonjs' }) + '\n');
