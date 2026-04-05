const https = require('https');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const url = process.env.VITE_SUPABASE_URL?.trim();
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

if (!url || !serviceKey) {
  console.error('Mancano VITE_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY in .env');
  process.exit(1);
}

const projectRef = new URL(url).hostname.split('.')[0];
console.log(`Project ref: ${projectRef}`);

const sqlPath = path.join(__dirname, '..', 'supabase', 'fix_donation_bug.sql');
const sql = fs.readFileSync(sqlPath, 'utf8');

const body = JSON.stringify({ query: sql });
const apiUrl = new URL(`https://api.supabase.com/v1/projects/${projectRef}/database/query`);

const options = {
  hostname: apiUrl.hostname,
  path: apiUrl.pathname,
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${serviceKey}`,
    'Content-Length': Buffer.byteLength(body),
  },
};

console.log('Applying migration from supabase/fix_donation_bug.sql...');

const reqHttp = https.request(options, (resp) => {
  let data = '';
  resp.on('data', chunk => data += chunk);
  resp.on('end', () => {
    if (resp.statusCode === 200 || resp.statusCode === 201) {
      console.log('✅ Migration applicata con successo!');
    } else {
      console.error(`❌ Errore HTTP ${resp.statusCode}:`, data);
      process.exit(1);
    }
  });
});

reqHttp.on('error', (e) => {
  console.error('Errore di rete:', e.message);
  process.exit(1);
});

reqHttp.write(body);
reqHttp.end();
