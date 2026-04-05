import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

function parseArgs(argv) {
  const args = { userId: null, factoryId: null, energy: 0, drinks: 1, apply: false };
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === '--apply') args.apply = true;
    else if (token === '--userId') args.userId = argv[i + 1], i += 1;
    else if (token === '--factoryId') args.factoryId = argv[i + 1], i += 1;
    else if (token === '--energy') args.energy = Number(argv[i + 1] || 0), i += 1;
    else if (token === '--drinks') args.drinks = Number(argv[i + 1] || 0), i += 1;
  }
  return args;
}

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  '';

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing SUPABASE URL or KEY (VITE_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY).');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.userId || !args.factoryId) {
    console.error('Usage: node scripts/setup_auto_work_test.mjs --userId <uuid> --factoryId <uuid> [--energy 0] [--drinks 1] [--apply]');
    process.exit(2);
  }

  const now = new Date();
  const nowIso = now.toISOString();
  const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();

  const plan = {
    updateUser: { energy: Math.max(0, Math.floor(args.energy)), energyDrinks: Math.max(0, Math.floor(args.drinks)), lastEnergyDrink: 0 },
    upsertAutoWork: {
      userId: args.userId,
      factoryId: args.factoryId,
      mode: 'standard',
      isActive: true,
      activatedAt: nowIso,
      lastFiredAt: null,
      expiresAt,
    },
  };

  console.log('[setup-auto-work] Plan:', plan);
  if (!args.apply) {
    console.log("Dry-run only. Re-run with '--apply' to write changes.");
    return;
  }

  const { error: userErr } = await supabase
    .from('users')
    .update(plan.updateUser)
    .eq('id', args.userId);
  if (userErr) throw userErr;

  const { error: upsertErr } = await supabase
    .from('work_auto_actions')
    .upsert(plan.upsertAutoWork, { onConflict: 'userId' });
  if (upsertErr) throw upsertErr;

  const { data: user } = await supabase
    .from('users')
    .select('id, energy, energyDrinks, lastEnergyDrink, money, gold')
    .eq('id', args.userId)
    .single();

  const { data: aw } = await supabase
    .from('work_auto_actions')
    .select('*')
    .eq('userId', args.userId)
    .maybeSingle();

  console.log('[setup-auto-work] OK. Current user:', user);
  console.log('[setup-auto-work] OK. Current auto-work:', aw);
  console.log('[setup-auto-work] Next: wait for the server tick (up to 60s) and then re-check user energy/inventory and region budgets.');
}

main().catch((err) => {
  console.error('[setup-auto-work] Failed:', err?.message || err);
  process.exit(1);
});

