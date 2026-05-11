import React, { useEffect, useState, useRef } from 'react';
import { 
  Plus, Search, MoreHorizontal, DollarSign, Loader2, CalendarClock, Tag, X, 
  Building, User, Calendar, ArrowRight, CheckCircle2, Circle, 
  FileText, Phone, Mail, Paperclip, Send, CheckSquare, Clock, Trash2, Settings, Brain, MessageSquare, Bot
} from 'lucide-react';
import { Button } from './Button';
import { api } from '../services/api';
import { Deal, DealActivity, TeamMember, KanbanColumn } from '../types';
import { supabase } from '../integrations/supabase/client';
import { CreateDealModal } from './CreateDealModal';
import { LostReasonModal } from './LostReasonModal';
import { PipelineSettingsModal } from './PipelineSettingsModal';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { toast } from 'sonner';
import { useCompanySettings } from '@/hooks/useCompanySettings';

const Kanban: React.FC = () => {
  const { sdrName } = useCompanySettings();
  const [deals, setDeals] = useState<Deal[]>([]);
  const [stages, setStages] = useState<KanbanColumn[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDeal, setSelectedDeal] = useState<Deal | null>(null);
  const [activeTab, setActiveTab] = useState<'note' | 'activity' | 'email'>('note');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isLostModalOpen, setIsLostModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [activities, setActivities] = useState<DealActivity[]>([]);
  const [loadingActivities, setLoadingActivities] = useState(false);
  const [newActivityTitle, setNewActivityTitle] = useState('');
  const [newActivityDescription, setNewActivityDescription] = useState('');
  const [conversationMessages, setConversationMessages] = useState<any[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [newTag, setNewTag] = useState('');
  
  const dragItem = useRef<string | null>(null);
  
  const handleDealCreated = async () => {
    // Reload deals after creation
    const data = await api.fetchPipeline();
    setDeals(data);
  };

  useEffect(() => {
    const loadStages = async () => {
      try {
        const data = await api.fetchPipelineStages();
        setStages(data);
      } catch (error) {
        console.error("Erro ao carregar etapas", error);
      }
    };
    loadStages();

    const loadPipeline = async () => {
      try {
        const data = await api.fetchPipeline();
        setDeals(data);
      } catch (error) {
        console.error("Erro ao carregar pipeline", error);
      } finally {
        setLoading(false);
      }
    };
    loadPipeline();

    // Load team members
    const loadTeamMembers = async () => {
      try {
        const members = await api.fetchTeam();
        setTeamMembers(members);
      } catch (error) {
        console.error("Erro ao carregar membros da equipe", error);
      }
    };
    loadTeamMembers();

    // Real-time subscription for deals and stages
    const dealsChannel = supabase
      .channel('deals-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'deals'
        },
        async () => {
          const data = await api.fetchPipeline();
          setDeals(data);
        }
      )
      .subscribe();

    const stagesChannel = supabase
      .channel('pipeline-stages-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'pipeline_stages'
        },
        async () => {
          const data = await api.fetchPipelineStages();
          setStages(data);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(dealsChannel);
      supabase.removeChannel(stagesChannel);
    };
  }, []);

  // Load activities when deal is selected
  useEffect(() => {
    if (selectedDeal) {
      loadActivities();
    }
  }, [selectedDeal?.id]);

  // Load conversation messages when deal is selected
  useEffect(() => {
    if (selectedDeal?.conversationId) {
      loadConversationMessages();
    } else {
      setConversationMessages([]);
    }
  }, [selectedDeal?.conversationId]);

  const loadConversationMessages = async () => {
    if (!selectedDeal?.conversationId) return;
    setLoadingMessages(true);
    try {
      const messages = await api.fetchConversationMessages(selectedDeal.conversationId, 15);
      setConversationMessages(messages);
    } catch (error) {
      console.error("Erro ao carregar mensagens", error);
    } finally {
      setLoadingMessages(false);
    }
  };

  const loadActivities = async () => {
    if (!selectedDeal) return;
    setLoadingActivities(true);
    try {
      const data = await api.fetchDealActivities(selectedDeal.id);
      setActivities(data);
    } catch (error) {
      console.error("Erro ao carregar atividades", error);
    } finally {
      setLoadingActivities(false);
    }
  };

  const handleMarkWon = async () => {
    if (!selectedDeal) return;
    try {
      await api.markDealWon(selectedDeal.id);
      toast.success("Deal marcado como ganho! Parabéns pelo fechamento!");
      setSelectedDeal(null);
    } catch (error) {
      console.error("Erro ao marcar deal como ganho", error);
      toast.error("Não foi possível marcar como ganho");
    }
  };

  const handleMarkLost = async (reason: string) => {
    if (!selectedDeal) return;
    try {
      await api.markDealLost(selectedDeal.id, reason);
      toast.success("Deal marcado como perdido. Motivo registrado.");
      setSelectedDeal(null);
    } catch (error) {
      console.error("Erro ao marcar deal como perdido", error);
      toast.error("Não foi possível marcar como perdido");
    }
  };

  const handleOwnerChange = async (ownerId: string) => {
    if (!selectedDeal) return;
    try {
      await api.updateDealOwner(selectedDeal.id, ownerId);
      const member = teamMembers.find(m => m.id === ownerId);
      setSelectedDeal({ ...selectedDeal, ownerId, ownerName: member?.name });
      toast.success("Proprietário atualizado");
    } catch (error) {
      console.error("Erro ao atualizar proprietário", error);
      toast.error("Não foi possível atualizar proprietário");
    }
  };

  const handleCreateActivity = async () => {
    if (!selectedDeal || !newActivityTitle.trim()) return;
    try {
      await api.createDealActivity({
        dealId: selectedDeal.id,
        type: activeTab === 'activity' ? 'call' : activeTab === 'email' ? 'email' : 'note',
        title: newActivityTitle,
        description: newActivityDescription,
      });
      setNewActivityTitle('');
      setNewActivityDescription('');
      loadActivities();
      toast.success("Atividade criada");
    } catch (error) {
      console.error("Erro ao criar atividade", error);
      toast.error("Não foi possível criar atividade");
    }
  };

  const handleToggleActivityComplete = async (activityId: string, isCompleted: boolean) => {
    try {
      await api.updateDealActivity(activityId, { isCompleted: !isCompleted });
      loadActivities();
    } catch (error) {
      console.error("Erro ao atualizar atividade", error);
    }
  };

  const handleDeleteActivity = async (activityId: string) => {
    try {
      await api.deleteDealActivity(activityId);
      loadActivities();
      toast.success("Atividade excluída");
    } catch (error) {
      console.error("Erro ao excluir atividade", error);
    }
  };

  const handleAddTag = async () => {
    if (!selectedDeal || !newTag.trim()) return;
    const tag = newTag.trim();
    if (selectedDeal.tags.includes(tag)) {
      setNewTag('');
      return;
    }
    const updatedTags = [...selectedDeal.tags, tag];
    try {
      await api.updateDealTags(selectedDeal.id, updatedTags);
      setSelectedDeal({ ...selectedDeal, tags: updatedTags });
      setDeals(deals.map(d => d.id === selectedDeal.id ? { ...d, tags: updatedTags } : d));
      setNewTag('');
    } catch (error) {
      console.error("Erro ao adicionar tag", error);
      toast.error("Não foi possível adicionar tag");
    }
  };

  const handleRemoveTag = async (tag: string) => {
    if (!selectedDeal) return;
    const updatedTags = selectedDeal.tags.filter(t => t !== tag);
    try {
      await api.updateDealTags(selectedDeal.id, updatedTags);
      setSelectedDeal({ ...selectedDeal, tags: updatedTags });
      setDeals(deals.map(d => d.id === selectedDeal.id ? { ...d, tags: updatedTags } : d));
    } catch (error) {
      console.error("Erro ao remover tag", error);
      toast.error("Não foi possível remover tag");
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  const onDragStart = (e: React.DragEvent, dealId: string) => {
    dragItem.current = dealId;
    e.dataTransfer.effectAllowed = "move";
    (e.target as HTMLElement).style.opacity = '0.5';
  };

  const onDragEnd = (e: React.DragEvent) => {
    dragItem.current = null;
    (e.target as HTMLElement).style.opacity = '1';
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const onDrop = async (e: React.DragEvent, targetStageId: string) => {
    e.preventDefault();
    const dealId = dragItem.current;
    if (!dealId) return;

    // Optimistic update
    const updatedDeals = deals.map(deal => {
      if (deal.id === dealId) {
        return { ...deal, stageId: targetStageId };
      }
      return deal;
    });
    setDeals(updatedDeals);

    // Persist to database
    try {
      await api.moveDealStage(dealId, targetStageId);
    } catch (error) {
      console.error('Error moving deal:', error);
      // Revert on error
      const data = await api.fetchPipeline();
      setDeals(data);
    }
  };

  const filteredDeals = deals.filter(deal => 
    deal.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    deal.company.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getPriorityColor = (priority: string) => {
      switch(priority) {
          case 'high': return 'bg-destructive/10 text-red-400 border-destructive/30';
          case 'medium': return 'bg-muted/60 text-muted-foreground border-border';
          default: return 'bg-muted/60 text-foreground border-border';
      }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-foreground" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-background text-foreground p-6 overflow-hidden relative">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 gap-4 flex-shrink-0">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-foreground">Pipeline Comercial</h2>
          <p className="text-sm text-muted-foreground mt-1">Gerencie oportunidades e acompanhe o fluxo de receita.</p>
        </div>
        <div className="flex gap-3 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
             <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
             <input 
                type="text" 
                placeholder="Buscar oportunidade..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-card border border-border rounded-lg text-sm text-foreground focus:ring-1 focus:ring-ring outline-none placeholder:text-muted-foreground"
             />
          </div>
          <Button 
            variant="outline" 
            className="border-border text-muted-foreground hover:bg-muted"
            onClick={() => setIsSettingsModalOpen(true)}
          >
            <Settings className="w-4 h-4 mr-2" />
            Configurar
          </Button>
          <Button className="shadow-lg" onClick={() => setIsCreateModalOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Novo Deal
          </Button>
        </div>
      </div>

      {/* Board Scroll Container */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden pb-4">
        <div className="flex h-full gap-4 min-w-max">
          {stages.map((column) => {
            const columnDeals = filteredDeals.filter(d => d.stageId === column.id);
            const totalValue = columnDeals.reduce((acc, curr) => acc + curr.value, 0);
            const isWonColumn = column.title === 'Ganho';
            const isLostColumn = column.title === 'Perdido';

            return (
              <div 
                key={column.id}
                className={`w-72 flex flex-col h-full rounded-xl border backdrop-blur-sm ${
                  isWonColumn 
                    ? 'bg-muted/60 border-border' 
                    : isLostColumn 
                      ? 'bg-destructive/10 border-destructive/30' 
                      : 'bg-card/30 border-border/50'
                }`}
                onDragOver={onDragOver}
                onDrop={(e) => onDrop(e, column.id)}
              >
                {/* Column Header */}
                <div className={`p-3 border-b flex flex-col gap-1 rounded-t-xl ${
                  isWonColumn 
                    ? 'bg-muted/60 border-border border-t-4 border-t-emerald-500' 
                    : isLostColumn 
                      ? 'bg-destructive/10 border-destructive/30 border-t-4 border-t-red-500' 
                      : `border-border/50 border-t-2 ${column.color}`
                }`}>
                  <div className="flex justify-between items-center">
                    <h3 className={`font-bold text-xs uppercase tracking-wide flex items-center gap-1.5 ${
                      isWonColumn ? 'text-foreground' : isLostColumn ? 'text-red-300' : 'text-foreground'
                    }`}>
                      {column.isAiManaged && (
                        <span title="Gerenciado pela IA">
                          <Bot className="w-3 h-3 text-foreground" />
                        </span>
                      )}
                      {column.title}
                    </h3>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono ${
                      isWonColumn 
                        ? 'bg-muted/60 text-foreground' 
                        : isLostColumn 
                          ? 'bg-destructive/10 text-red-400' 
                          : 'bg-muted text-muted-foreground'
                    }`}>{columnDeals.length}</span>
                  </div>
                  <div className="text-[10px] text-muted-foreground font-medium">
                     Total: <span className={isWonColumn ? 'text-foreground' : isLostColumn ? 'text-red-300' : 'text-muted-foreground'}>{formatCurrency(totalValue)}</span>
                  </div>
                </div>

                {/* Column Body */}
                <div className="flex-1 overflow-y-auto p-2 space-y-2 custom-scrollbar">
                  {columnDeals.map((deal) => (
                    <div
                      key={deal.id}
                      draggable
                      onDragStart={(e) => onDragStart(e, deal.id)}
                      onDragEnd={onDragEnd}
                      onClick={() => setSelectedDeal(deal)}
                      className="bg-card border border-border rounded-lg p-3 shadow-sm cursor-grab active:cursor-grabbing hover:border-border hover:shadow-none transition-all group relative"
                    >
                      <div className="flex justify-between items-start mb-1.5">
                        <span className={`text-[9px] px-1.5 py-0.5 rounded border font-medium ${getPriorityColor(deal.priority)}`}>
                           {deal.priority === 'high' ? 'Alta' : deal.priority === 'medium' ? 'Média' : 'Baixa'}
                        </span>
                        <button className="text-muted-foreground hover:text-foreground transition-colors opacity-0 group-hover:opacity-100">
                           <MoreHorizontal className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <h4 className="font-semibold text-foreground text-sm mb-0.5 leading-tight">{deal.title}</h4>
                      <p className="text-[10px] text-muted-foreground mb-2">{deal.company}</p>

                      <div className="flex items-center gap-1.5 mb-2 flex-wrap">
                         {deal.tags.filter(tag => tag.startsWith('utm_source:')).slice(0, 1).map(tag => (
                             <span key={tag} className="text-[9px] text-emerald-500 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded flex items-center truncate max-w-[80px]" title={tag.split(':')[1]}>
                                Origem: {tag.split(':')[1]}
                             </span>
                         ))}
                         {deal.tags.filter(tag => tag.startsWith('utm_campaign:')).slice(0, 1).map(tag => (
                             <span key={tag} className="text-[9px] text-blue-500 bg-blue-500/10 border border-blue-500/20 px-1.5 py-0.5 rounded flex items-center truncate max-w-[100px]" title={tag.split(':')[1]}>
                                Campanha: {tag.split(':')[1]}
                             </span>
                         ))}
                         {deal.tags.filter(tag => !tag.startsWith('utm_')).slice(0, 2).map(tag => (
                             <span key={tag} className="text-[9px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded flex items-center gap-1 truncate max-w-[70px]">
                                <Tag className="w-2.5 h-2.5 flex-shrink-0" /> <span className="truncate">{tag}</span>
                             </span>
                         ))}
                         {deal.tags.filter(tag => !tag.startsWith('utm_')).length > 2 && (
                             <span className="text-[9px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                                +{deal.tags.filter(tag => !tag.startsWith('utm_')).length - 2}
                             </span>
                         )}
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-border">
                         <div className="flex items-center gap-1.5 text-muted-foreground text-xs font-bold">
                            <DollarSign className="w-3 h-3 text-foreground" />
                            {formatCurrency(deal.value)}
                         </div>
                         <div className="flex items-center gap-2">
                            {deal.dueDate && (
                                <div className="text-[9px] text-muted-foreground flex items-center gap-1" title="Data de previsão">
                                    <CalendarClock className="w-3 h-3" />
                                    {new Date(deal.dueDate).toLocaleDateString('pt-BR', {day: '2-digit', month: '2-digit'})}
                                </div>
                            )}
                            <img src={deal.ownerAvatar} alt="Owner" className="w-5 h-5 rounded-full border border-border" />
                         </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Pipedrive-style Side Drawer */}
      {/* Backdrop */}
      {selectedDeal && (
        <div 
            className="fixed inset-0 bg-background/80 backdrop-blur-sm backdrop-blur-sm z-40 transition-opacity"
            onClick={() => setSelectedDeal(null)}
        />
      )}

      {/* Drawer */}
      <div 
        className={`fixed top-0 right-0 h-full w-full max-w-2xl bg-background border-l border-border shadow-2xl z-50 transform transition-transform duration-300 ease-in-out flex flex-col ${selectedDeal ? 'translate-x-0' : 'translate-x-full'}`}
      >
        {selectedDeal && (
            <>
                {/* 1. Header & Stage Progress */}
                <div className="flex-shrink-0 bg-card border-b border-border">
                    {/* Top Bar */}
                    <div className="p-6 pb-4 flex justify-between items-start">
                        <div>
                            <h2 className="text-2xl font-bold text-foreground mb-1">{selectedDeal.title}</h2>
                            <div className="flex items-center gap-2 text-muted-foreground text-sm flex-wrap">
                                <span className="font-semibold text-foreground">{formatCurrency(selectedDeal.value)}</span>
                                <span className="w-1 h-1 rounded-full bg-muted/60"></span>
                                <span className="flex items-center gap-1"><Building className="w-3 h-3" /> {selectedDeal.company}</span>
                                <span className="w-1 h-1 rounded-full bg-muted/60"></span>
                                <Select value={selectedDeal.ownerId || ''} onValueChange={handleOwnerChange}>
                                  <SelectTrigger className="w-[180px] h-7 text-xs bg-muted border-border">
                                    <SelectValue placeholder="Selecione proprietário">
                                      <span className="flex items-center gap-1">
                                        <User className="w-3 h-3" /> 
                                        {selectedDeal.ownerName || 'Sem proprietário'}
                                      </span>
                                    </SelectValue>
                                  </SelectTrigger>
                                  <SelectContent>
                                    {teamMembers.map(member => (
                                      <SelectItem key={member.id} value={member.id}>
                                        {member.name}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <Button variant="secondary" onClick={handleMarkWon} className="bg-muted/60 hover:bg-muted/60 border-border text-foreground">
                              Ganho
                            </Button>
                            <Button variant="secondary" onClick={() => setIsLostModalOpen(true)} className="bg-destructive/10 hover:bg-destructive/10 border-destructive/30 text-red-400">
                              Perdido
                            </Button>
                            <button 
                                onClick={() => setSelectedDeal(null)} 
                                className="p-2 hover:bg-muted rounded-lg text-muted-foreground hover:text-foreground transition-colors"
                            >
                                <X className="w-6 h-6" />
                            </button>
                        </div>
                    </div>

                    {/* Pipeline Visual Progress */}
                    <div className="px-6 pb-6 overflow-x-auto">
                        <div className="flex items-center gap-1 w-full min-w-max">
                            {stages.map((col, idx) => {
                                const currentStageIndex = stages.findIndex(c => c.id === selectedDeal.stageId);
                                const isCompleted = idx < currentStageIndex;
                                const isActive = idx === currentStageIndex;
                                
                                return (
                                    <div 
                                        key={col.id} 
                                        className={`flex-1 h-8 flex items-center justify-center px-2 relative cursor-pointer group transition-all first:rounded-l-md last:rounded-r-md 
                                            ${isCompleted ? 'bg-muted/60 text-foreground hover:bg-muted/60' : 
                                              isActive ? 'bg-primary text-foreground shadow-lg' : 
                                              'bg-muted text-muted-foreground hover:bg-accent hover:text-muted-foreground'}
                                        `}
                                        onClick={async () => {
                                            const isGanhoColumn = col.title === 'Ganho';
                                            const isPerdidoColumn = col.title === 'Perdido';
                                            
                                            if (isGanhoColumn) {
                                                try {
                                                    await api.markDealWon(selectedDeal.id);
                                                    toast.success("Deal marcado como ganho!");
                                                    // Update local state
                                                    setDeals(deals.map(d => d.id === selectedDeal.id ? {...d, stageId: col.id, wonAt: new Date().toISOString()} : d));
                                                    setSelectedDeal({...selectedDeal, stageId: col.id});
                                                } catch (error) {
                                                    console.error('Error marking deal as won:', error);
                                                    toast.error("Erro ao marcar como ganho");
                                                }
                                            } else if (isPerdidoColumn) {
                                                setIsLostModalOpen(true);
                                            } else {
                                                // Optimistic update for UI feel
                                                setDeals(deals.map(d => d.id === selectedDeal.id ? {...d, stageId: col.id} : d));
                                                setSelectedDeal({...selectedDeal, stageId: col.id});
                                                
                                                // Persist to database
                                                try {
                                                    await api.moveDealStage(selectedDeal.id, col.id);
                                                } catch (error) {
                                                    console.error('Error moving deal:', error);
                                                }
                                            }
                                        }}
                                    >
                                        <span className="text-xs font-bold whitespace-nowrap z-10">{col.title}</span>
                                        {/* Arrow shape via clip-path could go here, simplified with simple blocks for now */}
                                        {idx !== stages.length - 1 && (
                                            <div className="absolute right-0 top-0 bottom-0 w-[1px] bg-background/20 z-20"></div>
                                        )}
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                </div>

                {/* 2. Content Area */}
                <div className="flex-1 overflow-y-auto bg-background custom-scrollbar">

                    {/* Tags Section */}
                    <div className="p-4 border-b border-border bg-card/20">
                        <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-2">
                            <Tag className="w-3.5 h-3.5" /> Tags
                        </h4>
                        <div className="flex flex-col gap-2 mb-3">
                            <div className="flex flex-wrap gap-1.5">
                                {selectedDeal.tags.filter(t => t.startsWith('utm_')).map(tag => {
                                    const [key, val] = tag.split(':');
                                    let color = "text-blue-400 bg-blue-500/10 border-blue-500/20";
                                    if (key === 'utm_source') color = "text-emerald-400 bg-emerald-500/10 border-emerald-500/20";
                                    
                                    return (
                                        <span key={tag} className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-md border ${color}`}>
                                            <span className="font-semibold opacity-70">{key}:</span> {val}
                                            <button onClick={() => handleRemoveTag(tag)} className="hover:text-red-400 transition-colors ml-0.5">
                                                <X className="w-3 h-3" />
                                            </button>
                                        </span>
                                    );
                                })}
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                                {selectedDeal.tags.filter(t => !t.startsWith('utm_')).map(tag => (
                                    <span key={tag} className="flex items-center gap-1 text-xs bg-muted text-foreground px-2 py-0.5 rounded-full border border-border">
                                        {tag}
                                        <button onClick={() => handleRemoveTag(tag)} className="hover:text-red-400 transition-colors ml-0.5">
                                            <X className="w-3 h-3" />
                                        </button>
                                    </span>
                                ))}
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={newTag}
                                onChange={(e) => setNewTag(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleAddTag()}
                                placeholder="Nova tag..."
                                className="flex-1 text-xs bg-card border border-border rounded-lg px-3 py-1.5 text-foreground placeholder:text-muted-foreground focus:ring-1 focus:ring-ring outline-none"
                            />
                            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={handleAddTag} disabled={!newTag.trim()}>
                                Adicionar
                            </Button>
                        </div>
                    </div>

                    {/* Action Composer */}
                    <div className="p-6 border-b border-border bg-card/30">
                        <div className="flex gap-4 mb-4">
                            <button 
                                onClick={() => setActiveTab('note')}
                                className={`flex items-center gap-2 text-sm font-medium transition-colors ${activeTab === 'note' ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                            >
                                <div className={`p-2 rounded-full ${activeTab === 'note' ? 'bg-muted/60' : 'bg-muted'}`}>
                                    <FileText className="w-4 h-4" />
                                </div>
                                Nota
                            </button>
                            <button 
                                onClick={() => setActiveTab('activity')}
                                className={`flex items-center gap-2 text-sm font-medium transition-colors ${activeTab === 'activity' ? 'text-muted-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                            >
                                <div className={`p-2 rounded-full ${activeTab === 'activity' ? 'bg-muted/60' : 'bg-muted'}`}>
                                    <Calendar className="w-4 h-4" />
                                </div>
                                Atividade
                            </button>
                            <button 
                                onClick={() => setActiveTab('email')}
                                className={`flex items-center gap-2 text-sm font-medium transition-colors ${activeTab === 'email' ? 'text-muted-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                            >
                                <div className={`p-2 rounded-full ${activeTab === 'email' ? 'bg-muted/60' : 'bg-muted'}`}>
                                    <Mail className="w-4 h-4" />
                                </div>
                                Email
                            </button>
                        </div>

                        <div className="bg-card border border-border rounded-xl overflow-hidden focus-within:ring-1 focus-within:ring-ring">
                            <input
                                type="text"
                                className="w-full bg-transparent p-3 text-sm text-foreground placeholder:text-muted-foreground outline-none border-b border-border"
                                placeholder="Título da atividade"
                                value={newActivityTitle}
                                onChange={(e) => setNewActivityTitle(e.target.value)}
                            />
                            <textarea 
                                className="w-full bg-transparent p-4 text-sm text-foreground placeholder:text-muted-foreground outline-none resize-none min-h-[80px]"
                                placeholder={
                                    activeTab === 'note' ? "Escreva uma nota..." :
                                    activeTab === 'activity' ? "Descreva a atividade..." :
                                    "Escreva o corpo do email..."
                                }
                                value={newActivityDescription}
                                onChange={(e) => setNewActivityDescription(e.target.value)}
                            />
                            <div className="px-3 py-2 bg-background/50 border-t border-border flex justify-between items-center">
                                <div className="flex gap-2">
                                    <button className="p-1.5 hover:bg-muted rounded text-muted-foreground hover:text-foreground transition-colors"><Paperclip className="w-4 h-4" /></button>
                                </div>
                                <Button size="sm" className="h-8" onClick={handleCreateActivity} disabled={!newActivityTitle.trim()}>
                                    Salvar
                                </Button>
                            </div>
                        </div>
                    </div>

                    {/* Activities Timeline */}
                    <div className="p-6">
                        <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-6 flex items-center gap-2">
                            <Clock className="w-3.5 h-3.5" /> Atividades ({activities.length})
                        </h4>
                        
                        {loadingActivities ? (
                          <div className="flex justify-center py-8">
                            <Loader2 className="w-6 h-6 animate-spin text-foreground" />
                          </div>
                        ) : activities.length === 0 ? (
                          <div className="text-center py-8 text-muted-foreground text-sm">
                            Nenhuma atividade registrada
                          </div>
                        ) : (
                          <div className="space-y-3">
                            {activities.map(activity => {
                              const activityIcon = activity.type === 'call' ? Phone :
                                                   activity.type === 'email' ? Mail :
                                                   activity.type === 'meeting' ? Calendar :
                                                   activity.type === 'task' ? CheckSquare :
                                                   FileText;
                              const activityColor = activity.type === 'call' ? 'text-muted-foreground bg-muted/60' :
                                                    activity.type === 'email' ? 'text-muted-foreground bg-muted/60' :
                                                    activity.type === 'meeting' ? 'text-foreground bg-muted/60' :
                                                    activity.type === 'task' ? 'text-foreground bg-muted/60' :
                                                    'text-muted-foreground bg-muted/60';
                              const ActivityIcon = activityIcon;
                              
                              return (
                                <div key={activity.id} className="flex items-start gap-3 p-3 rounded-xl bg-card/50 border border-border hover:border-border transition-all group">
                                  <button 
                                    onClick={() => handleToggleActivityComplete(activity.id, activity.isCompleted)}
                                    className="mt-0.5 text-muted-foreground hover:text-foreground transition-colors"
                                  >
                                    {activity.isCompleted ? (
                                      <CheckCircle2 className="w-5 h-5 text-foreground" />
                                    ) : (
                                      <Circle className="w-5 h-5" />
                                    )}
                                  </button>
                                  <div className={`p-1.5 rounded ${activityColor}`}>
                                    <ActivityIcon className="w-3.5 h-3.5" />
                                  </div>
                                  <div className="flex-1">
                                    <p className={`text-sm font-medium transition-colors ${activity.isCompleted ? 'text-muted-foreground line-through' : 'text-foreground group-hover:text-foreground'}`}>
                                      {activity.title}
                                    </p>
                                    {activity.description && (
                                      <p className="text-xs text-muted-foreground mt-1">{activity.description}</p>
                                    )}
                                    <p className="text-[10px] text-muted-foreground mt-1">
                                      {new Date(activity.createdAt).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                      {activity.createdByName && ` • ${activity.createdByName}`}
                                    </p>
                                  </div>
                                  <button 
                                    onClick={() => handleDeleteActivity(activity.id)}
                                    className="opacity-0 group-hover:opacity-100 p-1 hover:bg-destructive/10 rounded text-muted-foreground hover:text-red-500 transition-all"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        )}
                    </div>

                    {/* Nina Insights Section */}
                    {selectedDeal.clientMemory && (
                      <div className="p-6 border-t border-border">
                        <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-4 flex items-center gap-2">
                          <Brain className="w-4 h-4 text-muted-foreground" /> Insights do(a) {sdrName}
                        </h4>
                        
                        <div className="space-y-3">
                          {/* Qualification Score */}
                          <div className="p-3 rounded-lg bg-card/50 border border-border">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-xs text-muted-foreground">Score de Qualificação</span>
                              <span className="text-sm font-bold text-foreground">
                                {selectedDeal.clientMemory.lead_profile.qualification_score || 0}%
                              </span>
                            </div>
                            <div className="w-full bg-muted rounded-full h-1.5">
                              <div 
                                className="bg-gradient-to-r from-primary to-primary/80 h-1.5 rounded-full transition-all"
                                style={{ width: `${selectedDeal.clientMemory.lead_profile.qualification_score || 0}%` }}
                              />
                            </div>
                          </div>

                          {/* Next Best Action */}
                          <div className="p-3 rounded-lg bg-card/50 border border-border">
                            <span className="text-xs text-muted-foreground">Próxima Ação Sugerida</span>
                            <p className="text-sm text-foreground mt-1 font-medium">
                              {selectedDeal.clientMemory.sales_intelligence.next_best_action === 'qualify' ? '📋 Qualificar lead' :
                               selectedDeal.clientMemory.sales_intelligence.next_best_action === 'demo' ? '🎯 Agendar demonstração' :
                               selectedDeal.clientMemory.sales_intelligence.next_best_action === 'follow_up' ? '📞 Fazer follow-up' :
                               selectedDeal.clientMemory.sales_intelligence.next_best_action}
                            </p>
                          </div>

                          {/* Interests */}
                          {selectedDeal.clientMemory.lead_profile.interests.length > 0 && (
                            <div className="p-3 rounded-lg bg-card/50 border border-border">
                              <span className="text-xs text-muted-foreground">Interesses</span>
                              <div className="flex flex-wrap gap-1.5 mt-2">
                                {selectedDeal.clientMemory.lead_profile.interests.map((interest, idx) => (
                                  <span key={idx} className="px-2 py-0.5 bg-muted/60 text-foreground text-xs rounded-md border border-border">
                                    {interest}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Pain Points */}
                          {selectedDeal.clientMemory.sales_intelligence.pain_points.length > 0 && (
                            <div className="p-3 rounded-lg bg-card/50 border border-border">
                              <span className="text-xs text-muted-foreground">Dores Identificadas</span>
                              <div className="flex flex-wrap gap-1.5 mt-2">
                                {selectedDeal.clientMemory.sales_intelligence.pain_points.map((pain, idx) => (
                                  <span key={idx} className="px-2 py-0.5 bg-destructive/10 text-red-400 text-xs rounded-md border border-destructive/30">
                                    {pain}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Budget & Timeline */}
                          <div className="grid grid-cols-2 gap-3">
                            <div className="p-3 rounded-lg bg-card/50 border border-border">
                              <span className="text-xs text-muted-foreground">Orçamento</span>
                              <p className="text-sm text-foreground mt-1 font-medium">
                                💰 {selectedDeal.clientMemory.sales_intelligence.budget_indication === 'unknown' ? 'Não informado' : selectedDeal.clientMemory.sales_intelligence.budget_indication}
                              </p>
                            </div>
                            <div className="p-3 rounded-lg bg-card/50 border border-border">
                              <span className="text-xs text-muted-foreground">Timeline</span>
                              <p className="text-sm text-foreground mt-1 font-medium">
                                ⏰ {selectedDeal.clientMemory.sales_intelligence.decision_timeline === 'unknown' ? 'Não definido' : selectedDeal.clientMemory.sales_intelligence.decision_timeline}
                              </p>
                            </div>
                          </div>

                        </div>
                      </div>
                    )}

                    {/* Histórico de Conversa */}
                    {selectedDeal.conversationId && (
                      <div className="p-6 border-t border-border">
                        <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-4 flex items-center gap-2">
                          <MessageSquare className="w-4 h-4 text-foreground" /> 
                          Últimas Mensagens ({conversationMessages.length})
                        </h4>
                        
                        {loadingMessages ? (
                          <div className="flex justify-center py-4">
                            <Loader2 className="w-5 h-5 animate-spin text-foreground" />
                          </div>
                        ) : conversationMessages.length === 0 ? (
                          <div className="text-center py-4 text-muted-foreground text-sm">
                            Nenhuma mensagem encontrada
                          </div>
                        ) : (
                          <div className="space-y-2 max-h-64 overflow-y-auto custom-scrollbar">
                            {conversationMessages.map(msg => (
                              <div 
                                key={msg.id}
                                className={`p-2 rounded-lg text-sm ${
                                  msg.from_type === 'user' 
                                    ? 'bg-muted text-foreground ml-0 mr-8' 
                                    : msg.from_type === 'nina'
                                      ? 'bg-muted/60 text-foreground ml-8 mr-0'
                                      : 'bg-muted/60 text-foreground ml-8 mr-0'
                                }`}
                              >
                                <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground mb-1">
                                  <span className="font-medium">
                                    {msg.from_type === 'user' ? '👤 Lead' : msg.from_type === 'nina' ? `🤖 ${sdrName}` : '👨‍💼 Humano'}
                                  </span>
                                  <span>•</span>
                                  <span>{new Date(msg.sent_at).toLocaleString('pt-BR', { 
                                    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' 
                                  })}</span>
                                </div>
                                <p className="leading-relaxed line-clamp-3">{msg.content || '[mídia]'}</p>
                              </div>
                            ))}
                          </div>
                        )}
                        
                        <Button 
                          className="w-full mt-3 bg-primary hover:bg-primary"
                          onClick={() => window.location.href = `/chat?conversation=${selectedDeal.conversationId}`}
                        >
                          <MessageSquare className="w-4 h-4 mr-2" />
                          Ver Conversa Completa
                        </Button>
                      </div>
                    )}
                </div>
            </>
        )}
      </div>

      {/* Modal para criar novo deal */}
      <CreateDealModal
        open={isCreateModalOpen}
        onOpenChange={setIsCreateModalOpen}
        onDealCreated={handleDealCreated}
      />
      
      {/* Modal de motivo de perda */}
      <LostReasonModal
        open={isLostModalOpen}
        onOpenChange={setIsLostModalOpen}
        onConfirm={handleMarkLost}
        dealTitle={selectedDeal?.title || ''}
      />

      {/* Modal de configuração de etapas */}
      <PipelineSettingsModal 
        open={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
        onSave={async () => {
          const data = await api.fetchPipelineStages();
          setStages(data);
        }}
      />
    </div>
  );
};

export default Kanban;