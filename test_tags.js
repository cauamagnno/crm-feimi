import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://zrfdpiuwbbxjtahoxrhd.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpyZmRwaXV3YmJ4anRhaG94cmhkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc5NDgzNjAsImV4cCI6MjA5MzUyNDM2MH0.-c-8NIOVH5x_JgCN4DsQV7y2HThXQbOa2LxlEvBi-Zs';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkTags() {
  const { data, error } = await supabase
    .from('contacts')
    .select('tags')
    .order('created_at', { ascending: false })
    .limit(20);
    
  if (error) console.error(error);
  else console.log(JSON.stringify(data, null, 2));
}

checkTags();
