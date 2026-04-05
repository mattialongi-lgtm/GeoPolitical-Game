
const fs = require('fs');
const data = JSON.parse(fs.readFileSync('diag_output.txt', 'utf8'));
console.log('TAX KEYS:', data.filter(k => k.toLowerCase().includes('tax')));
console.log('ALL KEYS:', data);
