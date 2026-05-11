import { createClient } from '@supabase/supabase-js';

const supabaseUrl = "https://zrfdpiuwbbxjtahoxrhd.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpyZmRwaXV3YmJ4anRhaG94cmhkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc5NDgzNjAsImV4cCI6MjA5MzUyNDM2MH0.-c-8NIOVH5x_JgCN4DsQV7y2HThXQbOa2LxlEvBi-Zs";

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data, error } = await supabase.auth.resetPasswordForEmail(
    'dudasodre@hiveme.com.br',
    { redirectTo: 'https://crm-feimi.vercel.app/' }
  );
  console.log("Reset password email sent:", data, error);
}

run();
