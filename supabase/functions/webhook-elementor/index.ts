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

    // Parse the payload from Elementor (supports JSON or FormData)
    let body: any = {};
    const contentType = req.headers.get('content-type') || '';
    
    try {
      if (contentType.includes('application/json')) {
        body = await req.json();
      } else {
        const formData = await req.formData();
        body = Object.fromEntries(formData.entries());
      }
    } catch (e) {
      const text = await req.text();
      try { body = JSON.parse(text); } catch { body = {}; }
    }

    console.log('Webhook payload recebido bruto:', body);

    // Elementor costuma mandar os campos dentro de "form_fields" ou com nomes específicos.
    // Vamos buscar os valores independentemente de como vierem:
    const getValue = (keys: string[]) => {
      for (const key of keys) {
        if (body[key]) return body[key];
        if (body[`form_fields[${key}]`]) return body[`form_fields[${key}]`];
        // As vezes o Elementor envia o JSON aninhado
        if (body.form_fields && body.form_fields[key]) return body.form_fields[key];
      }
      return null;
    };

    const nome = getValue(['nome', 'name', 'Nome', 'Name', 'nome_completo']);
    const telefone = getValue(['telefone', 'phone', 'whatsapp', 'Telefone', 'Phone']);
    const email = getValue(['email', 'Email', 'e-mail']);
    const cidade = getValue(['cidade', 'city', 'Cidade']);

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

    // 2. Fetch existing contact to preserve tags
    const { data: existingContact } = await supabaseClient
      .from('contacts')
      .select('id, tags')
      .eq('phone_number', formattedPhone)
      .maybeSingle();
      
    let tags = existingContact?.tags || [];
    if (!tags.includes('convite_vip')) {
      tags.push('convite_vip');
    }

    // 3. Upsert (Inserir ou Atualizar) o Contato no banco de dados
    const { data: contact, error: contactError } = await supabaseClient
      .from('contacts')
      .upsert({
        phone_number: formattedPhone,
        whatsapp_id: formattedPhone,
        name: nome || 'Lead Elementor',
        email: email || null,
        city: cidade || null,
        status_convite: 'VIP Enviado',
        tags: tags
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
      .single();

    if (existingConv) {
      conversationId = existingConv.id;
    } else {
      const { data: newConv, error: convError } = await supabaseClient
        .from('conversations')
        .insert({
          contact_id: contact.id,
          status: 'nina'
        })
        .select('id')
        .single();
        
      if (convError) throw new Error(`Erro ao criar conversa: ${convError.message}`);
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

    // 5. Trigger the whatsapp-sender to process the queue immediately
    fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/trigger-whatsapp-sender`, {
      method: 'POST',
      headers: { 
        'Authorization': `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}`,
        'Content-Type': 'application/json' 
      }
    }).catch(err => console.error('[Webhook] Failed to trigger whatsapp-sender:', err));

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
