const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const envFile = fs.readFileSync('.env.production.local', 'utf-8');
const env = {};
for (const line of envFile.split('\n')) {
  if (line.includes('=')) {
    const [key, ...rest] = line.split('=');
    let val = rest.join('=').trim();
    if (val.startsWith('"') && val.endsWith('"')) { val = val.substring(1, val.length - 1); }
    env[key] = val;
  }
}

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_PUBLISHABLE_KEY);

async function check() {
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(10);
    
  if (error) console.error(error);
  else {
    console.log(`Found ${data.length} messages`);
    data.forEach(m => console.log(`[${m.created_at}] From: ${m.from_type} | Content: ${m.content} | Status: ${m.status}`));
  }
}
check();
