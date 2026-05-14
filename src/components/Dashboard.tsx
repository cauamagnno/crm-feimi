import React, { useState, useEffect } from 'react';
import { Send, CheckCircle2, MailOpen, MousePointerClick, AlertCircle, ArrowUpRight, Calendar as CalendarIcon, Tag } from 'lucide-react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip as RechartsTooltip, XAxis, YAxis, Legend } from 'recharts';
import { useTheme } from '@/hooks/useTheme';
import { supabase } from '@/integrations/supabase/client';

type PeriodFilter = 'hoje' | '7dias' | '30dias' | 'todos';

interface CampaignData {
  id: string;
  name: string;
  channel: string;
  date: string;
  status: string;
  sent: number;
  delivered: number;
  opened: number;
  clicked: number;
}

const Dashboard: React.FC = () => {
  const { theme } = useTheme();
  const [period, setPeriod] = useState<PeriodFilter>('7dias');
  const [loading, setLoading] = useState(true);
  const [campaignsList, setCampaignsList] = useState<CampaignData[]>([]);
  const [totalLeads, setTotalLeads] = useState(0);
  const [totalMessages, setTotalMessages] = useState(0);
  const [queuedMessages, setQueuedMessages] = useState(0);
  const [failedMessages, setFailedMessages] = useState(0);
  const [utmSources, setUtmSources] = useState<{name: string, value: number}[]>([]);

  const gridColor = theme === 'dark' ? '#27272a' : '#e4e4e7';
  const axisColor = theme === 'dark' ? '#71717a' : '#a1a1aa';
  const tooltipBg = theme === 'dark' ? '#18181b' : '#ffffff';
  const tooltipBorder = theme === 'dark' ? '#27272a' : '#e4e4e7';
  const tooltipTextColor = theme === 'dark' ? '#fafafa' : '#18181b';

  useEffect(() => {
    async function fetchDashboardData() {
      setLoading(true);
      try {
        // Fetch campaigns
        const { data: camps, error: campError } = await supabase
          .from('campaigns')
          .select('*')
          .order('created_at', { ascending: false });

        if (camps && !campError) {
          setCampaignsList(camps.map(c => ({
            id: c.id,
            name: c.name,
            channel: c.channel === 'both' ? 'Ambos' : c.channel.toUpperCase(),
            date: c.created_at,
            status: c.status === 'draft' ? 'rascunho' : c.status === 'completed' ? 'concluída' : 'em andamento',
            sent: 0,
            delivered: 0,
            opened: 0,
            clicked: 0,
          })));
        }

        // Fetch Recent Contacts to aggregate UTM Sources using Edge Function
        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (session) {
            const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/temp-insert-queue`, {
              method: 'POST',
              headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session.access_token}`
              },
              body: JSON.stringify({ action: 'get_utm_stats' })
            });
            const result = await response.json();
            if (result.data) {
              setUtmSources(result.data);
            }
          }
        } catch (e) {
          console.error('Error fetching UTM stats:', e);
        }

        // Fetch Total Leads
        const { count: leadsCount } = await supabase
          .from('contacts')
          .select('*', { count: 'exact', head: true });
        if (leadsCount !== null) setTotalLeads(leadsCount);
        
        // Fetch Sent Messages
        const { count: msgCount } = await supabase
          .from('messages')
          .select('*', { count: 'exact', head: true });
        if (msgCount !== null) setTotalMessages(msgCount);

        // Fetch Queued Messages
        const { count: queuedCount } = await supabase
          .from('send_queue')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'pending');
        if (queuedCount !== null) setQueuedMessages(queuedCount);

        // Fetch Failed Messages
        const { count: failedCount } = await supabase
          .from('send_queue')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'failed');
        if (failedCount !== null) setFailedMessages(failedCount);

      } catch (err) {
        console.error('Error fetching dashboard data:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchDashboardData();
  }, [period]);

  const metrics = [
    { label: 'Total de Leads', value: totalLeads.toLocaleString(), icon: <CheckCircle2 className="w-5 h-5" />, trend: '', color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
    { label: 'Disparos Realizados', value: totalMessages.toLocaleString(), icon: <Send className="w-5 h-5" />, trend: '', color: 'text-blue-500', bg: 'bg-blue-500/10' },
    { label: 'Na Fila (Aguardando)', value: queuedMessages.toLocaleString(), icon: <CalendarIcon className="w-5 h-5" />, trend: '', color: 'text-purple-500', bg: 'bg-purple-500/10' },
    { label: 'Falhas/Erros', value: failedMessages.toLocaleString(), icon: <AlertCircle className="w-5 h-5" />, trend: '', color: 'text-red-500', bg: 'bg-red-500/10' },
  ];

  const timelineData = [
    { date: 'Seg', waba: 0, email: 0 },
    { date: 'Ter', waba: 0, email: 0 },
    { date: 'Qua', waba: 0, email: 0 },
    { date: 'Qui', waba: 0, email: 0 },
    { date: 'Sex', waba: 0, email: 0 },
    { date: 'Sáb', waba: 0, email: 0 },
    { date: 'Dom', waba: 0, email: 0 },
  ];

  const funnelData = [
    { stage: 'Total Leads', value: totalLeads },
    { stage: 'Disparados', value: totalMessages },
    { stage: 'Na Fila', value: queuedMessages },
    { stage: 'Falhas', value: failedMessages },
  ];

  return (
    <div className="p-6 space-y-8 overflow-y-auto h-full bg-background text-foreground custom-scrollbar">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-foreground">Dashboard de Disparos</h2>
          <p className="text-muted-foreground mt-1">Acompanhe a performance das suas campanhas WABA e Email.</p>
        </div>
        <div className="flex items-center gap-2 bg-card p-1 rounded-lg border border-border">
          {(['hoje', '7dias', '30dias', 'todos'] as PeriodFilter[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                period === p ? 'bg-primary/10 text-primary shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {p === 'hoje' ? 'Hoje' : p === '7dias' ? '7 Dias' : p === '30dias' ? '30 Dias' : 'Todos'}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-5">
        {metrics.map((metric, idx) => (
          <div key={idx} className="rounded-xl border border-border bg-card/50 backdrop-blur-sm p-5 shadow-sm hover:shadow-md transition-all">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-muted-foreground">{metric.label}</span>
              <div className={`p-2 rounded-lg ${metric.bg} ${metric.color}`}>
                {metric.icon}
              </div>
            </div>
            <div className="flex items-end justify-between">
              <h3 className="text-2xl font-bold tracking-tight">{metric.value}</h3>
              <span className={`text-xs font-semibold ${metric.label === 'Falhas/Erros' ? 'text-red-500' : 'text-emerald-500'}`}>
                {metric.trend}
              </span>
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-6 md:grid-cols-4">
        <div className="col-span-2 rounded-xl border border-border bg-card/50 backdrop-blur-sm p-6 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg font-semibold">Evolução de Disparos</h3>
              <p className="text-sm text-muted-foreground">WABA vs Email ao longo do tempo</p>
            </div>
          </div>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={timelineData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorWaba" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorEmail" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} strokeDasharray="3 3" stroke={gridColor} />
                <XAxis dataKey="date" axisLine={false} tickLine={false} tickMargin={10} fontSize={12} stroke={axisColor} />
                <YAxis axisLine={false} tickLine={false} fontSize={12} stroke={axisColor} />
                <RechartsTooltip contentStyle={{ backgroundColor: tooltipBg, borderRadius: '8px', border: `1px solid ${tooltipBorder}`, color: tooltipTextColor }} />
                <Legend />
                <Area type="monotone" dataKey="waba" name="WABA" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorWaba)" />
                <Area type="monotone" dataKey="email" name="Email" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorEmail)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="col-span-1 rounded-xl border border-border bg-card/50 backdrop-blur-sm p-6 shadow-sm flex flex-col">
          <div className="mb-6">
            <h3 className="text-lg font-semibold">Funil de Conversão</h3>
            <p className="text-sm text-muted-foreground">Taxa de engajamento geral</p>
          </div>
          <div className="flex-1 flex flex-col justify-center space-y-4">
            {funnelData.map((stage, idx) => {
              const max = funnelData[0].value || 1;
              const percentage = stage.value === 0 ? 0 : (stage.value / max) * 100;
              const prevValue = idx === 0 ? stage.value : funnelData[idx - 1].value;
              const dropOff = prevValue === 0 ? 0 : (stage.value / prevValue) * 100;
              
              return (
                <div key={idx} className="group relative">
                  <div className="flex justify-between text-sm mb-1">
                    <span className="font-medium text-foreground">{stage.stage}</span>
                    <span className="font-bold text-foreground">{stage.value.toLocaleString()}</span>
                  </div>
                  <div className="h-8 w-full bg-muted rounded-md overflow-hidden relative">
                    <div 
                      className="h-full bg-primary/80 transition-all duration-1000"
                      style={{ width: `${percentage}%` }}
                    />
                    {idx > 0 && stage.value > 0 && (
                      <div className="absolute right-2 top-1/2 -translate-y-1/2 text-xs font-semibold text-white/90 mix-blend-difference">
                        {dropOff.toFixed(1)}% do ant.
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="col-span-1 rounded-xl border border-border bg-card/50 backdrop-blur-sm p-6 shadow-sm flex flex-col">
          <div className="mb-6">
            <h3 className="text-lg font-semibold">Canais de Aquisição</h3>
            <p className="text-sm text-muted-foreground">Origem (UTM Source) dos Leads</p>
          </div>
          <div className="flex-1 flex flex-col justify-center items-center min-h-[250px] w-full">
            {utmSources.length > 0 ? (
              <div className="w-full flex flex-col gap-4">
                {utmSources.map((source, idx) => {
                  const total = utmSources.reduce((acc, curr) => acc + curr.value, 0) || 1;
                  const percentage = (source.value / total) * 100;
                  const colorMap: Record<string, string> = {
                    'Meta': 'bg-blue-500',
                    'Google': 'bg-emerald-500',
                    'TikTok': 'bg-purple-500',
                    'Outros/Orgânico': 'bg-amber-500'
                  };
                  const colorClass = colorMap[source.name] || 'bg-primary/80';
                  
                  return (
                    <div key={idx} className="group relative">
                      <div className="flex justify-between text-sm mb-1">
                        <span className="font-medium text-foreground">{source.name}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">{percentage.toFixed(1)}%</span>
                          <span className="font-bold text-foreground">{source.value.toLocaleString()}</span>
                        </div>
                      </div>
                      <div className="h-6 w-full bg-muted rounded-md overflow-hidden relative">
                        <div 
                          className={`h-full ${colorClass} transition-all duration-1000 opacity-90`}
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-sm text-muted-foreground flex flex-col items-center">
                <Tag className="w-8 h-8 mb-2 opacity-20" />
                Sem dados de UTM
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card/50 backdrop-blur-sm overflow-hidden shadow-sm">
        <div className="p-6 border-b border-border flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold">Campanhas Recentes</h3>
            <p className="text-sm text-muted-foreground">Acompanhamento detalhado por campanha</p>
          </div>
          <button className="flex items-center gap-2 text-sm font-medium text-primary hover:text-primary/80 transition-colors">
            Ver todas <ArrowUpRight className="w-4 h-4" />
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-muted-foreground uppercase bg-muted/30">
              <tr>
                <th className="px-6 py-4 font-semibold">Campanha</th>
                <th className="px-6 py-4 font-semibold">Canal</th>
                <th className="px-6 py-4 font-semibold">Status</th>
                <th className="px-6 py-4 font-semibold">Data</th>
                <th className="px-6 py-4 font-semibold text-right">Enviados</th>
                <th className="px-6 py-4 font-semibold text-right">Entregues</th>
                <th className="px-6 py-4 font-semibold text-right">Abertos</th>
                <th className="px-6 py-4 font-semibold text-right">Clicados</th>
                <th className="px-6 py-4 font-semibold text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {campaignsList.length === 0 && !loading && (
                <tr>
                  <td colSpan={9} className="px-6 py-8 text-center text-muted-foreground">
                    Nenhuma campanha registrada no banco de dados.
                  </td>
                </tr>
              )}
              {loading && (
                <tr>
                  <td colSpan={9} className="px-6 py-8 text-center text-muted-foreground">
                    Carregando dados...
                  </td>
                </tr>
              )}
              {campaignsList.map((camp) => (
                <tr key={camp.id} className="hover:bg-muted/20 transition-colors">
                  <td className="px-6 py-4 font-medium text-foreground">{camp.name}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded-md text-xs font-medium ${
                      camp.channel === 'WABA' ? 'bg-emerald-500/10 text-emerald-500' :
                      camp.channel === 'EMAIL' ? 'bg-blue-500/10 text-blue-500' :
                      'bg-purple-500/10 text-purple-500'
                    }`}>
                      {camp.channel}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`flex items-center gap-1.5 text-xs font-medium ${
                      camp.status === 'concluída' ? 'text-emerald-500' :
                      camp.status === 'em andamento' ? 'text-blue-500' :
                      'text-amber-500'
                    }`}>
                      <div className={`w-1.5 h-1.5 rounded-full ${
                        camp.status === 'concluída' ? 'bg-emerald-500' :
                        camp.status === 'em andamento' ? 'bg-blue-500 animate-pulse' :
                        'bg-amber-500'
                      }`} />
                      {camp.status.charAt(0).toUpperCase() + camp.status.slice(1)}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-muted-foreground">{new Date(camp.date).toLocaleDateString('pt-BR')}</td>
                  <td className="px-6 py-4 text-right font-medium">{camp.sent.toLocaleString()}</td>
                  <td className="px-6 py-4 text-right">{camp.delivered.toLocaleString()}</td>
                  <td className="px-6 py-4 text-right">{camp.opened.toLocaleString()}</td>
                  <td className="px-6 py-4 text-right">{camp.clicked.toLocaleString()}</td>
                  <td className="px-6 py-4 text-center">
                    <button className="text-muted-foreground hover:text-primary transition-colors">
                      Detalhes
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;