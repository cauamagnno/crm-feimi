import React, { useState, useEffect } from 'react';
import { Plus, Search, Calendar, Megaphone, Users, MessageSquare, Mail, Play, Pause, MoreVertical, Settings2, Sparkles, Filter, Edit, Clock, ArrowRight } from 'lucide-react';
import { Button } from './Button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { supabase } from '@/integrations/supabase/client';
import { api } from '@/services/api';
import { toast } from 'sonner';

interface CampaignData {
  id: string;
  name: string;
  channel: string;
  status: string;
  date: string;
  audience: string;
  sent: number;
}

const Campaigns: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'all' | 'waba' | 'email'>('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [campaigns, setCampaigns] = useState<CampaignData[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [metaTemplates, setMetaTemplates] = useState<any[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);

  // Form State
  const [campaignName, setCampaignName] = useState('');
  const [campaignChannel, setCampaignChannel] = useState('waba');
  const [campaignAudience, setCampaignAudience] = useState('todos');
  const [campaignTemplate, setCampaignTemplate] = useState('');
  const [scheduleType, setScheduleType] = useState('now');
  const [scheduleDate, setScheduleDate] = useState('');
  const [scheduleTime, setScheduleTime] = useState('');

  const fetchCampaigns = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('campaigns')
        .select('*')
        .order('created_at', { ascending: false });

      if (data && !error) {
        setCampaigns(data.map(c => ({
          id: c.id,
          name: c.name,
          channel: c.channel === 'both' ? 'Ambos' : c.channel.toUpperCase(),
          status: c.status === 'draft' ? 'Rascunho' : c.status === 'completed' ? 'Concluída' : 'Em andamento',
          date: c.created_at,
          audience: c.segment_filter || 'Todos',
          sent: 0,
        })));
      }
    } catch (err) {
      console.error('Error fetching campaigns:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCampaigns();
  }, []);

  // Fetch templates when modal opens
  useEffect(() => {
    if (showCreateModal && metaTemplates.length === 0) {
      const loadTemplates = async () => {
        setLoadingTemplates(true);
        try {
          const templates = await api.fetchWhatsAppTemplates();
          setMetaTemplates(templates);
          if (templates.length > 0) {
            setCampaignTemplate(templates[0].name);
          }
        } catch (error) {
          console.error('Failed to load templates:', error);
          toast.error('Erro ao carregar templates do Meta. Verifique a configuração da API.');
        } finally {
          setLoadingTemplates(false);
        }
      };
      loadTemplates();
    }
  }, [showCreateModal]);

  const handleCreateCampaign = async () => {
    if (!campaignName) {
      toast.error('Preencha o nome da campanha.');
      return;
    }

    setIsSubmitting(true);
    try {
      let finalDate = undefined;
      let finalTime = undefined;
      
      if (scheduleType === 'tomorrow') {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        finalDate = tomorrow.toISOString().split('T')[0];
        finalTime = '09:00'; // Default time for tomorrow
      } else if (scheduleType === 'specific') {
        if (!scheduleDate || !scheduleTime) {
          toast.error('Preencha a data e horário do agendamento.');
          setIsSubmitting(false);
          return;
        }
        finalDate = scheduleDate;
        finalTime = scheduleTime;
      }

      await api.createCampaign({
        name: campaignName,
        channel: campaignChannel,
        audience: campaignAudience,
        templateName: campaignTemplate,
        date: finalDate,
        time: finalTime
      });
      
      toast.success(scheduleType === 'now' ? 'Campanha criada e disparos iniciados!' : 'Campanha agendada com sucesso!');
      setShowCreateModal(false);
      setCampaignName('');
      fetchCampaigns();
    } catch (error: any) {
      console.error('Error creating campaign:', error);
      toast.error('Erro ao criar campanha: ' + (error.message || 'Desconhecido'));
    } finally {
      setIsSubmitting(false);
    }
  };
      try {
        const { data, error } = await supabase
          .from('campaigns')
          .select('*')
          .order('created_at', { ascending: false });

        if (data && !error) {
          setCampaigns(data.map(c => ({
            id: c.id,
            name: c.name,
            channel: c.channel === 'both' ? 'Ambos' : c.channel.toUpperCase(),
            status: c.status === 'draft' ? 'Rascunho' : c.status === 'completed' ? 'Concluída' : 'Em andamento',
            date: c.created_at,
            audience: c.segment_filter || 'Todos',
            sent: 0,
          })));
        }
      } catch (err) {
        console.error('Error fetching campaigns:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchCampaigns();
  }, []);

  return (
    <div className="h-full flex flex-col bg-background text-foreground p-6 overflow-hidden relative">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 gap-4 flex-shrink-0">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Megaphone className="w-8 h-8 text-primary" /> Gestão de Campanhas
          </h2>
          <p className="text-sm text-muted-foreground mt-1">Crie e gerencie seus disparos em massa via WABA e Email.</p>
        </div>
        <div className="flex gap-3 w-full sm:w-auto">
          <Button className="shadow-lg hover:scale-105 transition-transform" onClick={() => setShowCreateModal(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Nova Campanha
          </Button>
        </div>
      </div>

      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2 bg-card p-1 rounded-lg border border-border">
          <button onClick={() => setActiveTab('all')} className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${activeTab === 'all' ? 'bg-primary/10 text-primary shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>Todas</button>
          <button onClick={() => setActiveTab('waba')} className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors flex items-center gap-1.5 ${activeTab === 'waba' ? 'bg-emerald-500/10 text-emerald-500 shadow-sm' : 'text-muted-foreground hover:text-emerald-500'}`}>
            <MessageSquare className="w-4 h-4" /> WABA
          </button>
          <button onClick={() => setActiveTab('email')} className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors flex items-center gap-1.5 ${activeTab === 'email' ? 'bg-blue-500/10 text-blue-500 shadow-sm' : 'text-muted-foreground hover:text-blue-500'}`}>
            <Mail className="w-4 h-4" /> Email
          </button>
        </div>
        <div className="flex gap-2">
           <div className="relative w-64">
             <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
             <input type="text" placeholder="Buscar campanha..." className="w-full pl-9 pr-4 py-2 bg-card border border-border rounded-lg text-sm outline-none focus:ring-1 focus:ring-primary/50" />
           </div>
           <Button variant="outline" size="icon" className="border-border">
             <Filter className="w-4 h-4 text-muted-foreground" />
           </Button>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        <div className="grid gap-4">
          {loading && (
            <div className="text-center p-8 text-muted-foreground border border-dashed border-border rounded-xl">
              Carregando campanhas do banco de dados...
            </div>
          )}
          {!loading && campaigns.length === 0 && (
            <div className="text-center p-8 text-muted-foreground border border-dashed border-border rounded-xl">
              Nenhuma campanha registrada. Clique em "Nova Campanha" para começar.
            </div>
          )}
          {campaigns.map(camp => (
            <div key={camp.id} className="group bg-card border border-border rounded-xl p-5 hover:border-primary/50 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-start gap-4 flex-1">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                  camp.channel === 'WABA' ? 'bg-emerald-500/10 text-emerald-500' :
                  camp.channel === 'EMAIL' ? 'bg-blue-500/10 text-blue-500' :
                  'bg-purple-500/10 text-purple-500'
                }`}>
                  {camp.channel === 'WABA' ? <MessageSquare className="w-6 h-6" /> :
                   camp.channel === 'EMAIL' ? <Mail className="w-6 h-6" /> :
                   <Megaphone className="w-6 h-6" />}
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-bold text-lg text-foreground">{camp.name}</h3>
                    <span className={`px-2 py-0.5 text-[10px] uppercase font-bold rounded-full ${
                      camp.status === 'Concluída' ? 'bg-emerald-500/20 text-emerald-500' :
                      camp.status === 'Em andamento' ? 'bg-blue-500/20 text-blue-500' :
                      camp.status === 'Agendada' ? 'bg-amber-500/20 text-amber-500' :
                      'bg-muted text-muted-foreground'
                    }`}>
                      {camp.status}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1.5"><Users className="w-4 h-4" /> {camp.audience}</span>
                    <span className="flex items-center gap-1.5"><Calendar className="w-4 h-4" /> {camp.date}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-6">
                <div className="text-right hidden sm:block">
                  <div className="text-sm font-semibold text-foreground">{camp.sent.toLocaleString()}</div>
                  <div className="text-xs text-muted-foreground uppercase tracking-wider">Disparos</div>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="icon" className="hover:text-primary transition-colors">
                    <Edit className="w-5 h-5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="hover:text-foreground transition-colors">
                    <MoreVertical className="w-5 h-5" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {showCreateModal && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto shadow-2xl flex flex-col">
            <div className="p-6 border-b border-border flex items-center justify-between sticky top-0 bg-card/95 backdrop-blur z-10">
              <div>
                <h2 className="text-xl font-bold text-foreground">Nova Campanha</h2>
                <p className="text-sm text-muted-foreground">Configure os detalhes do seu disparo.</p>
              </div>
              <button onClick={() => setShowCreateModal(false)} className="p-2 hover:bg-muted rounded-full text-muted-foreground transition-colors">
                 <MoreVertical className="w-5 h-5 opacity-0" />
                 <span className="absolute right-6 top-6 cursor-pointer text-muted-foreground hover:text-foreground" onClick={() => setShowCreateModal(false)}>✕</span>
              </button>
            </div>
            <div className="p-6 flex-1 space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-semibold">Nome da Campanha</label>
                  <input type="text" value={campaignName} onChange={e => setCampaignName(e.target.value)} className="w-full bg-background border border-border rounded-lg p-2.5 text-sm" placeholder="Ex: Convite VIP Lote 1" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold">Canal de Disparo</label>
                  <Select value={campaignChannel} onValueChange={setCampaignChannel}>
                    <SelectTrigger className="w-full border-border bg-background">
                      <SelectValue placeholder="Selecione o canal" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="waba">WhatsApp (WABA)</SelectItem>
                      <SelectItem value="email">Email</SelectItem>
                      <SelectItem value="both">Ambos (WABA + Email)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-semibold">Público / Segmentação</label>
                <Select value={campaignAudience} onValueChange={setCampaignAudience}>
                  <SelectTrigger className="w-full border-border bg-background">
                    <SelectValue placeholder="Selecione o público alvo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos os contatos</SelectItem>
                    <SelectItem value="vip">Apenas tag: VIP</SelectItem>
                    <SelectItem value="pipeline_qualificado">Pipeline: Qualificado</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-semibold">Quando enviar?</label>
                  <Select value={scheduleType} onValueChange={setScheduleType}>
                    <SelectTrigger className="w-full border-border bg-background">
                      <SelectValue placeholder="Selecione quando enviar" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="now">Enviar agora</SelectItem>
                      <SelectItem value="tomorrow">Enviar amanhã (09:00)</SelectItem>
                      <SelectItem value="specific">Selecionar data específica</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {scheduleType === 'specific' && (
                  <div className="grid grid-cols-2 gap-6 animate-in fade-in slide-in-from-top-2">
                     <div className="space-y-2">
                        <label className="text-sm font-semibold">Data do Disparo</label>
                        <div className="relative">
                          <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                          <input type="date" value={scheduleDate} onChange={e => setScheduleDate(e.target.value)} className="w-full bg-background border border-border rounded-lg p-2.5 pl-10 text-sm focus:ring-1 focus:ring-primary/50 outline-none" />
                        </div>
                     </div>
                     <div className="space-y-2">
                        <label className="text-sm font-semibold">Horário</label>
                        <div className="relative">
                          <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                          <input type="time" value={scheduleTime} onChange={e => setScheduleTime(e.target.value)} className="w-full bg-background border border-border rounded-lg p-2.5 pl-10 text-sm focus:ring-1 focus:ring-primary/50 outline-none" />
                        </div>
                     </div>
                  </div>
                )}
              </div>

              <div className="border-t border-border pt-6 mt-6">
                <h3 className="text-lg font-bold mb-4 flex items-center gap-2"><MessageSquare className="w-5 h-5 text-emerald-500" /> Conteúdo WhatsApp</h3>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-semibold">Template Aprovado (Meta)</label>
                    <Select value={campaignTemplate} onValueChange={setCampaignTemplate}>
                      <SelectTrigger className="w-full border-border bg-background">
                        <SelectValue placeholder={loadingTemplates ? "Carregando..." : "Selecione um template"} />
                      </SelectTrigger>
                      <SelectContent>
                        {metaTemplates.map((t, i) => (
                          <SelectItem key={`${t.name}-${i}`} value={t.name}>
                            {t.name} ({t.language})
                          </SelectItem>
                        ))}
                        {metaTemplates.length === 0 && !loadingTemplates && (
                          <SelectItem value="none" disabled>Nenhum template encontrado</SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  {campaignTemplate && (
                    <div className="bg-muted/30 border border-border rounded-lg p-4 font-mono text-sm text-muted-foreground relative">
                      <span className="absolute right-4 top-4 text-[10px] bg-emerald-500/20 text-emerald-500 px-2 py-0.5 rounded uppercase font-bold">Preview</span>
                      {(() => {
                        const t = metaTemplates.find(x => x.name === campaignTemplate);
                        if (!t) return <p>Selecione um template...</p>;
                        const bodyComponent = t.components?.find((c: any) => c.type === 'BODY');
                        return <p className="whitespace-pre-wrap">{bodyComponent?.text || 'Sem texto no corpo'}</p>;
                      })()}
                    </div>
                  )}
                  
                  <details className="mt-4 border border-border rounded-lg bg-card overflow-hidden">
                    <summary className="p-4 font-semibold text-sm cursor-pointer hover:bg-muted/30 transition-colors flex items-center justify-between">
                      <span>🛠️ Guia de Disparo — API Oficial Meta (JSON)</span>
                      <span className="text-xs text-muted-foreground">Ver exemplos</span>
                    </summary>
                    <div className="p-4 border-t border-border bg-muted/10 space-y-6 text-xs text-muted-foreground">
                      <div>
                        <h4 className="font-bold text-foreground mb-2">📌 Endpoint base</h4>
                        <pre className="p-2 bg-background border border-border rounded text-[10px] overflow-x-auto">
POST https://graph.facebook.com/v22.0/{'{PHONE_ID}'}/messages

Authorization: Bearer {'{TOKEN}'}
Content-Type: application/json</pre>
                      </div>

                      <div>
                        <h4 className="font-bold text-foreground mb-2">1️⃣ Template só com variável (texto)</h4>
                        <pre className="p-2 bg-background border border-border rounded text-[10px] overflow-x-auto">
{`{
  "messaging_product": "whatsapp",
  "recipient_type": "individual",
  "to": "5511999999999",
  "type": "template",
  "template": {
    "name": "nome_do_template",
    "language": { "code": "pt_BR" },
    "components": [
      {
        "type": "body",
        "parameters": [
          { "type": "text", "text": "Cauã" }
        ]
      }
    ]
  }
}`}</pre>
                      </div>

                      <div>
                        <h4 className="font-bold text-foreground mb-2">2️⃣ Template sem variável (texto fixo)</h4>
                        <pre className="p-2 bg-background border border-border rounded text-[10px] overflow-x-auto">
{`{
  "messaging_product": "whatsapp",
  "recipient_type": "individual",
  "to": "5511999999999",
  "type": "template",
  "template": {
    "name": "nome_do_template",
    "language": { "code": "pt_BR" }
  }
}`}</pre>
                      </div>

                      <div>
                        <h4 className="font-bold text-foreground mb-2">3️⃣ Template com imagem no header</h4>
                        <pre className="p-2 bg-background border border-border rounded text-[10px] overflow-x-auto">
{`{
  "messaging_product": "whatsapp",
  "recipient_type": "individual",
  "to": "5511999999999",
  "type": "template",
  "template": {
    "name": "nome_do_template",
    "language": { "code": "pt_BR" },
    "components": [
      {
        "type": "header",
        "parameters": [
          {
            "type": "image",
            "image": { "link": "https://seusite.com/imagem.jpg" }
          }
        ]
      },
      {
        "type": "body",
        "parameters": [
          { "type": "text", "text": "Cauã" }
        ]
      }
    ]
  }
}`}</pre>
                      </div>

                      <div>
                        <h4 className="font-bold text-foreground mb-2">4️⃣ Template com PDF/documento no header</h4>
                        <pre className="p-2 bg-background border border-border rounded text-[10px] overflow-x-auto">
{`{
  "messaging_product": "whatsapp",
  "recipient_type": "individual",
  "to": "5511999999999",
  "type": "template",
  "template": {
    "name": "nome_do_template",
    "language": { "code": "pt_BR" },
    "components": [
      {
        "type": "header",
        "parameters": [
          {
            "type": "document",
            "document": {
              "link": "https://seusite.com/arquivo.pdf",
              "filename": "Nome do Arquivo.pdf"
            }
          }
        ]
      },
      {
        "type": "body",
        "parameters": [
          { "type": "text", "text": "Cauã" }
        ]
      }
    ]
  }
}`}</pre>
                      </div>

                      <div className="bg-amber-500/10 border border-amber-500/20 p-3 rounded-lg text-amber-500/90">
                        <h4 className="font-bold mb-2 flex items-center gap-1">⚠️ Regras importantes</h4>
                        <ul className="list-disc list-inside space-y-1">
                          <li>Template precisa estar <strong>APPROVED</strong> antes de disparar.</li>
                          <li>Número de variáveis deve bater exatamente com as do template.</li>
                          <li>Imagem/PDF deve ser <strong>URL pública</strong>.</li>
                          <li>Formato do número: Sempre com DDI (ex: <code className="bg-background px-1 rounded">5511999999999</code>).</li>
                          <li>Limite de disparo: Começa em 1.000/dia, sobe conforme qualidade.</li>
                        </ul>
                      </div>
                    </div>
                  </details>
                </div>
              </div>

            </div>
            <div className="p-6 border-t border-border bg-muted/20 flex justify-end gap-3 sticky bottom-0">
              <Button variant="outline" className="border-border" onClick={() => setShowCreateModal(false)} disabled={isSubmitting}>Cancelar</Button>
              <Button className="bg-primary hover:bg-primary/90 text-primary-foreground" onClick={handleCreateCampaign} disabled={isSubmitting}>
                {isSubmitting ? 'Iniciando...' : 'Salvar e Disparar'} <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Campaigns;
