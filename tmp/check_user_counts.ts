
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function check() {
    const { data, error } = await supabase
        .from('users')
        .select('originalNation');
    
    if (error) {
        console.error(error);
        return;
    }

    const counts: Record<string, number> = {};
    data?.forEach(u => {
        const nationId = u.originalNation || 'NONE';
        counts[nationId] = (counts[nationId] || 0) + 1;
    });

    console.log("User counts by originalNation:", counts);
}
check();
