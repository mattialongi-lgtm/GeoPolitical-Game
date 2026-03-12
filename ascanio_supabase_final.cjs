const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
require('dotenv').config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || "";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || "";

const supabase = createClient(supabaseUrl, supabaseKey);

async function findAscanio() {
    let output = 'Searching for Ascanio in Supabase...\n';
    const { data: users, error } = await supabase
        .from('users')
        .select('*')
        .ilike('username', '%Ascanio%');

    if (error) {
        output += `Error fetching users: ${JSON.stringify(error)}\n`;
    } else {
        output += '--- USERS MATCHING Ascanio ---\n';
        users.forEach(u => {
            output += `ID: ${u.id} | Username: ${u.username} | Level: ${u.level} | Gold: ${u.gold} | Money: ${u.money}\n`;
        });
    }

    const { data: region, error: rError } = await supabase
        .from('regions')
        .select('*')
        .eq('id', 'IT')
        .single();

    if (rError) {
        output += `\nError fetching Italy: ${JSON.stringify(rError)}\n`;
    } else {
        output += '\n--- REGION ITALY ---\n';
        output += JSON.stringify(region, null, 2) + '\n';
    }

    fs.writeFileSync('ascanio_output.txt', output);
    console.log('Output written to ascanio_output.txt');
}

findAscanio();
