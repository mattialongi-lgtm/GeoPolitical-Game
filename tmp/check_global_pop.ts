
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function check() {
    const { data: all, error } = await supabase.from('regions').select('population');
    if (error) {
        console.error(error);
        return;
    }
    let totalAll = 0;
    all?.forEach(r => totalAll += r.population || 0);
    console.log("Total global population:", totalAll);
}
check();
