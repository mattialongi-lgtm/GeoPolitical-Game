/**
 * apply_departments_migration.cjs
 * Applica la migration per i Dipartimenti di Stato via Supabase Management API.
 * Eseguire con: node apply_departments_migration.cjs
 */
const https = require('https');
require('dotenv').config();

const url = process.env.VITE_SUPABASE_URL?.trim();
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

if (!url || !serviceKey) {
  console.error('Mancano VITE_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY in .env');
  process.exit(1);
}

// Estrai il project ref dall'URL (es. https://abcdef.supabase.co → abcdef)
const projectRef = new URL(url).hostname.split('.')[0];
console.log(`Project ref: ${projectRef}`);

const sql = `
-- Migration: Sistema Dipartimenti di Stato

-- 1. Punteggi per Stato per dipartimento (aggregato)
CREATE TABLE IF NOT EXISTS state_department_scores (
  nation_id   TEXT        NOT NULL,
  department  TEXT        NOT NULL,
  score       BIGINT      NOT NULL DEFAULT 0,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (nation_id, department)
);

CREATE INDEX IF NOT EXISTS idx_sds_department_score
  ON state_department_scores (department, score DESC);

-- 2. Contributi giornalieri del player
CREATE TABLE IF NOT EXISTS player_department_contributions (
  id             UUID        NOT NULL DEFAULT gen_random_uuid(),
  player_id      TEXT        NOT NULL,
  nation_id      TEXT        NOT NULL,
  contributions  JSONB       NOT NULL,
  day_key        TEXT        NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (id),
  UNIQUE (player_id, day_key)
);

CREATE INDEX IF NOT EXISTS idx_pdc_player_day
  ON player_department_contributions (player_id, day_key);

CREATE INDEX IF NOT EXISTS idx_pdc_nation_day
  ON player_department_contributions (nation_id, day_key);
`;

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

console.log('Applying migration...');

const reqHttp = https.request(options, (resp) => {
  let data = '';
  resp.on('data', chunk => data += chunk);
  resp.on('end', () => {
    if (resp.statusCode === 200 || resp.statusCode === 201) {
      console.log('✅ Migration applicata con successo!');
    } else {
      console.error(`❌ Errore HTTP ${resp.statusCode}:`, data);
      console.log('\n📋 Applica manualmente questa SQL nel Supabase SQL Editor:\n');
      console.log(sql);
    }
  });
});

reqHttp.on('error', (e) => {
  console.error('Errore di rete:', e.message);
  console.log('\n📋 Applica manualmente questa SQL nel Supabase SQL Editor:\n');
  console.log(sql);
});

reqHttp.write(body);
reqHttp.end();
