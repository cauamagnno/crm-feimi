import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), { status: 401, headers: corsHeaders });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get user from token
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), { status: 401, headers: corsHeaders });
    }

    // Get user settings
    const { data: settings } = await supabase
      .from('nina_settings')
      .select('whatsapp_access_token, whatsapp_waba_id, whatsapp_phone_number_id')
      .eq('user_id', user.id)
      .maybeSingle();

    let finalSettings = settings;

    // Fallback to global if needed
    if (!finalSettings || !finalSettings.whatsapp_waba_id || !finalSettings.whatsapp_access_token) {
      const { data: globalSettings } = await supabase
        .from('nina_settings')
        .select('whatsapp_access_token, whatsapp_waba_id, whatsapp_phone_number_id')
        .not('whatsapp_waba_id', 'is', null)
        .limit(1)
        .maybeSingle();
      finalSettings = globalSettings;
    }

    if (!finalSettings) {
      return new Response(JSON.stringify({ error: 'Configuração da NINA (nina_settings) não encontrada.' }), { status: 400, headers: corsHeaders });
    }
    
    if (!finalSettings.whatsapp_waba_id) {
      return new Response(JSON.stringify({ error: 'WhatsApp WABA ID não está configurado no painel.' }), { status: 400, headers: corsHeaders });
    }

    if (!finalSettings.whatsapp_access_token) {
      return new Response(JSON.stringify({ error: 'WhatsApp Access Token não está configurado no painel.' }), { status: 400, headers: corsHeaders });
    }

    // Fetch templates from Meta API
    const response = await fetch(`https://graph.facebook.com/v22.0/${finalSettings.whatsapp_waba_id}/message_templates`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${finalSettings.whatsapp_access_token}`,
        'Content-Type': 'application/json'
      }
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('[Templates] Meta API Error:', data);
      return new Response(JSON.stringify({ error: data.error?.message || 'Error fetching templates from Meta' }), { status: response.status, headers: corsHeaders });
    }

    // Filter only APPROVED templates
    const approvedTemplates = data.data?.filter((t: any) => t.status === 'APPROVED') || [];

    return new Response(JSON.stringify({ templates: approvedTemplates }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[Templates] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
