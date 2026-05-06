import React, { useState, useEffect } from 'react';
import { Route, Plus, Search, GitMerge, Clock, Play, Pause, MoreVertical, MessageSquare, Mail, Users, ArrowRight } from 'lucide-react';
import { Button } from './Button';
import { supabase } from '@/integrations/supabase/client';

interface JourneyData {
  id: string;
  name: string;
  trigger: string;
  steps: number;
  activeLeads: number;
  status: string;
}

const Journeys: React.FC = () => {
  const [journeys, setJourneys] = useState<JourneyData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchJourneys() {
      setLoading(true);
      try {
        const { data, error } = await supabase.from('journeys').select('*');
        if (data && !error) {
          setJourneys(data.map(j => ({
            id: j.id,
            name: j.name,
            trigger: j.trigger || 'Manual',
            steps: j.steps ? (Array.isArray(j.steps) ? j.steps.length : Object.keys(j.steps).length) : 0,
            activeLeads: 0, // Real implemention would fetch from journey_enrollments
            status: 'Ativo', // Mocked until status column exists
          })));
        }
      } catch (err) {
        console.error('Error fetching journeys:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchJourneys();
  }, []);

  return (
    <div className="h-full flex flex-col bg-background text-foreground p-6 overflow-hidden relative">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 gap-4 flex-shrink-0">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Route className="w-8 h-8 text-primary" /> Jornadas Automatizadas
          </h2>
          <p className="text-sm text-muted-foreground mt-1">Configure o fluxo de cadência de mensagens pós-ação do lead.</p>
        </div>
        <div className="flex gap-3 w-full sm:w-auto">
          <Button className="shadow-lg hover:scale-105 transition-transform">
            <Plus className="w-4 h-4 mr-2" />
            Nova Jornada
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        <div className="grid gap-6">
          {loading && (
            <div className="text-center p-8 text-muted-foreground border border-dashed border-border rounded-xl">
              Carregando jornadas do banco de dados...
            </div>
          )}
          {!loading && journeys.length === 0 && (
            <div className="text-center p-8 text-muted-foreground border border-dashed border-border rounded-xl">
              Nenhuma jornada automatizada encontrada. Clique em "Nova Jornada" para criar.
            </div>
          )}
          {journeys.map(journey => (
            <div key={journey.id} className="bg-card border border-border rounded-xl p-6 hover:shadow-lg transition-shadow">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="font-bold text-xl">{journey.name}</h3>
                    <span className={`px-2 py-0.5 text-xs font-bold uppercase rounded-md ${
                      journey.status === 'Ativo' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-muted text-muted-foreground'
                    }`}>
                      {journey.status}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span className="font-semibold text-foreground">Gatilho:</span> {journey.trigger}
                  </div>
                </div>
                <div className="flex items-center gap-4 text-right">
                  <div className="hidden sm:block">
                    <div className="text-2xl font-bold text-foreground">{journey.activeLeads.toLocaleString()}</div>
                    <div className="text-xs text-muted-foreground uppercase tracking-wider flex items-center gap-1 justify-end">
                      <Users className="w-3 h-3" /> Leads na Jornada
                    </div>
                  </div>
                  <Button variant="ghost" size="icon">
                    <MoreVertical className="w-5 h-5 text-muted-foreground" />
                  </Button>
                </div>
              </div>

              {/* Journey Steps Visualizer */}
              {journey.id === 1 && (
                <div className="bg-background/50 border border-border rounded-lg p-5 mt-4">
                  <h4 className="text-sm font-semibold mb-4 text-muted-foreground uppercase">Fluxo de Mensagens</h4>
                  <div className="flex items-center gap-4 overflow-x-auto pb-2">
                    {/* Step 1 */}
                    <div className="flex-shrink-0 w-48 bg-card border border-border rounded-lg p-3">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-[10px] font-bold text-primary uppercase bg-primary/10 px-2 py-0.5 rounded">Imediato</span>
                        <MessageSquare className="w-4 h-4 text-emerald-500" />
                      </div>
                      <p className="text-sm font-medium">Boas vindas WABA</p>
                    </div>
                    <ArrowRight className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                    
                    {/* Step 2 */}
                    <div className="flex-shrink-0 w-48 bg-card border border-border rounded-lg p-3">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-[10px] font-bold text-muted-foreground uppercase bg-muted px-2 py-0.5 rounded flex items-center gap-1"><Clock className="w-3 h-3"/> D+1</span>
                        <Mail className="w-4 h-4 text-blue-500" />
                      </div>
                      <p className="text-sm font-medium">Detalhes do Evento</p>
                    </div>
                    <ArrowRight className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                    
                    {/* Step 3 */}
                    <div className="flex-shrink-0 w-48 bg-card border border-border rounded-lg p-3">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-[10px] font-bold text-muted-foreground uppercase bg-muted px-2 py-0.5 rounded flex items-center gap-1"><Clock className="w-3 h-3"/> D+3</span>
                        <MessageSquare className="w-4 h-4 text-emerald-500" />
                      </div>
                      <p className="text-sm font-medium">Lembrete Credenciamento</p>
                    </div>
                    
                    {/* Add step button */}
                    <button className="flex-shrink-0 w-12 h-12 rounded-full border-2 border-dashed border-border flex items-center justify-center hover:border-primary hover:text-primary transition-colors text-muted-foreground ml-2">
                      <Plus className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Journeys;
