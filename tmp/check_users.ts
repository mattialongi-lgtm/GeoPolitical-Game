
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function check() {
    const { data: users, error } = await supabase
        .from('users')
        .select('id, regionId');
    
    if (error) {
        console.error(error);
        return;
    }

    const regionCounts: Record<string, number> = {};
    users?.forEach(u => {
        const rid = u.regionId || 'unknown';
        regionCounts[rid] = (regionCounts[rid] || 0) + 1;
    });

    console.log("Users per region in IT Empire (CH, IT, FR):");
    console.log("CH:", regionCounts['CH'] || 0);
    console.log("IT:", regionCounts['IT'] || 0);
    console.log("FR:", regionCounts['FR'] || 0);
}
check();
