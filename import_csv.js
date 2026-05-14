const fs = require('fs');
const { parse } = require('csv-parse/sync');
const { createClient } = require('@supabase/supabase-js');

// Parse .env.production.local manually
const envFile = fs.readFileSync('.env.production.local', 'utf-8');
const env = {};
for (const line of envFile.split('\n')) {
  if (line.includes('=')) {
    const [key, ...rest] = line.split('=');
    let val = rest.join('=').trim();
    if (val.startsWith('"') && val.endsWith('"')) {
      val = val.substring(1, val.length - 1);
    }
    env[key] = val;
  }
}

const supabaseUrl = env.VITE_SUPABASE_URL;
const supabaseKey = env.VITE_SUPABASE_PUBLISHABLE_KEY; // The API key
const supabase = createClient(supabaseUrl, supabaseKey);

const CSV_FILE = '../FEIMI - Base de Leads RD (sem edição alto inverno) - Página1.csv';
const SCHEDULED_AT = '2026-05-14T08:00:00-03:00';

async function main() {
  console.log('Reading CSV...');
  const fileContent = fs.readFileSync(CSV_FILE, 'utf-8');
  const records = parse(fileContent, { columns: true, skip_empty_lines: true });
  
  console.log(`Found ${records.length} total rows.`);

  const leads = [];
  for (const row of records) {
    const rawPhone = row['Celular'] || row['Telefone'];
    if (!rawPhone) continue;
    
    const phone = rawPhone.replace(/[^0-9]/g, '');
    if (phone.length < 10) continue;
    
    // Validate / format phone
    let finalPhone = phone;
    if (finalPhone.length === 10 || finalPhone.length === 11) {
      finalPhone = '55' + finalPhone; // Assuming BR numbers missing country code
    }
    
    leads.push({
      name: row['Nome'] || '',
      phone: finalPhone,
      email: row['Email'] || ''
    });
  }
  
  console.log(`Extracted ${leads.length} valid leads with phone numbers.`);
  
  const CHUNK_SIZE = 500;
  for (let i = 0; i < leads.length; i += CHUNK_SIZE) {
    const chunk = leads.slice(i, i + CHUNK_SIZE);
    console.log(`Processing chunk ${Math.floor(i / CHUNK_SIZE) + 1} of ${Math.ceil(leads.length / CHUNK_SIZE)}...`);

    // 1. Get or Create Contacts
    const { data: existingContacts, error: contactError } = await supabase
      .from('contacts')
      .upsert(chunk.map(c => ({
        phone_number: c.phone,
        whatsapp_id: c.phone,
        name: c.name,
        tags: ['Base Antiga'],
        client_memory: { source: 'Importação RD', email: c.email }
      })), { onConflict: 'phone_number' })
      .select('id, phone_number');

    if (contactError) {
      console.error('Error inserting contacts:', contactError);
      continue;
    }

    const contactMap = {};
    existingContacts.forEach(c => contactMap[c.phone_number] = c.id);

    // 2. Insert Conversations (one per contact)
    const convData = existingContacts.map(c => ({
      contact_id: c.id,
      status: 'nina',
      is_active: true
    }));
    
    const { data: newConvs, error: convError } = await supabase
      .from('conversations')
      .insert(convData)
      .select('id, contact_id');

    if (convError) {
      console.error('Error inserting conversations:', convError);
      continue;
    }

    // 3. Insert into send_queue
    const queueData = newConvs.map(conv => {
      const contact = existingContacts.find(c => c.id === conv.contact_id);
      const leadInfo = chunk.find(l => l.phone === contact.phone_number);
      return {
        conversation_id: conv.id,
        contact_id: contact.id,
        content: 'Template Convite VIP',
        from_type: 'campaign',
        message_type: 'template',
        status: 'pending',
        priority: 1,
        scheduled_at: SCHEDULED_AT,
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
                  { type: "text", text: leadInfo.name || 'Convidado' },
                  { type: "text", text: "25 a 28 de julho, em São Paulo" }
                ]
              }
            ]
          }
        }
      };
    });

    const { error: queueError } = await supabase.from('send_queue').insert(queueData);
    if (queueError) {
      console.error('Error inserting into send_queue:', queueError);
    } else {
      console.log(`Successfully queued ${queueData.length} messages.`);
    }
  }

  console.log('Import completed!');
}

main().catch(console.error);
