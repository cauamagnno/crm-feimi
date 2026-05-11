import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// This is a trigger function that can be called by cron jobs or pg_net
// It simply calls the whatsapp-sender function
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method === 'GET') {
    try {
      const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2.39.0');
      const supabaseAdmin = createClient(
        Deno.env.get('SUPABASE_URL') || '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
      );
      
      const { count } = await supabaseAdmin
        .from('send_queue')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending');
        
      return new Response(JSON.stringify({ pending: count }), { headers: corsHeaders });
    } catch (e: any) {
      return new Response(e.message, { status: 500 });
    }
  }

  try {
    console.log('[Trigger] Starting WhatsApp sender trigger...');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    
    // Call the whatsapp-sender function asynchronously
    const promise = fetch(`${supabaseUrl}/functions/v1/whatsapp-sender`, {
      method: 'POST',
      headers: {
        'Authorization': req.headers.get('Authorization') || '',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({})
    }).catch(console.error);

    if (typeof EdgeRuntime !== 'undefined' && typeof EdgeRuntime.waitUntil === 'function') {
      EdgeRuntime.waitUntil(promise);
    }

    return new Response(JSON.stringify({ 
      triggered: true, 
      background: true 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('[Trigger] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
