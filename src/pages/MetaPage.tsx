import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Facebook, Users, RefreshCw, Loader2 } from 'lucide-react';
import Preloader from '@/components/Preloader';

const MetaPage = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [metaMetrics, setMetaMetrics] = useState<any[] | null>(null);

  // Load cached metrics instantly from DB
  const loadCached = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('facebook_accounts')
      .select('page_id, page_name, picture_url, last_metrics')
      .eq('user_id', user.id)
      .eq('is_active', true);

    if (data && data.length > 0) {
      const pages = data.map((acc: any) => ({
        page_id: acc.page_id,
        page_name: acc.page_name,
        page_picture: acc.picture_url,
        facebook: acc.last_metrics?.facebook || { fan_count: 0, followers_count: 0 },
      }));
      setMetaMetrics(pages);
    }
    setLoading(false);
  };

  // Refresh from Meta API in background
  const refreshMetrics = async () => {
    if (!user) return;
    setRefreshing(true);
    try {
      const { data } = await supabase.functions.invoke('fetch-meta-metrics', {
        body: { userId: user.id },
      });
      if (data?.pages?.length > 0) setMetaMetrics(data.pages);
    } catch (error) {
      console.error(error);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadCached().then(() => {
      // Auto-refresh in background after showing cache
      refreshMetrics();
    });
  }, [user]);

  if (loading) return <Preloader message="carregando dados aguarde" />;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between border-b border-white/5 pb-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 bg-accent/20 flex items-center justify-center rounded-sm border border-accent/30 shadow-neon-pink">
            <Facebook className="h-6 w-6 text-accent" />
          </div>
          <div>
            <h1 className="text-xl font-black uppercase tracking-tighter">Facebook</h1>
            <p className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">Páginas e métricas do Facebook</p>
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={refreshMetrics} disabled={refreshing} className="text-[10px] font-bold uppercase tracking-widest">
          {refreshing ? <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5 mr-2" />}
          {refreshing ? 'Atualizando...' : 'Atualizar'}
        </Button>
      </div>

      {!metaMetrics ? (
        <Card className="glass-card border-dashed border-accent/30 p-12 text-center">
          <Facebook className="h-10 w-10 text-accent/40 mx-auto mb-4" />
          <h3 className="text-lg font-bold mb-2">Nenhuma página do Facebook conectada</h3>
          <p className="text-muted-foreground text-sm max-w-md mx-auto mb-6">
            Conecte suas páginas do Facebook para automatizar postagens e acompanhar métricas de engajamento.
          </p>
          <Button onClick={() => window.location.href='/settings'} className="bg-accent hover:bg-accent/80 text-white uppercase tracking-widest text-[10px] font-bold">
            Configurar Conexão
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
                <Facebook className="h-4 w-4 text-accent" />
              </div>
              <CardContent className="p-6">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                   <div className="text-center">
                     <p className="text-[10px] uppercase font-bold text-muted-foreground mb-1">Seguidores</p>
                     <p className="text-xl font-black text-accent">{pg.facebook?.followers_count || pg.facebook?.fan_count || 0}</p>
                   </div>
                   <div className="text-center">
                     <p className="text-[10px] uppercase font-bold text-muted-foreground mb-1">Curtidas</p>
                     <p className="text-xl font-black text-foreground">{pg.facebook?.fan_count || 0}</p>
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
