#!/usr/bin/env node

/**
 * verify-war-tables-rls.mjs
 *
 * Verification script (NOT a migration) that checks whether RLS
 * is enabled on war-related tables by querying pg_class metadata.
 *
 * Usage:
 *   VITE_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/verify-war-tables-rls.mjs
 *
 * Exit codes:
 *   0 — all tables have RLS enabled
 *   1 — at least one table has RLS disabled, missing, or env not configured
 */

const supabaseUrl = (process.env.VITE_SUPABASE_URL || '').trim();
const serviceRoleKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();

if (!supabaseUrl || !serviceRoleKey) {
  console.error(
    'verify-war-tables-rls: SKIPPED — set VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables.',
  );
  process.exit(1);
}

let createClient;
try {
  ({ createClient } = await import('@supabase/supabase-js'));
} catch (_err) {
  console.error(
    'verify-war-tables-rls: SKIPPED — @supabase/supabase-js not installed in this environment.',
  );
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

const WAR_TABLES = [
  'war_participants',
  'war_deployments',
  'war_auto_attacks',
  'revolutions',
  'coups',
  'war_military_agreements',
  'war_departments',
  'war_history',
];

/**
 * Helper function name used as a temporary introspection vehicle.
 * Created, called, then dropped — no schema artefacts are left behind.
 */
const HELPER_FN = '_tmp_check_war_rls_' + Date.now();

// Step 1: Create a temporary function that queries pg_class for RLS status
const createFnSql = `
CREATE OR REPLACE FUNCTION ${HELPER_FN}(p_tables TEXT[])
RETURNS JSON
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
  SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json)
  FROM (
    SELECT c.relname       AS table_name,
           c.relrowsecurity AS rls_enabled
    FROM   pg_class c
    JOIN   pg_namespace n ON n.oid = c.relnamespace
    WHERE  n.nspname = 'public'
      AND  c.relname = ANY(p_tables)
    ORDER  BY c.relname
  ) t;
$$;
`;

const dropFnSql = `DROP FUNCTION IF EXISTS ${HELPER_FN}(TEXT[]);`;

let rows = null;

try {
  // Create helper function
  const { error: createErr } = await supabase.rpc('query', { sql: createFnSql }).catch(() => ({
    error: { message: 'query rpc not available' },
  }));

  // If the generic 'query' RPC doesn't exist, try running via raw SQL endpoint
  if (createErr) {
    // Fallback: call Supabase's SQL endpoint directly
    const sqlRes = await fetch(`${supabaseUrl}/rest/v1/rpc/${HELPER_FN}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        Prefer: 'return=representation',
      },
      body: JSON.stringify({ p_tables: WAR_TABLES }),
    }).catch(() => null);

    if (!sqlRes || !sqlRes.ok) {
      // Cannot create helper function. Try the management SQL API.
      const projectRef = supabaseUrl.replace(/^https?:\/\//, '').split('.')[0];
      const mgmtUrl = `https://api.supabase.com/v1/projects/${projectRef}/sql`;

      // If none of these approaches work, print manual instructions
      console.log('\n--- War Tables RLS Verification ---\n');
      console.log('⚠️  Could not query pg_class programmatically.');
      console.log('    Please run the following SQL in the Supabase SQL Editor:\n');
      console.log(`    SELECT c.relname AS table_name, c.relrowsecurity AS rls_enabled`);
      console.log(`    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace`);
      console.log(`    WHERE n.nspname = 'public'`);
      console.log(`      AND c.relname IN (${WAR_TABLES.map((t) => `'${t}'`).join(', ')})`);
      console.log(`    ORDER BY c.relname;\n`);
      process.exit(1);
    }
  } else {
    // Helper function was created, now call it
    const { data, error: callErr } = await supabase.rpc(HELPER_FN, {
      p_tables: WAR_TABLES,
    });

    if (callErr) {
      console.error('verify-war-tables-rls: error calling helper function:', callErr.message);
    } else {
      rows = typeof data === 'string' ? JSON.parse(data) : data;
    }

    // Clean up helper function
    await supabase.rpc('query', { sql: dropFnSql }).catch(() => {
      // ignore cleanup errors
    });
  }
} catch (err) {
  console.error('verify-war-tables-rls: unexpected error:', err.message || err);
}

// If we couldn't get data, exit with failure
if (!rows || !Array.isArray(rows)) {
  console.log('\n--- War Tables RLS Verification ---\n');
  console.log('⚠️  Could not determine RLS status programmatically.');
  console.log('    Please run the following SQL in the Supabase SQL Editor:\n');
  console.log(`    SELECT c.relname AS table_name, c.relrowsecurity AS rls_enabled`);
  console.log(`    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace`);
  console.log(`    WHERE n.nspname = 'public'`);
  console.log(`      AND c.relname IN (${WAR_TABLES.map((t) => `'${t}'`).join(', ')})`);
  console.log(`    ORDER BY c.relname;\n`);
  process.exit(1);
}

// Build result map
const resultMap = new Map();
for (const row of rows) {
  resultMap.set(row.table_name, row.rls_enabled);
}

// Print results
console.log('\n--- War Tables RLS Verification ---\n');

const maxNameLen = Math.max(...WAR_TABLES.map((t) => t.length));
console.log(`${'Table'.padEnd(maxNameLen)}  | RLS Enabled`);
console.log(`${'─'.repeat(maxNameLen)}──┼─────────────`);

let allPass = true;
for (const table of WAR_TABLES) {
  const rlsEnabled = resultMap.get(table);
  let statusStr;

  if (rlsEnabled === undefined) {
    statusStr = '⚠️  NOT FOUND';
    allPass = false;
  } else if (rlsEnabled === true) {
    statusStr = '✅ YES';
  } else {
    statusStr = '❌ NO';
    allPass = false;
  }

  console.log(`${table.padEnd(maxNameLen)}  | ${statusStr}`);
}

console.log('');
if (allPass) {
  console.log('✅ PASS — All war tables have RLS enabled.');
  process.exit(0);
} else {
  console.error('❌ FAIL — Some war tables have RLS disabled or are missing.');
  process.exit(1);
}
