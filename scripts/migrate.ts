import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const db = new Database('game.db');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS _migrations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    applied_at TEXT NOT NULL DEFAULT (datetime('now'))
  )
`);

// Define migration order explicitly — add new migrations at the bottom
const MIGRATIONS: string[] = [
  'migration_completa.sql',
  'migration_geography.sql',
  'migration_resources.sql',
  'migration_war_system.sql',
  'migration_factories_v2.sql',
  'migration_factories_v3.sql',
  'migration_factory_upgrades.sql',
  'migration_factory_storage_fix.sql',
  'migration_extraction_system.sql',
  'migration_market_energy_drinks_purchase.sql',
  'migration_market_fix_uuid_cast.sql',
  'migration_messages.sql',
  'migration_newspapers.sql',
  'migration_departments.sql',
  'migration_enclaves.sql',
  'migration_daily_gameplay.sql',
  'migration_daily_missions.sql',
  'migration_daily_gameplay_rls_hardening.sql',
  'migration_daily_tracking_rls_hardening.sql',
  'migration_daily_progress_rls_final.sql',
  'migration_newspaper_rls_hardening.sql',
  'migration_state_page.sql',
  'migration_regional_autonomy.sql',
  'migration_independent_regions_state_machine.sql',
  'migration_regional_indexes.sql',
  'migration_travel_time.sql',
  'migration_war_deploy_rpc.sql',
  'migration_wars_laws_fix.sql',
  'migration_bugfixes_v3.sql',
  'migration_bugfixes_v4.sql',
  'migration_fixes_v2.sql',
  'migration_fix.sql',
  'migration_fix_id_generation.sql',
  'migration_security_fixes.sql',
  'migration_security_linter_fixes_search_path.sql',
  'migration_residual_linter_security_fixes.sql',
  'migration_function_search_path_hardening.sql',
  'migration_rls_defense_depth_sensitive_flows.sql',
  'migration_missing_tables.sql',
  'migration_migration_agreements_fix.sql',
  'migration_resolve_application_atomic.sql',
  'migration_expire_revolution_lobby_atomic.sql',
  'migration_apply_atomic_pending_guard.sql',
  'migration_automation_modes.sql',
  'migration_chat_xp_fix.sql',
  'migration_transfer_work_experience.sql',
  'migration_work_experience_linear_progression.sql',
  'migration_warehouse_history.sql',
  'migration_resource_extraction_gold_history.sql',
  'migration_upgrade_factory_search_path_only.sql',
  'migration_party_assets_hardening.sql',
  'migration_next.sql',
  'migration_travel_cancel.sql',
  'migration_extraction_caps_rebalance.sql',
  'migration_daily_resource_reset_lock.sql',
  'migration_atomic_actions_rpc.sql',
];

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const MIGRATIONS_DIR = path.join(__dirname, '../supabase');

const applied = new Set(
  (db.prepare('SELECT name FROM _migrations').all() as { name: string }[])
    .map(r => r.name)
);

let count = 0;
for (const name of MIGRATIONS) {
  if (applied.has(name)) continue;

  const filePath = path.join(MIGRATIONS_DIR, name);
  if (!fs.existsSync(filePath)) {
    console.warn(`[migrate] WARNING: ${name} not found, skipping`);
    continue;
  }

  const sql = fs.readFileSync(filePath, 'utf8');
  try {
    db.exec(sql);
    db.prepare('INSERT INTO _migrations (name) VALUES (?)').run(name);
    console.log(`[migrate] Applied: ${name}`);
    count++;
  } catch (err) {
    console.error(`[migrate] FAILED on ${name}:`, err);
    process.exit(1);
  }
}

console.log(`[migrate] Done. ${count} new migration(s) applied.`);
db.close();
