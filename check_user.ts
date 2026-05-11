import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || "fallback";
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || "fallback";

import * as fs from 'fs';
const envFile = fs.readFileSync('.env', 'utf-8');
const urlMatch = envFile.match(/VITE_SUPABASE_URL=(.*)/);
const keyMatch = envFile.match(/VITE_SUPABASE_ANON_KEY=(.*)/);

const supabase = createClient(urlMatch[1], keyMatch[1]);

async function check() {
  const email = "dudasodre@hiveme.com.br";
  console.log("Checking team_members...");
  let { data, error } = await supabase.from('team_members').select('*').eq('email', email);
  console.log("Team members:", data, error);
}

check();
