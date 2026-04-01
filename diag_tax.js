
const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data, error } = await supabase.from('regions').select('*').limit(1);
  if (error) {
    fs.writeFileSync('diag_output.txt', 'ERROR: ' + JSON.stringify(error));
  } else {
    const keys = Object.keys(data[0]);
    const taxKeys = keys.filter(k => k.toLowerCase().includes('tax'));
    const entryKeys = keys.filter(k => k.toLowerCase().includes('entry'));
    fs.writeFileSync('diag_output.txt', JSON.stringify({ taxKeys, entryKeys, allCount: keys.length }));
  }
}
run();
