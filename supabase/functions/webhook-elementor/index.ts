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

    // Elementor costuma mandar os campos com IDs aleatórios (ex: form_fields[field_1234])
    // Vamos usar heurística para encontrar telefone, email, nome e cidade
    let nome = '';
    let telefone = '';
    let email = '';
    let cidade = '';

    const allValues: {key: string, val: string}[] = [];
    
    for (const key in body) {
       if (key === 'form_fields' && typeof body[key] === 'object') {
          for (const nestedKey in body[key]) {
             allValues.push({ key: nestedKey.toLowerCase(), val: String(body[key][nestedKey]) });
          }
       } else {
          allValues.push({ key: key.toLowerCase(), val: String(body[key]) });
       }
    }

    // 1. Tentar por nome da chave
    for (const item of allValues) {
       const k = item.key;
       const v = item.val;
       
       if (!telefone && (k.includes('tel') || k.includes('phone') || k.includes('whatsapp') || k.includes('wpp'))) telefone = v;
       else if (!email && (k.includes('mail'))) email = v;
       else if (!nome && (k.includes('nome') || k.includes('name'))) nome = v;
       else if (!cidade && (k.includes('cid') || k.includes('city'))) cidade = v;
    }

    // 2. Fallbacks por conteúdo (caso a chave seja algo como field_b3191a2)
    for (const item of allValues) {
       const v = item.val;
       if (!telefone && /^[+\d\s\(\)\-]+$/.test(v) && v.replace(/\D/g,'').length >= 10) telefone = v;
       if (!email && v.includes('@') && v.includes('.')) email = v;
    }

    // 3. Fallback para nome se ainda não achou
    if (!nome) {
       for (const item of allValues) {
          const v = item.val;
          if (v !== telefone && v !== email && !v.includes('http') && v.length > 2 && v.length < 50) {
             nome = v;
             break;
          }
       }
    }

    if (!telefone) {
      // Insere um lead de debug para vermos o erro
      await supabaseClient.from('contacts').insert({
        phone_number: '5511000' + Math.floor(Math.random() * 100000),
        name: 'ERRO WEBHOOK: ' + JSON.stringify(body).substring(0, 100)
      });
      throw new Error('O campo telefone é obrigatório ou não foi identificado.');
    }

    // 1. Limpar e formatar o telefone para o padrão 5511999999999
    let formattedPhone = telefone.replace(/\D/g, '');
    if (formattedPhone.length === 10 || formattedPhone.length === 11) {
      formattedPhone = `55${formattedPhone}`;
    }

    // Extrair apenas o primeiro nome
    const firstName = nome ? nome.split(' ')[0] : 'Convidado';

    // Fetch existing contact to preserve tags
    const { data: existingContact } = await supabaseClient
      .from('contacts')
      .select('id, tags')
      .eq('phone_number', formattedPhone)
      .maybeSingle();
      
    let tags = existingContact?.tags || [];

    // Capture UTM parameters and save them as tags (e.g. "utm_source:facebook")
    const utms = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'];
    utms.forEach(utm => {
      let utmVal = '';
      for (const item of allValues) {
        if (item.key === utm) { utmVal = item.val; break; }
      }
      if (utmVal) {
        const utmTag = `${utm}:${utmVal}`;
        if (!tags.includes(utmTag)) {
          tags.push(utmTag);
        }
      }
    });

    // Upsert (Inserir ou Atualizar) o Contato no banco de dados
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

    await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/trigger-whatsapp-sender`, {
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
    
    // Tentativa de logar o erro no CRM se possivel
    try {
      const supabaseClient = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      );
      await supabaseClient.from('contacts').insert({
        phone_number: '5500000' + Math.floor(Math.random() * 1000000),
        name: 'ERRO: ' + error.message.substring(0, 100)
      });
    } catch(e){}

    // Retorna 200 OK para o Elementor parar de travar a tela do usuário
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
