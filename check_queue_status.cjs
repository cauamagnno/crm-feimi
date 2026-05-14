const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

// Parse .env.production.local manually
const envFile = fs.readFileSync('.env.production.local', 'utf-8');
const env = {};
for (const line of envFile.split('\n')) {
  if (line.includes('=')) {
    const [key, ...rest] = line.split('=');
    let val = rest.join('=').trim();
    if (val.startsWith('"') && val.endsWith('"')) {
      val = val.substring(1, val.length - 1);
    }
    env[key] = val;
  }
}

const supabaseUrl = env.VITE_SUPABASE_URL;
const supabaseKey = env.VITE_SUPABASE_PUBLISHABLE_KEY; // The API key
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  console.log('Checking send_queue...');
  const { data, error } = await supabase
    .from('send_queue')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(5);
    
  if (error) console.error('Error:', error);
  else {
    data.forEach(q => {
      console.log(`[${q.created_at}] Status: ${q.status} | Type: ${q.message_type} | Error: ${q.error_message}`);
      if (q.message_type === 'template') {
        console.log('  Metadata:', JSON.stringify(q.metadata));
      }
    });
  }
}

check();
