
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function check() {
    const { data: regions, error } = await supabase
        .from('regions')
        .select('id, name, population')
        .eq('nation_id', 'IT');
    if (error) {
        process.stdout.write(JSON.stringify(error) + "\n");
        return;
    }
    process.stdout.write(JSON.stringify(regions, null, 2) + "\n");
}
check();
