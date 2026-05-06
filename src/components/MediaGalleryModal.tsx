import React, { useState, useEffect, useRef } from 'react';
import { X, Upload, Copy, Image as ImageIcon, Loader2, Check } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface MediaGalleryModalProps {
  onClose: () => void;
  onSelect?: (url: string) => void;
}

interface MediaItem {
  name: string;
  url: string;
  created_at: string;
}

export const MediaGalleryModal: React.FC<MediaGalleryModalProps> = ({ onClose, onSelect }) => {
  const [images, setImages] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchImages = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .storage
        .from('imagens')
        .list('', {
          sortBy: { column: 'created_at', order: 'desc' }
        });

      if (error) throw error;

      if (data) {
        const imageItems = data
          .filter(item => item.name !== '.emptyFolderPlaceholder')
          .map(item => {
            const { data: publicUrlData } = supabase
              .storage
              .from('imagens')
              .getPublicUrl(item.name);
              
            return {
              name: item.name,
              url: publicUrlData.publicUrl,
              created_at: item.created_at
            };
          });
        setImages(imageItems);
      }
    } catch (error: any) {
      console.error('Error fetching images:', error);
      toast.error('Erro ao carregar galeria: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchImages();
  }, []);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Arquivo muito grande. O limite é 5MB.');
      return;
    }

    setUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `${fileName}`;

      const { error: uploadError } = await supabase
        .storage
        .from('imagens')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      toast.success('Imagem enviada com sucesso!');
      await fetchImages();
    } catch (error: any) {
      console.error('Error uploading image:', error);
      toast.error('Erro ao enviar imagem: ' + error.message);
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleCopyUrl = (url: string) => {
    navigator.clipboard.writeText(url);
    setCopiedUrl(url);
    toast.success('Link copiado!');
    setTimeout(() => setCopiedUrl(null), 2000);
  };

  const handleSelect = (url: string) => {
    if (onSelect) {
      onSelect(url);
      onClose();
    } else {
      handleCopyUrl(url);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-card w-full max-w-4xl rounded-2xl shadow-2xl flex flex-col max-h-[85vh] overflow-hidden border border-border animate-in zoom-in-95">
        <div className="p-6 border-b border-border flex justify-between items-center bg-muted/30">
          <div>
            <h2 className="text-xl font-bold flex items-center gap-2">
              <ImageIcon className="w-5 h-5 text-emerald-500" />
              Galeria de Imagens (Bucket: imagens)
            </h2>
            <p className="text-sm text-muted-foreground mt-1">Gerencie imagens para usar nas suas campanhas.</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-muted rounded-full transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 border-b border-border bg-background flex justify-between items-center">
          <input 
            type="file" 
            ref={fileInputRef}
            onChange={handleFileUpload}
            accept="image/*" 
            className="hidden" 
          />
          <button 
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="bg-primary text-primary-foreground px-4 py-2 rounded-lg font-medium flex items-center gap-2 hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            {uploading ? 'Enviando...' : 'Fazer Upload de Imagem'}
          </button>
          
          <div className="text-sm text-muted-foreground">
            {images.length} imagens armazenadas
          </div>
        </div>

        <div className="p-6 overflow-y-auto flex-1 bg-muted/10">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
              <Loader2 className="w-8 h-8 animate-spin mb-4" />
              <p>Carregando galeria...</p>
            </div>
          ) : images.length === 0 ? (
            <div className="text-center p-12 border border-dashed border-border rounded-xl bg-card">
              <ImageIcon className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
              <h3 className="font-bold text-lg mb-2">Nenhuma imagem encontrada</h3>
              <p className="text-muted-foreground mb-6">Você ainda não enviou nenhuma imagem para o bucket "imagens".</p>
              <button 
                onClick={() => fileInputRef.current?.click()}
                className="bg-primary/10 text-primary px-4 py-2 rounded-lg font-medium hover:bg-primary/20 transition-colors"
              >
                Fazer o primeiro upload
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {images.map((img) => (
                <div key={img.url} className="group relative bg-card border border-border rounded-xl overflow-hidden hover:border-primary/50 hover:shadow-md transition-all">
                  <div className="aspect-square bg-muted flex items-center justify-center overflow-hidden">
                    <img 
                      src={img.url} 
                      alt={img.name} 
                      className="w-full h-full object-cover transition-transform group-hover:scale-105"
                      loading="lazy"
                    />
                  </div>
                  
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2">
                    <button 
                      onClick={(e) => { e.stopPropagation(); handleSelect(img.url); }}
                      className="bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-bold shadow-lg hover:scale-105 transition-transform"
                    >
                      {onSelect ? 'Selecionar' : 'Copiar Link'}
                    </button>
                    
                    {onSelect && (
                      <button 
                        onClick={(e) => { e.stopPropagation(); handleCopyUrl(img.url); }}
                        className="bg-white/20 text-white backdrop-blur px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 hover:bg-white/30 transition-colors"
                      >
                        {copiedUrl === img.url ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                        {copiedUrl === img.url ? 'Copiado!' : 'Copiar URL'}
                      </button>
                    )}
                  </div>
                  
                  <div className="p-2 border-t border-border">
                    <p className="text-xs truncate font-medium" title={img.name}>{img.name}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {new Date(img.created_at).toLocaleDateString('pt-BR')}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
