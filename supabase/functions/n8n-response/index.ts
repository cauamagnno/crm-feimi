import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-n8n-secret',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const body = await req.json();
    const { secret, conversation_id, response } = body;

    console.log('[n8n-response] Received callback for conversation:', conversation_id);

    // Validate secret (from body or header)
    const expectedSecret = Deno.env.get('N8N_SECRET') || 'crmmodelo2026';
    const headerSecret = req.headers.get('x-n8n-secret');
    if (secret !== expectedSecret && headerSecret !== expectedSecret) {
      console.error('[n8n-response] Invalid secret');
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (!conversation_id || !response) {
      return new Response(JSON.stringify({ error: 'Missing conversation_id or response' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Get conversation with contact info
    const { data: conversation, error: convError } = await supabase
      .from('conversations')
      .select('*, contacts(*)')
      .eq('id', conversation_id)
      .single();

    if (convError || !conversation) {
      console.error('[n8n-response] Conversation not found:', convError);
      return new Response(JSON.stringify({ error: 'Conversation not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Save AI response message to database
    const { data: message, error: msgError } = await supabase
      .from('messages')
      .insert({
        conversation_id,
        content: response,
        type: 'text',
        from_type: 'nina',
        status: 'sent',
        sent_at: new Date().toISOString()
      })
      .select()
      .single();

    if (msgError) {
      console.error('[n8n-response] Error saving message:', msgError);
      throw msgError;
    }

    console.log('[n8n-response] Message saved:', message.id);

    // Update conversation last_message_at
    await supabase
      .from('conversations')
      .update({ last_message_at: new Date().toISOString() })
      .eq('id', conversation_id);

    // Get WhatsApp settings
    const { data: settings } = await supabase
      .from('nina_settings')
      .select('whatsapp_phone_number_id, whatsapp_access_token')
      .limit(1)
      .maybeSingle();

    if (settings?.whatsapp_phone_number_id && conversation.contacts?.phone_number) {
      // Queue for WhatsApp sending
      const { error: queueError } = await supabase
        .from('send_queue')
        .insert({
          message_id: message.id,
          conversation_id,
          to_phone_number: conversation.contacts.phone_number,
          message_content: response,
          phone_number_id: settings.whatsapp_phone_number_id,
          status: 'pending'
        });

      if (queueError) {
        console.error('[n8n-response] Error queuing message:', queueError);
      } else {
        // Trigger WhatsApp sender (no-auth endpoint)
        fetch(`${supabaseUrl}/functions/v1/trigger-whatsapp-sender`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        }).catch(err => console.error('[n8n-response] Error triggering sender:', err));

        console.log('[n8n-response] Message queued for WhatsApp delivery');
      }
    } else {
      console.warn('[n8n-response] No WhatsApp settings found, message saved but not sent via WhatsApp');
    }

    return new Response(JSON.stringify({ success: true, message_id: message.id }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('[n8n-response] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
