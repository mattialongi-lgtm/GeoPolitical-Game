
import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function run(nationId: string) {
  const { data: regions, error } = await supabase.from('regions')
    .select('id, name, nation_id')
    .or(`nation_id.eq.${nationId},id.ilike.${nationId}-%`);
  
  const { data: allWithNation, error: err2 } = await supabase.from('regions')
    .select('id, name, nation_id')
    .eq('nation_id', nationId);

  fs.writeFileSync('diag_output.txt', JSON.stringify({
    nationId,
    query1Count: regions?.length || 0,
    query2Count: allWithNation?.length || 0,
    sample: regions?.slice(0, 5)
  }, null, 2));
}

const target = process.argv[2] || 'IT';
run(target);
