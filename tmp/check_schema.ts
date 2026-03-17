
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function check() {
    // There's no easy way to get the schema from the JS client without a specific function
    // but I can try to fetch one row and see all columns.
    const { data, error } = await supabase.from('nations').select('*').limit(1);
    if (error) {
        console.error(error);
        return;
    }
    console.log("Nations columns:", Object.keys(data?.[0] || {}));
}
check();
