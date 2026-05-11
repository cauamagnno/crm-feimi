import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { RefreshCw, AlertCircle, Clock, CheckCircle2, XCircle, Search, Filter } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface QueueItem {
  id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  contact_id: string;
  message_type: string;
  error_message: string | null;
  retry_count: number;
  scheduled_at: string | null;
  created_at: string;
  contact?: {
    name: string | null;
    phone_number: string | null;
  };
}

const QueueViewer: React.FC = () => {
  const [items, setItems] = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');
  const [search, setSearch] = useState('');

  const fetchQueue = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('send_queue')
        .select(`
          id, status, contact_id, message_type, error_message, retry_count, scheduled_at, created_at,
          contact:contacts(name, phone_number)
        `)
        .order('created_at', { ascending: false })
        .limit(100);

      if (filter !== 'all') {
        query = query.eq('status', filter);
      }

      const { data, error } = await query;
      if (error) throw error;
      
      // Transform the data since contact is returned as an array or object depending on relation
      const formattedData = (data || []).map(item => ({
        ...item,
        contact: Array.isArray(item.contact) ? item.contact[0] : item.contact
      })) as QueueItem[];
      
      setItems(formattedData);
    } catch (error) {
      console.error('Error fetching queue:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQueue();
    
    // Subscribe to realtime updates
    const subscription = supabase
      .channel('public:send_queue')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'send_queue' }, () => {
        fetchQueue();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, [filter]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle2 className="w-5 h-5 text-emerald-500" />;
      case 'failed': return <XCircle className="w-5 h-5 text-red-500" />;
      case 'processing': return <RefreshCw className="w-5 h-5 text-blue-500 animate-spin" />;
      default: return <Clock className="w-5 h-5 text-amber-500" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20';
      case 'failed': return 'bg-red-500/10 text-red-500 border-red-500/20';
      case 'processing': return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
      default: return 'bg-amber-500/10 text-amber-500 border-amber-500/20';
    }
  };

  const filteredItems = items.filter(item => {
    if (!search) return true;
    const searchLower = search.toLowerCase();
    const name = item.contact?.name?.toLowerCase() || '';
    const phone = item.contact?.phone_number?.toLowerCase() || '';
    return name.includes(searchLower) || phone.includes(searchLower) || (item.error_message?.toLowerCase() || '').includes(searchLower);
  });

  return (
    <div className="flex flex-col h-full bg-background">
      <div className="flex-none p-6 border-b border-border/50">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <RefreshCw className="w-6 h-6 text-primary" />
              Fila de Disparos
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Monitore em tempo real o status das mensagens enviadas pelo sistema.
            </p>
          </div>
          <button
            onClick={fetchQueue}
            className="flex items-center gap-2 px-4 py-2 bg-primary/10 text-primary hover:bg-primary/20 rounded-lg transition-colors font-medium text-sm"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </button>
        </div>

        <div className="mt-6 flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Buscar por nome, telefone ou erro..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-muted/30 border border-border/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm"
            />
          </div>
          <div className="flex items-center gap-2 min-w-[200px]">
            <Filter className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="w-full bg-muted/30 border border-border/50 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            >
              <option value="all">Todos os Status</option>
              <option value="pending">Aguardando (Fila)</option>
              <option value="processing">Processando</option>
              <option value="completed">Concluídos</option>
              <option value="failed">Falhas / Erros</option>
            </select>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6">
        {loading && items.length === 0 ? (
          <div className="flex justify-center items-center h-40">
            <RefreshCw className="w-8 h-8 text-primary animate-spin" />
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
            <AlertCircle className="w-12 h-12 mb-3 opacity-20" />
            <p>Nenhuma mensagem encontrada na fila com estes filtros.</p>
          </div>
        ) : (
          <div className="bg-card border border-border/50 rounded-xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-muted/50 text-muted-foreground text-xs uppercase font-medium">
                  <tr>
                    <th className="px-6 py-4 rounded-tl-xl">Status</th>
                    <th className="px-6 py-4">Contato</th>
                    <th className="px-6 py-4">Data / Hora</th>
                    <th className="px-6 py-4 rounded-tr-xl">Detalhes / Erro</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {filteredItems.map((item) => (
                    <tr key={item.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium ${getStatusBadge(item.status)}`}>
                          {getStatusIcon(item.status)}
                          <span className="capitalize">
                            {item.status === 'pending' ? 'Fila' : 
                             item.status === 'processing' ? 'Processando' : 
                             item.status === 'failed' ? 'Falha' : 'Concluído'}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-medium text-foreground">
                          {item.contact?.name || 'Desconhecido'}
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {item.contact?.phone_number || item.contact_id}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-foreground">
                          {format(new Date(item.created_at), "dd/MM 'às' HH:mm", { locale: ptBR })}
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {formatDistanceToNow(new Date(item.created_at), { addSuffix: true, locale: ptBR })}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {item.error_message ? (
                          <div className="flex flex-col gap-1">
                            <span className="text-red-500 font-medium text-xs break-words max-w-[300px]">
                              {item.error_message}
                            </span>
                            {item.retry_count > 0 && (
                              <span className="text-amber-500 text-xs">
                                Tentativas: {item.retry_count}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-xs">
                            {item.status === 'pending' && item.scheduled_at 
                              ? `Agendado para ${format(new Date(item.scheduled_at), 'HH:mm:ss')}` 
                              : 'Sem erros registrados'}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default QueueViewer;
