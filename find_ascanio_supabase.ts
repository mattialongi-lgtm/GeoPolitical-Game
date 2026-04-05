import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.VITE_SUPABASE_URL || "";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || "";

const supabase = createClient(supabaseUrl, supabaseKey);

async function findAscanio() {
    console.log('Searching for Ascanio in Supabase...');
    const { data: users, error } = await supabase
        .from('users')
        .select('*')
        .ilike('username', '%Ascanio%');

    if (error) {
        console.error('Error fetching users:', error);
        return;
    }

    console.log('--- USERS MATCHING Ascanio ---');
    users.forEach(u => {
        console.log(`ID: ${u.id} | Username: ${u.username} | Level: ${u.level} | Gold: ${u.gold} | Money: ${u.money}`);
    });

    const { data: region, error: rError } = await supabase
        .from('regions')
        .select('*')
        .eq('id', 'IT')
        .single();

    if (rError) {
        console.error('Error fetching Italy:', rError);
    } else {
        console.log('\n--- REGION ITALY ---');
        console.log(JSON.stringify(region, null, 2));
    }
}

findAscanio();
