import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Folder, FolderOpen, Search, Users, ChevronRight, User } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function BasePage() {
  const [activeFolder, setActiveFolder] = useState<string | null>(null);
  const [contacts, setContacts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');

  const folders = [
    { id: 'base_antiga', name: 'Base Antiga', tag: 'Base Antiga', count: 0 },
    { id: 'sao_luiz', name: 'Lead São Luiz', tag: 'convite_vip', count: 0 }
  ];

  const fetchContacts = async (tag: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('contacts')
        .select('*')
        .contains('tags', [tag])
        .ilike('name', `%${search}%`)
        .order('created_at', { ascending: false });
        
      if (error) throw error;
      setContacts(data || []);
    } catch (err) {
      console.error('Error fetching contacts for tag', tag, err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeFolder) {
      const folder = folders.find(f => f.id === activeFolder);
      if (folder) {
        fetchContacts(folder.tag);
      }
    }
  }, [activeFolder, search]);

  return (
    <div className="p-6 max-w-[1600px] mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Base de Leads (Pastas)</h1>
          <p className="text-muted-foreground mt-1">Organização de leads por tags e segmentação.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {/* Sidebar for Folders */}
        <div className="md:col-span-1 space-y-4">
          <div className="bg-card border rounded-xl overflow-hidden">
            <div className="p-4 border-b bg-muted/30">
              <h2 className="font-semibold text-sm">Pastas</h2>
            </div>
            <div className="p-2 space-y-1">
              {folders.map(folder => (
                <button
                  key={folder.id}
                  onClick={() => {
                    setActiveFolder(folder.id);
                    setSearch('');
                  }}
                  className={`w-full flex items-center justify-between p-3 rounded-lg text-sm font-medium transition-all ${
                    activeFolder === folder.id 
                      ? 'bg-primary/10 text-primary' 
                      : 'hover:bg-muted text-foreground'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {activeFolder === folder.id ? (
                      <FolderOpen className="w-4 h-4 text-primary" />
                    ) : (
                      <Folder className="w-4 h-4 text-muted-foreground" />
                    )}
                    {folder.name}
                  </div>
                  <ChevronRight className={`w-4 h-4 ${activeFolder === folder.id ? 'text-primary' : 'text-muted-foreground opacity-50'}`} />
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Content Area */}
        <div className="md:col-span-3">
          {activeFolder ? (
            <div className="bg-card border rounded-xl overflow-hidden min-h-[500px] flex flex-col">
              <div className="p-4 border-b flex items-center justify-between bg-muted/10">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                    <FolderOpen className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <h2 className="font-semibold">{folders.find(f => f.id === activeFolder)?.name}</h2>
                    <p className="text-xs text-muted-foreground">{contacts.length} contatos encontrados</p>
                  </div>
                </div>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="Buscar contato..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-9 pr-4 py-2 bg-background border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 w-[250px]"
                  />
                </div>
              </div>
              
              <div className="flex-1 overflow-auto p-4">
                {loading ? (
                  <div className="flex items-center justify-center h-full text-muted-foreground">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                  </div>
                ) : contacts.length > 0 ? (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <AnimatePresence>
                      {contacts.map((contact) => (
                        <motion.div
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          key={contact.id}
                          className="flex items-center gap-4 p-4 rounded-xl border bg-card hover:bg-muted/50 transition-colors cursor-pointer group"
                        >
                          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                            {contact.avatar_url ? (
                              <img src={contact.avatar_url} alt={contact.name} className="w-full h-full rounded-full object-cover" />
                            ) : (
                              <User className="w-5 h-5 text-primary" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-sm truncate">{contact.name || contact.phone_number || 'Sem Nome'}</h3>
                            <p className="text-xs text-muted-foreground truncate">{contact.phone_number}</p>
                          </div>
                          <div className="flex flex-wrap gap-1 justify-end">
                            {contact.tags?.slice(0, 2).map((tag: string) => (
                              <span key={tag} className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary whitespace-nowrap">
                                {tag}
                              </span>
                            ))}
                          </div>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-center space-y-3 py-12">
                    <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                      <Users className="w-6 h-6 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="font-medium text-foreground">Nenhum contato encontrado</p>
                      <p className="text-sm text-muted-foreground">Nenhum lead possui a tag desta pasta no momento.</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-card border rounded-xl min-h-[500px] flex flex-col items-center justify-center text-center p-8">
              <div className="w-16 h-16 rounded-full bg-primary/5 flex items-center justify-center mb-4">
                <Folder className="w-8 h-8 text-primary/40" />
              </div>
              <h2 className="text-xl font-semibold mb-2">Selecione uma pasta</h2>
              <p className="text-muted-foreground max-w-sm">
                Escolha uma das pastas na barra lateral para visualizar e gerenciar os contatos contidos nela.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
