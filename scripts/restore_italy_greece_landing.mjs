import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

function parseArgs(argv) {
  const args = { apply: false, attacker: 'IT', defender: 'GR', warId: undefined };
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === '--apply') args.apply = true;
    else if (token === '--warId') args.warId = argv[i + 1], i += 1;
    else if (token === '--attacker') args.attacker = String(argv[i + 1] || '').toUpperCase(), i += 1;
    else if (token === '--defender') args.defender = String(argv[i + 1] || '').toUpperCase(), i += 1;
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
  const now = new Date();
  const nowIso = now.toISOString();
  const newEndsAt = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();

  let war = null;

  if (args.warId) {
    const { data, error } = await supabase
      .from('wars')
      .select('*')
      .eq('id', args.warId)
      .maybeSingle();
    if (error) throw error;
    war = data || null;
  } else {
    const attacker = (args.attacker || 'IT').toUpperCase();
    const defender = (args.defender || 'GR').toUpperCase();
    const { data, error } = await supabase
      .from('wars')
      .select('*')
      .eq('warType', 'naval')
      .or(`and(attackerCountryIso2.eq.${attacker},defenderCountryIso2.eq.${defender}),and(attackerCountryIso2.eq.${defender},defenderCountryIso2.eq.${attacker})`)
      .order('createdAt', { ascending: false })
      .limit(5);
    if (error) throw error;

    war =
      (data || []).find((w) => w.navalPhase === 1) ||
      (data || [])[0] ||
      null;
  }

  if (!war) {
    console.error('No matching war found.');
    process.exit(2);
  }

  if (war.warType !== 'naval') {
    console.error(`War ${war.id} is not naval (warType=${war.warType}).`);
    process.exit(3);
  }

  if (war.navalPhase !== 1) {
    console.error(`War ${war.id} is not in navalPhase=1 (navalPhase=${war.navalPhase}).`);
    process.exit(4);
  }

  const phase1AttackerTotal = (war.attackerScore || 0) + (war.phase1AttackerScore || 0);
  const phase1DefenderTotal = (war.defenderScore || 0) + (war.phase1DefenderScore || 0);
  const scoreDifference = phase1AttackerTotal - phase1DefenderTotal;

  console.log('[restore-landing] Candidate war:', {
    id: war.id,
    status: war.status,
    warType: war.warType,
    navalPhase: war.navalPhase,
    attackerCountryIso2: war.attackerCountryIso2,
    defenderCountryIso2: war.defenderCountryIso2,
    endsAt: war.endsAt,
    createdAt: war.createdAt,
  });
  console.log('[restore-landing] Phase 1 totals:', {
    phase1AttackerTotal,
    phase1DefenderTotal,
    scoreDifference,
    attackerWinsPhase1: scoreDifference > 0,
  });
  console.log('[restore-landing] Proposed Phase 2 update:', {
    navalPhase: 2,
    status: 'active',
    endsAt: newEndsAt,
    phase1AttackerScore: phase1AttackerTotal,
    phase1DefenderScore: phase1DefenderTotal,
    attackerScore: scoreDifference,
    defenderScore: 0,
    updatedAt: nowIso,
  });

  if (scoreDifference <= 0) {
    console.error('Refusing to start landing: attacker did not win Phase 1 (scoreDifference <= 0).');
    process.exit(5);
  }

  if (!args.apply) {
    console.log("Dry-run only. Re-run with '--apply' to execute the update.");
    return;
  }

  const { error: updateError } = await supabase
    .from('wars')
    .update({
      navalPhase: 2,
      status: 'active',
      endsAt: newEndsAt,
      phase1AttackerScore: phase1AttackerTotal,
      phase1DefenderScore: phase1DefenderTotal,
      attackerScore: scoreDifference,
      defenderScore: 0,
      updatedAt: nowIso,
    })
    .eq('id', war.id);

  if (updateError) throw updateError;

  const { error: historyError } = await supabase.from('war_history').insert({
    warId: war.id,
    eventType: 'phase_change',
    eventData: {
      from: 1,
      to: 2,
      phase1Winner: 'attacker',
      phase1AttackerTotal,
      phase1DefenderTotal,
      scoreDifference,
      appliedAs: 'defender_malus',
      restoredAt: nowIso,
    },
  });
  if (historyError) throw historyError;

  console.log(`[restore-landing] OK: War ${war.id} moved to navalPhase=2, endsAt=${newEndsAt}`);
}

main().catch((err) => {
  console.error('[restore-landing] Failed:', err?.message || err);
  process.exit(1);
});

