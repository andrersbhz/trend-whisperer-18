import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Instagram, Users, Image as ImageIcon, RefreshCw, CheckCircle2 } from 'lucide-react';
import Preloader from '@/components/Preloader';

const InstagramPage = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [pages, setPages] = useState<any[] | null>(null);

  const fetchMetrics = async () => {
    if (!user) return;
    try {
      const { data } = await supabase.functions.invoke('fetch-meta-metrics', {
        body: { userId: user.id },
      });
      const igPages = (data?.pages || []).filter((p: any) => p.instagram);
      setPages(igPages.length > 0 ? igPages : null);
    } catch (error) {
      console.error(error);
    } finally {
      setTimeout(() => setLoading(false), 600);
    }
  };

  useEffect(() => {
    fetchMetrics();
  }, [user]);

  if (loading) return <Preloader message="carregando dados aguarde" />;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between border-b border-white/5 pb-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 bg-gradient-to-tr from-[#f9ce34] via-[#ee2a7b] to-[#6228d7] flex items-center justify-center rounded-sm shadow-neon-pink">
            <Instagram className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-black uppercase tracking-tighter">Instagram</h1>
            <p className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">
              Contas Business vinculadas via Facebook
            </p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => { setLoading(true); fetchMetrics(); }}
          className="text-[10px] font-bold uppercase tracking-widest"
        >
          <RefreshCw className="h-3.5 w-3.5 mr-2" /> Atualizar
        </Button>
      </div>

      {!pages ? (
        <Card className="glass-card border-dashed border-primary/30 p-12 text-center">
          <Instagram className="h-10 w-10 text-primary/40 mx-auto mb-4" />
          <h3 className="text-lg font-bold mb-2">Nenhum Instagram Business vinculado</h3>
          <p className="text-muted-foreground text-sm max-w-md mx-auto mb-6">
            Conecte uma página do Facebook que tenha uma conta Instagram Business vinculada.
            O Instagram aparecerá aqui automaticamente como conectado.
          </p>
          <Button
            onClick={() => (window.location.href = '/settings')}
            className="bg-gradient-to-tr from-[#f9ce34] via-[#ee2a7b] to-[#6228d7] text-white uppercase tracking-widest text-[10px] font-bold"
          >
            Conectar Facebook
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-6">
          {pages.map((pg, idx) => (
            <Card key={idx} className="glass-card overflow-hidden">
              <div className="p-4 bg-white/5 border-b border-white/5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-secondary flex items-center justify-center overflow-hidden border border-white/10">
                    {pg.instagram?.profile_picture_url ? (
                      <img src={pg.instagram.profile_picture_url} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <Instagram className="h-5 w-5" />
                    )}
                  </div>
                  <div>
                    <h3 className="font-bold text-sm">@{pg.instagram?.username || pg.instagram?.name}</h3>
                    <p className="text-[10px] text-muted-foreground">Vinculado à página: {pg.page_name}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-success/10 border border-success/30">
                  <CheckCircle2 className="h-3.5 w-3.5 text-success" />
                  <span className="text-[10px] font-bold uppercase tracking-widest text-success">Conectado</span>
                </div>
              </div>
              <CardContent className="p-6">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                  <div className="text-center">
                    <Users className="h-4 w-4 text-primary mx-auto mb-1.5" />
                    <p className="text-[10px] uppercase font-bold text-muted-foreground mb-1">Seguidores</p>
                    <p className="text-xl font-black text-primary">{pg.instagram?.followers_count || 0}</p>
                  </div>
                  <div className="text-center">
                    <ImageIcon className="h-4 w-4 text-foreground mx-auto mb-1.5" />
                    <p className="text-[10px] uppercase font-bold text-muted-foreground mb-1">Posts</p>
                    <p className="text-xl font-black text-foreground">{pg.instagram?.media_count || 0}</p>
                  </div>
                  <div className="text-center">
                    <Instagram className="h-4 w-4 text-success mx-auto mb-1.5" />
                    <p className="text-[10px] uppercase font-bold text-muted-foreground mb-1">Status</p>
                    <p className="text-xl font-black text-success">Ativo</p>
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

export default InstagramPage;
