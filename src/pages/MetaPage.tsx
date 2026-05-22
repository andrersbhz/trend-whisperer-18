import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Facebook, Instagram, Share2, Users, MessageSquare, Heart, RefreshCw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import Preloader from '@/components/Preloader';

const MetaPage = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [metaMetrics, setMetaMetrics] = useState<any[] | null>(null);

  const fetchMetrics = async () => {
    if (!user) return;
    try {
      const { data } = await supabase.functions.invoke('fetch-meta-metrics', { 
        body: { userId: user.id } 
      });
      if (data?.pages) setMetaMetrics(data.pages.length > 0 ? data.pages : null);
    } catch (error) {
      console.error(error);
    } finally {
      setTimeout(() => setLoading(false), 800);
    }
  };

  useEffect(() => {
    fetchMetrics();
  }, [user]);

  if (loading) return <Preloader message="Sincronizando com Meta (Facebook/Instagram)..." />;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between border-b border-white/5 pb-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 bg-accent/20 flex items-center justify-center rounded-sm border border-accent/30 shadow-neon-pink">
            <Facebook className="h-6 w-6 text-accent" />
          </div>
          <div>
            <h1 className="text-xl font-black uppercase tracking-tighter">Meta Ecosystem</h1>
            <p className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">Facebook & Instagram Management</p>
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={() => { setLoading(true); fetchMetrics(); }} className="text-[10px] font-bold uppercase tracking-widest">
           <RefreshCw className="h-3.5 w-3.5 mr-2" /> Atualizar
        </Button>
      </div>

      {!metaMetrics ? (
        <Card className="glass-card border-dashed border-accent/30 p-12 text-center">
          <div className="flex justify-center gap-4 mb-4">
            <Facebook className="h-10 w-10 text-accent/40" />
            <Instagram className="h-10 w-10 text-primary/40" />
          </div>
          <h3 className="text-lg font-bold mb-2">Contas Meta não vinculadas</h3>
          <p className="text-muted-foreground text-sm max-w-md mx-auto mb-6">
            Conecte suas páginas do Facebook e perfis comerciais do Instagram para automatizar postagens e acompanhar métricas de engajamento.
          </p>
          <Button onClick={() => window.location.href='/settings'} className="bg-accent hover:bg-accent/80 text-white uppercase tracking-widest text-[10px] font-bold">
            Configurar Conexões
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-6">
          {metaMetrics.map((pg, idx) => (
            <Card key={idx} className="glass-card overflow-hidden">
              <div className="p-4 bg-white/5 border-b border-white/5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-secondary flex items-center justify-center overflow-hidden border border-white/10">
                    {pg.page_picture ? <img src={pg.page_picture} alt="" className="h-full w-full object-cover" /> : <Users className="h-5 w-5" />}
                  </div>
                  <div>
                    <h3 className="font-bold text-sm">{pg.page_name}</h3>
                    <p className="text-[10px] text-muted-foreground">ID: {pg.page_id}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                   {pg.facebook && <Facebook className="h-4 w-4 text-accent" />}
                   {pg.instagram && <Instagram className="h-4 w-4 text-primary" />}
                </div>
              </div>
              <CardContent className="p-6">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                   <div className="text-center">
                     <p className="text-[10px] uppercase font-bold text-muted-foreground mb-1">Seguidores FB</p>
                     <p className="text-xl font-black text-accent">{pg.facebook?.followers_count || pg.facebook?.fan_count || 0}</p>
                   </div>
                   <div className="text-center">
                     <p className="text-[10px] uppercase font-bold text-muted-foreground mb-1">Seguidores IG</p>
                     <p className="text-xl font-black text-primary">{pg.instagram?.followers_count || 0}</p>
                   </div>
                   <div className="text-center">
                     <p className="text-[10px] uppercase font-bold text-muted-foreground mb-1">Posts IG</p>
                     <p className="text-xl font-black text-foreground">{pg.instagram?.media_count || 0}</p>
                   </div>
                   <div className="text-center">
                     <p className="text-[10px] uppercase font-bold text-muted-foreground mb-1">Engajamento</p>
                     <p className="text-xl font-black text-success">Alta</p>
                   </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default MetaPage;
