const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  "https://zrfdpiuwbbxjtahoxrhd.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpyZmRwaXV3YmJ4anRhaG94cmhkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc5NDgzNjAsImV4cCI6MjA5MzUyNDM2MH0.-c-8NIOVH5x_JgCN4DsQV7y2HThXQbOa2LxlEvBi-Zs"
);
async function run() {
  const { data, error } = await supabase
    .from('send_queue')
    .select('id, status, error, created_at, scheduled_at')
    .order('created_at', { ascending: false })
    .limit(10);
  console.log(data);
}
run();
