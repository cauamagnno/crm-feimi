import React, { useEffect, useState } from 'react';
import { Activity, DollarSign, MessageSquare, Users, Loader2, TrendingUp, TrendingDown, ArrowUpRight } from 'lucide-react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { StatMetric } from '../types';
import { api } from '../services/api';
import { OnboardingBanner } from './OnboardingBanner';
import { SystemHealthCard } from './SystemHealthCard';
import { useOutletContext } from 'react-router-dom';
import { useTheme } from '@/hooks/useTheme';

interface OutletContext {
  showOnboarding: boolean;
  setShowOnboarding: (show: boolean) => void;
}

type PeriodFilter = 'today' | '7days' | '30days';

const periodLabels: Record<PeriodFilter, string> = {
  today: 'Hoje',
  '7days': '7 Dias',
  '30days': '30 Dias'
};

const periodDays: Record<PeriodFilter, number> = {
  today: 1,
  '7days': 7,
  '30days': 30
};

const Dashboard: React.FC = () => {
  const [metrics, setMetrics] = useState<StatMetric[]>([]);
  const [chartData, setChartData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<PeriodFilter>('today');
  const { setShowOnboarding } = useOutletContext<OutletContext>();
  const { theme } = useTheme();

  const gridColor = theme === 'dark' ? '#27272a' : '#e4e4e7';
  const axisColor = theme === 'dark' ? '#71717a' : '#a1a1aa';
  const tooltipBg = theme === 'dark' ? '#18181b' : '#ffffff';
  const tooltipBorder = theme === 'dark' ? '#27272a' : '#e4e4e7';
  const tooltipTextColor = theme === 'dark' ? '#fafafa' : '#18181b';

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const days = periodDays[period];
        const [metricsData, chartDataResponse] = await Promise.all([
          api.fetchDashboardMetrics(days),
          api.fetchChartData(days)
        ]);
        setMetrics(metricsData);
        setChartData(chartDataResponse);
      } catch (error) {
        console.error("Erro ao carregar dashboard:", error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [period]);

  const getIcon = (label: string) => {
    if (label.includes('Conversões')) return <DollarSign className="h-5 w-5 text-foreground" />;
    if (label.includes('Atendimentos')) return <MessageSquare className="h-5 w-5 text-foreground" />;
    if (label.includes('Leads')) return <Users className="h-5 w-5 text-foreground" />;
    return <Activity className="h-5 w-5 text-foreground" />;
  };

  const getGradient = (_label: string) => {
    return 'from-muted/40 to-muted/10 border-border/50';
  };

  const getMetricLabel = (baseLabel: string) => {
    if (baseLabel.includes('Atendimentos')) {
      return period === 'today' ? 'Atendimentos Hoje' : `Atendimentos (${periodLabels[period]})`;
    }
    if (baseLabel.includes('Leads')) {
      return period === 'today' ? 'Novos Leads' : `Novos Leads (${periodLabels[period]})`;
    }
    return baseLabel;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
             <div className="absolute inset-0 bg-muted blur-xl rounded-full"></div>
             <Loader2 className="h-10 w-10 animate-spin text-muted-foreground relative z-10" />
          </div>
          <p className="text-sm text-muted-foreground font-medium animate-pulse">Carregando insights...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-8 overflow-y-auto h-full bg-background text-foreground custom-scrollbar">
      {/* Onboarding Banner */}
      <OnboardingBanner onOpenWizard={() => setShowOnboarding(true)} />

      {/* System Health Card */}
      <SystemHealthCard />

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-foreground">Dashboard</h2>
          <p className="text-muted-foreground mt-1">
            Visão geral da performance da sua IA {period === 'today' ? 'hoje' : `nos últimos ${periodLabels[period].toLowerCase()}`}.
          </p>
        </div>
        <div className="flex items-center gap-2 bg-card p-1 rounded-lg border border-border">
          {(['today', '7days', '30days'] as PeriodFilter[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                period === p
                  ? 'bg-muted text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-muted-foreground'
              }`}
            >
              {periodLabels[p]}
            </button>
          ))}
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {metrics.map((stat, index) => (
          <div 
            key={index} 
            className={`relative overflow-hidden rounded-2xl border bg-card/50 backdrop-blur-sm p-6 shadow-xl transition-all duration-300 hover:translate-y-[-2px] hover:bg-card group ${getGradient(stat.label)}`}
            style={{ animationDelay: `${index * 100}ms` }}
          >
            <div className="flex flex-row items-center justify-between space-y-0 pb-4">
              <div className="text-sm font-medium text-muted-foreground">{getMetricLabel(stat.label)}</div>
              <div className="p-2 rounded-lg bg-muted/50 border border-border/50 group-hover:border-slate-600 transition-colors">
                 {getIcon(stat.label)}
              </div>
            </div>
            <div className="flex items-end justify-between">
                <div className="text-3xl font-bold text-foreground tracking-tight">{stat.value}</div>
                <div className={`flex items-center text-xs font-medium px-2 py-1 rounded-full ${stat.trendUp ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
                    {stat.trendUp ? <TrendingUp className="w-3 h-3 mr-1" /> : <TrendingDown className="w-3 h-3 mr-1" />}
                    {stat.trend}
                </div>
            </div>
            {/* Decorative Glow */}
            <div className="absolute -bottom-10 -right-10 w-24 h-24 bg-muted/50 blur-2xl rounded-full group-hover:bg-muted/50 transition-all"></div>
          </div>
        ))}
      </div>

      {/* Charts Section */}
      <div className="grid gap-6 md:grid-cols-7">
        {/* Main Chart */}
        <div className="col-span-4 rounded-2xl border border-border bg-card/50 backdrop-blur-sm p-6 shadow-lg">
          <div className="mb-6 flex items-center justify-between">
            <div>
                <h3 className="text-lg font-semibold text-foreground">Volume de Atendimentos</h3>
                <p className="text-sm text-muted-foreground">
                  Interações da IA {period === 'today' ? 'hoje' : `nos últimos ${periodDays[period]} dias`}
                </p>
            </div>
            <button className="text-muted-foreground hover:text-foreground transition-colors p-2 hover:bg-muted rounded-lg">
                <ArrowUpRight className="w-5 h-5" />
            </button>
          </div>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorChats" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="currentColor" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="currentColor" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} strokeDasharray="3 3" stroke={gridColor} />
                <XAxis
                    dataKey="name"
                    axisLine={false}
                    tickLine={false}
                    tickMargin={10}
                    fontSize={12}
                    stroke={axisColor}
                />
                <YAxis
                    axisLine={false}
                    tickLine={false}
                    fontSize={12}
                    stroke={axisColor}
                />
                <Tooltip
                  contentStyle={{ backgroundColor: tooltipBg, borderRadius: '10px', border: `1px solid ${tooltipBorder}`, color: tooltipTextColor, boxShadow: '0 4px 20px rgba(0,0,0,0.15)' }}
                  itemStyle={{ color: "hsl(var(--foreground))" }}
                />
                <Area 
                  type="monotone" 
                  dataKey="chats" 
                  stroke="hsl(var(--foreground))" 
                  strokeWidth={3}
                  fillOpacity={1} 
                  fill="url(#colorChats)" 
                  activeDot={{ r: 6, strokeWidth: 0, fill: '#fff' }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Secondary Chart */}
        <div className="col-span-3 rounded-2xl border border-border bg-card/50 backdrop-blur-sm p-6 shadow-lg flex flex-col">
           <div className="mb-6">
            <h3 className="text-lg font-semibold text-foreground">Conversões</h3>
            <p className="text-sm text-muted-foreground">Reuniões, vendas e ações concluídas</p>
          </div>
          
          <div className="flex-1 flex flex-col justify-center space-y-5">
            {chartData.slice(0, 5).map((day, i) => (
              <div key={i} className="group">
                <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-muted-foreground">{day.name}</span>
                    <span className="text-sm font-bold text-foreground group-hover:text-foreground transition-colors">{day.sales} conv.</span>
                </div>
                <div className="h-2.5 bg-muted rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-foreground/60 to-foreground/40 rounded-full shadow-none transition-all duration-1000 ease-out " 
                    style={{ width: `${Math.min((day.sales / Math.max(...chartData.map(d => d.sales), 1)) * 100, 100)}%` }} 
                  />
                </div>
              </div>
            ))}
          </div>
          
          <div className="mt-6 pt-4 border-t border-border">
             <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Total no período</span>
                <span className="text-foreground font-bold">
                  {chartData.reduce((sum, d) => sum + d.sales, 0)} conversões
                </span>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;