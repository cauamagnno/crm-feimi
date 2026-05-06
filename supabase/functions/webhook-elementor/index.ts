import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Parse the payload from Elementor
    const body = await req.json();
    console.log('Webhook payload recebido:', body);

    // Mapeie os nomes dos campos que o Elementor vai enviar (nome, telefone, email, cidade)
    const { nome, telefone, email, cidade } = body;

    if (!telefone) {
      throw new Error('O campo telefone é obrigatório.');
    }

    // 1. Limpar e formatar o telefone para o padrão 5511999999999
    let formattedPhone = telefone.replace(/\D/g, '');
    if (formattedPhone.length === 10 || formattedPhone.length === 11) {
      formattedPhone = `55${formattedPhone}`;
    }

    // Extrair apenas o primeiro nome
    const firstName = nome ? nome.split(' ')[0] : 'Convidado';

    // 2. Upsert (Inserir ou Atualizar) o Contato no banco de dados
    const { data: contact, error: contactError } = await supabaseClient
      .from('contacts')
      .upsert({
        phone_number: formattedPhone,
        whatsapp_id: formattedPhone,
        name: nome || 'Lead Elementor',
        email: email || null,
        city: cidade || null,
        status_convite: 'VIP Enviado', // Status de que o convite foi enviado
      }, { onConflict: 'phone_number' })
      .select('id')
      .single();

    if (contactError || !contact) {
      throw new Error(`Erro ao salvar contato: ${contactError?.message}`);
    }

    // 3. Obter ou criar a conversa (conversation) para associar a mensagem
    let conversationId = null;
    const { data: existingConv } = await supabaseClient
      .from('conversations')
      .select('id')
      .eq('contact_id', contact.id)
      .eq('channel', 'whatsapp')
      .single();

    if (existingConv) {
      conversationId = existingConv.id;
    } else {
      const { data: newConv } = await supabaseClient
        .from('conversations')
        .insert({
          contact_id: contact.id,
          channel: 'whatsapp',
          status: 'open'
        })
        .select('id')
        .single();
      if (newConv) conversationId = newConv.id;
    }

    // 4. Enfileirar o disparo do Template VIP (confirma) na tabela send_queue
    // IMPORTANTE: Ajuste o link da imagem se precisar.
    const mediaUrl = "https://zrfdpiuwbbxjtahoxrhd.supabase.co/storage/v1/object/public/imagens/convitevip.png";

    const queuePayload = {
      conversation_id: conversationId,
      contact_id: contact.id,
      content: `Template VIP de Boas Vindas`,
      from_type: 'human',
      message_type: 'template',
      priority: 1,
      status: 'pending',
      metadata: {
        template: {
          name: "confirma",
          language: { code: "pt_BR" },
          components: [
            {
              type: "header",
              parameters: [
                { type: "image", image: { link: mediaUrl } }
              ]
            },
            {
              type: "body",
              parameters: [
                { type: "text", text: firstName }
              ]
            }
          ]
        }
      }
    };

    const { error: queueError } = await supabaseClient
      .from('send_queue')
      .insert(queuePayload);

    if (queueError) {
      throw new Error(`Erro ao enfileirar mensagem: ${queueError.message}`);
    }

    return new Response(
      JSON.stringify({ success: true, message: 'Lead registrado e convite VIP programado para envio.' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Webhook error:', error.message);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
