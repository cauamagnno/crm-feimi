import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json();

    if (body.action === 'check_messages') {
      const { data } = await supabase.from('messages').select('*').order('created_at', { ascending: false }).limit(50);
      return new Response(JSON.stringify({ data }), { headers: corsHeaders });
    }

    if (body.action === 'test_template') {
      const { phone_number, name } = body;
      
      // 1. Get or create contact
      let { data: contact } = await supabase.from('contacts').select('id, phone_number, tags').eq('phone_number', phone_number).maybeSingle();
      if (!contact) {
        const { data: newContact } = await supabase.from('contacts').insert({ phone_number, whatsapp_id: phone_number, name, tags: ['Base Antiga'] }).select().single();
        contact = newContact;
      }
      
      // 2. Get or create conversation
      let { data: conversation } = await supabase.from('conversations').select('id').eq('contact_id', contact.id).eq('is_active', true).maybeSingle();
      if (!conversation) {
        const { data: newConv } = await supabase.from('conversations').insert({ contact_id: contact.id, status: 'nina', is_active: true }).select().single();
        conversation = newConv;
      }

      // 3. Insert into send_queue
      const { data: queue, error: queueError } = await supabase.from('send_queue').insert({
        conversation_id: conversation.id,
        contact_id: contact.id,
        content: 'Template Convite VIP',
        from_type: 'campaign',
        message_type: 'template',
        status: 'pending',
        priority: 1,
        scheduled_at: new Date().toISOString(),
        metadata: {
          template: {
            name: "convite",
            language: { code: "en" },
            components: [
              {
                type: "header",
                parameters: [
                  {
                    type: "image",
                    image: { link: "https://zrfdpiuwbbxjtahoxrhd.supabase.co/storage/v1/object/public/imagens/lembrete.png" }
                  }
                ]
              },
              {
                type: "body",
                parameters: [
                  { type: "text", text: name || 'Convidado' },
                  { type: "text", text: "25 a 28 de julho, em São Paulo" }
                ]
              }
            ]
          }
        }
      }).select().single();

      if (queueError) throw queueError;

      // Call trigger-whatsapp-sender to send immediately
      fetch(`${supabaseUrl}/functions/v1/trigger-whatsapp-sender`, { method: 'POST', headers: { 'Authorization': `Bearer ${supabaseServiceKey}`, 'Content-Type': 'application/json' } }).catch(console.error);

      return new Response(JSON.stringify({ success: true, queue }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({ error: 'Unknown action' }), { status: 400, headers: corsHeaders });

  } catch (error) {
    console.error('Error:', error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
  }
});
