
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function check() {
    const { count: total, error: e1 } = await supabase.from('regions').select('*', { count: 'exact', head: true });
    const { count: independent, error: e2 } = await supabase.from('regions').select('*', { count: 'exact', head: true }).is('nation_id', null);
    console.log("Total regions:", total);
    console.log("Independent regions:", independent);
}
check();
