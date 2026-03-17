
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
        console.error(error);
        return;
    }
    console.log("Regions in IT:");
    let totalPop = 0;
    regions?.forEach(r => {
        console.log(`${r.name} (id: ${r.id}) - Population: ${r.population}`);
        totalPop += r.population || 0;
    });
    console.log("Calculated Total Population:", totalPop);
}
check();
