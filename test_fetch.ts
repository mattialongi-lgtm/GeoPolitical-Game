
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function testFetch() {
  const nationId = 'IT';
  const { data: regions, error: regionsError } = await supabase
    .from('regions')
    .select('id, name, population, "developmentIndex", governor:users!governorPlayerId(username), "isAutonomous", "energyGeneration", "energyConsumption", "residencePolicy", "workRestrictions", "nextLeaderElectionAt"')
    .or(`nation_id.eq.${nationId},id.ilike.${nationId}-%`);

  if (regionsError) {
    console.error('ERROR:', regionsError);
  } else {
    console.log('COUNT:', regions?.length);
    console.log('SAMPLE:', JSON.stringify(regions?.[0], null, 2));
  }
}

testFetch();
