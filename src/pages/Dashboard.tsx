import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  FileText, TrendingUp, CheckCircle, Clock, Sparkles, RefreshCw, Save, Loader2,
  PenTool, ChevronDown, Facebook, ExternalLink, BarChart3, X, Eye, MessageSquare, Bot, UserCheck, ArrowRight
} from 'lucide-react';
import { cn } from '@/lib/utils';
import AIProvidersPanel from '@/components/dashboard/AIProvidersPanel';
import { useToast } from '@/hooks/use-toast';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { getErrorMessage, runBackendQuery, runBackendMutation } from '@/lib/backend';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import AnalyticsPage from '@/pages/AnalyticsPage';
import { useNavigate } from 'react-router-dom';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";



const Dashboard = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [stats, setStats] = useState({ total: 0, published: 0, pending: 0, trending: 0, failed: 0 });
  const [recentArticles, setRecentArticles] = useState<any[]>([]);
  const [recentErrors, setRecentErrors] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [categoryStats, setCategoryStats] = useState<Array<{ category: string; total: number; published: number; pending: number; failed: number }>>([]);
  const [generating, setGenerating] = useState(false);
  const [trendingList, setTrendingList] = useState<any[]>([]);
  const [loadingTrends, setLoadingTrends] = useState(true);
  const [userCategories, setUserCategories] = useState<string[]>([]);
  const [metaMetrics, setMetaMetrics] = useState<any[] | null>(null);
  const [loadingMeta, setLoadingMeta] = useState(false);
  const [selectedPageForMetrics, setSelectedPageForMetrics] = useState<string | null>(null);
  const [isMetricsModalOpen, setIsMetricsModalOpen] = useState(false);
  const [jetpackStats, setJetpackStats] = useState<any | null>(null);
  const [loadingJetpack, setLoadingJetpack] = useState(false);
  const [interactions, setInteractions] = useState<any[]>([]);
  const [loadingInteractions, setLoadingInteractions] = useState(false);
  const [processingInteractions, setProcessingInteractions] = useState(false);
  const [refreshInterval, setRefreshInterval] = useState(30); // minutes
  const [nextRefresh, setNextRefresh] = useState<Date | null>(null);


  const fetchStats = async () => {
    if (!user) return;
    setLoadingTrends(true);

    try {
      const [articles, trendingTopics, recent, errors, logs, topTrends, categoriesData] = await Promise.all([
        runBackendQuery(() => supabase.from('articles').select('id, status, category').eq('user_id', user.id)),
        runBackendQuery(() => supabase.from('trending_topics').select('id').eq('user_id', user.id).eq('used', false)),
        runBackendQuery(() =>
          supabase
            .from('articles')
            .select('id, title, category, seo_keyword, status')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(5),
        ),
        runBackendQuery(() =>
          supabase
            .from('publish_log')
            .select('id, article_id, error_message, created_at, status')
            .eq('user_id', user.id)
            .eq('status', 'failed')
            .order('created_at', { ascending: false })
            .limit(5),
        ),
        runBackendQuery(() =>
          supabase
            .from('audit_logs')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(10),
        ),
        runBackendQuery(() =>
          supabase
            .from('trending_topics')
            .select('*')
            .eq('user_id', user.id)
            .eq('used', false)
            .order('fetched_at', { ascending: false })
            .limit(10)
        ),
        runBackendQuery(() => supabase.from('user_settings').select('categories').eq('user_id', user.id).maybeSingle()),
      ]);

      setTrendingList(topTrends || []);
      setUserCategories(categoriesData?.categories || ['esportes', 'politica', 'policia', 'saude', 'celebridades', 'financas']);
      setLoadingTrends(false);

      setStats({
        total: articles?.length || 0,
        published: (articles || []).filter((a) => a.status === 'published').length,
        pending: (articles || []).filter((a) => a.status === 'ready' || a.status === 'draft').length,
        trending: trendingTopics?.length || 0,
        failed: (articles || []).filter((a) => a.status === 'failed').length,
      });

      // Aggregate by category — start with all known categories so they always appear
      const ALL_CATEGORIES = ['esportes', 'politica', 'policia', 'saude', 'celebridades', 'financas'];
      const byCat: Record<string, { total: number; published: number; pending: number; failed: number }> = {};
      ALL_CATEGORIES.forEach((cat) => {
        byCat[cat] = { total: 0, published: 0, pending: 0, failed: 0 };
      });
      (articles || []).forEach((a: any) => {
        const cat = a.category || 'outros';
        if (!byCat[cat]) byCat[cat] = { total: 0, published: 0, pending: 0, failed: 0 };
        byCat[cat].total += 1;
        if (a.status === 'published') byCat[cat].published += 1;
        else if (a.status === 'failed') byCat[cat].failed += 1;
        else if (a.status === 'ready' || a.status === 'draft' || a.status === 'generating') byCat[cat].pending += 1;
      });
      setCategoryStats(
        Object.entries(byCat)
          .map(([category, v]) => ({ category, ...v }))
          .sort((a, b) => b.total - a.total),
      );

      setRecentArticles(recent || []);
      setRecentErrors(errors || []);
      setAuditLogs(logs || []);
    } catch (error) {
      setStats({ total: 0, published: 0, pending: 0, trending: 0, failed: 0 });
      setRecentArticles([]);
      setCategoryStats([]);
      toast({ title: 'Erro ao carregar painel', description: getErrorMessage(error), variant: 'destructive' });
    }
  };

  const fetchMetaMetrics = async () => {
    if (!user) return;
    setLoadingMeta(true);
    try {
      const data = await runBackendQuery(() =>
        supabase.functions.invoke('fetch-meta-metrics', {
          body: { userId: user.id },
        }),
      );
      if (data?.pages) {
        setMetaMetrics(data.pages.length > 0 ? data.pages : null);
      }

    } catch (error) {
      console.error('Meta metrics error:', error);
    } finally {
      setLoadingMeta(false);
    }
  };

  const fetchJetpackStats = async () => {
    if (!user) return;
    setLoadingJetpack(true);
    try {
      const data = await runBackendQuery(() =>
        supabase.functions.invoke('fetch-jetpack-stats', { body: { userId: user.id } }),
      );
      if (data?.jetpack?.available) {
        setJetpackStats(data.jetpack);
      }
    } catch (error) {
      console.error('Jetpack stats error:', error);
    } finally {
      setLoadingJetpack(false);
    }
  };

  const fetchInteractions = async () => {
    if (!user) return;
    setLoadingInteractions(true);
    try {
      const { data } = await supabase
        .from('social_interactions')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5);
      setInteractions(data || []);
    } catch (error) {
      console.error('Interactions error:', error);
    } finally {
      setLoadingInteractions(false);
    }
  };

  const handleProcessInteractions = async () => {
    if (!user) return;
    setProcessingInteractions(true);
    try {
      // Step 1: Fetch new ones from API
      await supabase.functions.invoke('handle-social-interactions', { body: { userId: user.id } });
      // Step 2: Generate AI replies
      const { data } = await supabase.functions.invoke('process-social-replies', { body: { userId: user.id } });
      
      toast({ 
        title: 'Interações processadas', 
        description: `${data?.replied || 0} novas respostas humanas geradas.` 
      });
      fetchInteractions();
    } catch (error) {
      toast({ title: 'Erro', description: getErrorMessage(error), variant: 'destructive' });
    } finally {
      setProcessingInteractions(false);
    }
  };

  useEffect(() => {
    fetchStats();
    fetchMetaMetrics();
    fetchJetpackStats();
    fetchInteractions();

    // Fetch user settings for refresh interval
    const fetchIntervalSettings = async () => {
      if (!user) return;
      const { data } = await supabase.from('user_settings').select('metrics_refresh_interval').eq('user_id', user.id).maybeSingle();
      if (data?.metrics_refresh_interval) {
        setRefreshInterval(data.metrics_refresh_interval);
      }
    };
    fetchIntervalSettings();
  }, [user]);

  useEffect(() => {
    if (!user || refreshInterval <= 0) return;

    const intervalMs = refreshInterval * 60 * 1000;
    setNextRefresh(new Date(Date.now() + intervalMs));

    const interval = setInterval(() => {
      console.log('Auto-refreshing metrics...');
      fetchMetaMetrics();
      setNextRefresh(new Date(Date.now() + intervalMs));
    }, intervalMs);

    return () => clearInterval(interval);
  }, [user, refreshInterval]);

  const getFunctionErrorMessage = async (error: unknown) => {
    const response = typeof error === 'object' && error && 'context' in error
      ? (error as { context?: Response }).context
      : undefined;

    if (response) {
      try {
        const payload = await response.clone().json();
        if (typeof payload?.error === 'string' && payload.error.trim()) {
          return payload.error;
        }
        if (typeof payload?.message === 'string' && payload.message.trim()) {
          return payload.message;
        }
      } catch {
        // ignore
      }

      if (response.status === 402) return 'O Lovable AI está sem créditos para gerar artigos agora.';
      if (response.status === 429) return 'A geração atingiu o limite da IA configurada.';
    }

    return getErrorMessage(error);
  };


  const handleGenerateArticles = async () => {
    if (!user) return;

    setGenerating(true);
    try {
      const data = await runBackendQuery(() =>
        supabase.functions.invoke('generate-articles', {
          body: { userId: user.id },
        }),
      );
      toast({ title: 'Geração iniciada!', description: data?.message || 'Artigos sendo gerados...' });
      setTimeout(fetchStats, 5000);
    } catch (error) {
      toast({ title: 'Erro ao gerar artigos', description: await getFunctionErrorMessage(error), variant: 'destructive' });
    } finally {
      setGenerating(false);
    }
  };

  const handleUpdateCategory = async (articleId: string, newCategory: string) => {
    try {
      const { error } = await supabase
        .from('articles')
        .update({ category: newCategory })
        .eq('id', articleId);

      if (error) throw error;

      setRecentArticles(prev => prev.map(a => a.id === articleId ? { ...a, category: newCategory } : a));
      toast({ title: 'Categoria atualizada', description: `Artigo movido para ${newCategory}` });
      fetchStats(); // Refresh stats to update the category counts
    } catch (error) {
      toast({ title: 'Erro ao atualizar categoria', description: getErrorMessage(error), variant: 'destructive' });
    }
  };

  const statusColors: Record<string, string> = {
    draft: 'bg-muted text-muted-foreground',
    generating: 'bg-warning/20 text-warning',
    ready: 'bg-primary/20 text-primary',
    published: 'bg-success/20 text-success',
    failed: 'bg-destructive/20 text-destructive',
  };

  const categoryLabels: Record<string, string> = {
    esportes: '⚽ Esportes',
    politica: '🏛️ Política',
    policia: '🚔 Polícia',
    saude: '💚 Saúde',
    celebridades: '⭐ Celebridades',
    financas: '💰 Finanças',
  };

  const statCards = [
    { icon: FileText, label: 'Total Artigos', value: stats.total, color: 'text-primary', accent: 'from-primary/10 to-transparent', glow: 'neon-border-lilac' },
    { icon: CheckCircle, label: 'Publicados', value: stats.published, color: 'text-success', accent: 'from-success/10 to-transparent', glow: '' },
    { icon: Clock, label: 'Pendentes', value: stats.pending, color: 'text-warning', accent: 'from-warning/10 to-transparent', glow: '' },
    { icon: TrendingUp, label: 'Tendências', value: stats.trending, color: 'text-accent', accent: 'from-accent/10 to-transparent', glow: 'neon-border-pink' },
  ];

  return (
    <div className="space-y-6 lg:space-y-8 pb-10">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex flex-col">
          <h1 className="text-2xl sm:text-3xl font-bold neon-text-lilac uppercase tracking-tighter">NEURAL VORTEX</h1>
          <div className="flex items-center gap-2 mt-1">
            <p className="text-muted-foreground text-sm">Visão geral, métricas e geração de conteúdo</p>
            {nextRefresh && (
              <Badge variant="outline" className="text-[10px] border-primary/20 bg-primary/5 text-primary/70 animate-pulse">
                Auto-update: {format(nextRefresh, "HH:mm")}
              </Badge>
            )}
          </div>
        </div>
        <Button
          onClick={handleGenerateArticles}
          disabled={generating}
          size="lg"
          className="gradient-primary text-primary-foreground shadow-neon-lilac hover:shadow-neon-lilac hover:scale-[1.02] transition-transform w-full sm:w-auto rounded-none font-bold uppercase tracking-widest text-xs"
        >
          {generating ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
          Gerar Artigos
        </Button>
      </div>

      {/* Intervalo de Atualização */}
      <div className="flex justify-end">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground hover:text-primary gap-2">
              <RefreshCw className={cn("h-3 w-3", loadingMeta && "animate-spin")} />
              Atualizar a cada {refreshInterval} min
              <ChevronDown className="h-3 w-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="glass-card">
            {[5, 10, 15, 30, 60].map((min) => (
              <DropdownMenuItem 
                key={min} 
                onClick={async () => {
                  setRefreshInterval(min);
                  if (user) {
                    await supabase.from('user_settings').update({ metrics_refresh_interval: min }).eq('user_id', user.id);
                  }
                  toast({ title: 'Intervalo atualizado', description: `Métricas serão atualizadas a cada ${min} minutos.` });
                }}
                className={cn("text-xs font-bold uppercase", refreshInterval === min && "bg-primary/10 text-primary")}
              >
                {min} Minutos
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {statCards.map((stat, i) => (
          <Card
            key={stat.label}
            className={`glass-card hover-lift ${stat.glow} relative overflow-hidden animate-float-up`}
            style={{ animationDelay: `${i * 60}ms` }}
          >
            <div className={`absolute inset-0 bg-gradient-to-br ${stat.accent} pointer-events-none opacity-50`} />
            <CardContent className="p-4 sm:p-5 relative">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[11px] sm:text-xs uppercase tracking-wider text-muted-foreground font-medium">{stat.label}</p>
                  <p className="text-2xl sm:text-3xl font-bold text-foreground mt-1.5 tabular-nums">{stat.value}</p>
                </div>
                <div className={`p-2 rounded-lg bg-background/40 ${stat.color}`}>
                  <stat.icon className="h-5 w-5" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* === FACEBOOK PAGES CARDS === */}
      {metaMetrics && metaMetrics.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 animate-fade-in">
          {metaMetrics.map((pg: any, idx: number) => (
            <div 
              key={pg.page_id || idx}
              className="glass-card hover-lift relative overflow-hidden flex flex-col items-center p-6 border-primary/20 shadow-[0_0_20px_rgba(0,150,255,0.05)] group rounded-none"
            >
              {/* Neon accent line */}
              <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-primary to-transparent opacity-50" />
              <div className="absolute bottom-0 left-0 w-full h-[1px] bg-primary/10" />
              
              {/* Central Round Logo */}
              <div className="relative mb-4">
                <div className="absolute inset-0 bg-primary/10 rounded-full blur-xl group-hover:bg-primary/20 transition-colors" />
                <div className="relative h-20 w-20 rounded-full border-2 border-primary/40 p-1 bg-background shadow-[0_0_15px_rgba(0,150,255,0.2)] overflow-hidden">
                  {pg.facebook?.picture?.data?.url ? (
                    <img src={pg.facebook.picture.data.url} alt={pg.page_name} className="h-full w-full rounded-full object-cover" />
                  ) : (
                    <div className="h-full w-full rounded-full bg-accent/10 flex items-center justify-center">
                      <Facebook className="h-10 w-10 text-primary" />
                    </div>
                  )}
                </div>
              </div>

              {/* Page Name */}
              <h3 className="text-lg font-bold text-foreground text-center line-clamp-1 mb-1 group-hover:text-primary transition-colors uppercase tracking-tighter">
                {pg.page_name}
              </h3>
              
              {/* Metrics Summary */}
              <div className="grid grid-cols-2 gap-x-4 gap-y-3 mb-5 text-[10px] text-muted-foreground font-medium uppercase tracking-wider w-full px-2">
                <div className="flex flex-col items-center">
                  <span className="text-foreground text-sm font-black tabular-nums">{(pg.facebook?.followers_count || pg.facebook?.fan_count || 0).toLocaleString()}</span>
                  <span className="opacity-70">Seguidores</span>
                </div>
                <div className="flex flex-col items-center">
                  <span className="text-foreground text-sm font-black tabular-nums">{(pg.facebook?.fan_count || 0).toLocaleString()}</span>
                  <span className="opacity-70">Curtidas</span>
                </div>
                <div className="flex flex-col items-center">
                  <span className="text-foreground text-sm font-black tabular-nums">{(pg.facebook?.post_stats?.total_posts || 0).toLocaleString()}</span>
                  <span className="opacity-70">Postagens</span>
                </div>
                <div className="flex flex-col items-center">
                  <span className="text-foreground text-sm font-black tabular-nums">{(pg.facebook?.post_stats?.avg_engagement || 0).toLocaleString()}</span>
                  <span className="opacity-70">Engajamento</span>
                </div>
              </div>

              {/* Action Button */}
               <Button 
                onClick={async () => {
                  toast({ title: "Atualizando métricas...", description: "Buscando dados em tempo real da Meta." });
                  await fetchMetaMetrics();
                  setSelectedPageForMetrics(pg.page_id);
                  setIsMetricsModalOpen(true);
                }}
                variant="outline" 
                size="sm"
                className="w-full bg-primary/5 border-primary/30 hover:bg-primary hover:text-primary-foreground rounded-none transition-all gap-2 text-[10px] uppercase font-bold tracking-widest"
              >
                <BarChart3 className="h-4 w-4" />
                Ver métricas
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Metrics Modal */}
      <Dialog open={isMetricsModalOpen} onOpenChange={setIsMetricsModalOpen}>
        <DialogContent className="max-w-7xl h-[90vh] overflow-y-auto glass-card border-accent/30 p-0 sm:p-6">
          <DialogHeader className="px-6 py-4 sm:px-0 sm:py-0">
            <div className="flex items-center justify-between">
              <DialogTitle className="text-2xl font-bold neon-text-lilac">Métricas da Página</DialogTitle>
              <DialogClose className="opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none disabled:pointer-events-none">
                <X className="h-6 w-6 text-muted-foreground" />
                <span className="sr-only">Fechar</span>
              </DialogClose>
            </div>
          </DialogHeader>
          <div className="px-6 pb-6 sm:px-0 sm:pb-0">
            <AnalyticsPage isModal={true} pageId={selectedPageForMetrics} />
          </div>
        </DialogContent>
      </Dialog>

      {/* === ANALYTICS COMPLETO === */}
      <div className="pt-6 border-t border-border/50">
        <AnalyticsPage />
      </div>

      {/* === SOCIAL HUMAN BOT === */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-fade-in">
        <Card className="glass-card neon-border-lilac overflow-hidden">
          <CardHeader className="pb-3 border-b border-white/5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bot className="h-5 w-5 text-primary" />
                <CardTitle className="text-lg uppercase tracking-tighter">Robô Social Humano</CardTitle>
              </div>
              <Button 
                size="sm" 
                onClick={handleProcessInteractions}
                disabled={processingInteractions}
                className="gradient-primary h-7 px-3 text-[10px] uppercase font-bold tracking-widest rounded-none"
              >
                {processingInteractions ? <RefreshCw className="h-3 w-3 mr-2 animate-spin" /> : <UserCheck className="h-3 w-3 mr-2" />}
                Sincronizar e Responder
              </Button>
            </div>
            <p className="text-[10px] text-muted-foreground uppercase mt-1">Interações recentes com comportamento humano</p>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-white/5">
              {loadingInteractions ? (
                <div className="p-10 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
              ) : interactions.length > 0 ? (
                interactions.map((item) => (
                  <div key={item.id} className="p-4 hover:bg-white/5 transition-colors">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex gap-3 min-w-0">
                        <div className="shrink-0 h-8 w-8 rounded-full border border-primary/20 bg-background overflow-hidden">
                          {item.author_avatar ? (
                            <img src={item.author_avatar} alt={item.author_name} className="h-full w-full object-cover" />
                          ) : (
                            <div className="h-full w-full flex items-center justify-center bg-primary/5 text-primary text-[10px] font-bold">
                              {item.author_name?.substring(0, 1).toUpperCase()}
                            </div>
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-[10px] font-black text-primary uppercase">{item.author_name}</span>
                            <Badge variant="outline" className="text-[8px] h-3 px-1 border-primary/20 text-primary opacity-70">
                              {item.platform}
                            </Badge>
                          </div>
                        <p className="text-sm text-foreground line-clamp-1 italic">"{item.content}"</p>
                        {item.ai_response && (
                          <div className="mt-2 flex gap-2 items-start bg-primary/5 p-2 border-l-2 border-primary">
                            <MessageSquare className="h-3 w-3 text-primary mt-1 shrink-0" />
                            <p className="text-[11px] text-muted-foreground leading-snug">{item.ai_response}</p>
                          </div>
                        )}
                        </div>
                        <Badge variant="secondary" className="text-[9px] uppercase tracking-tighter shrink-0 bg-background/50">
                          {item.status === 'replied' ? 'Respondido ✓' : 'Pendente'}
                        </Badge>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-10 text-center text-muted-foreground text-xs uppercase tracking-widest opacity-50">
                  Nenhuma interação recente encontrada
                </div>
              )}
            </div>
            {interactions.length > 0 && (
              <div className="p-3 border-t border-white/5">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => navigate('/robot')}
                  className="w-full text-[10px] uppercase font-bold tracking-widest text-primary hover:text-primary hover:bg-primary/5 gap-2"
                >
                  Ver todas as interações
                  <ArrowRight className="h-3 w-3" />
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="h-full">
          <AIProvidersPanel />
        </div>
      </div>

      {/* Google Trends Preview */}
        <Card className="glass-card neon-border-lilac h-full">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-primary" />
                <CardTitle className="text-lg">Google Trends Brasil</CardTitle>
                <span className="text-xl">🇧🇷</span>
              </div>
              <Button variant="ghost" size="sm" asChild className="text-xs h-7">
                <a href="/trends">Ver tudo</a>
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">Assuntos quentes agora no Brasil</p>
          </CardHeader>
          <CardContent>
            {loadingTrends ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : trendingList.length === 0 ? (
              <p className="text-xs text-muted-foreground py-8 text-center italic">
                Nenhuma tendência disponível.
              </p>
            ) : (
              <div className="space-y-3">
                {trendingList.slice(0, 6).map((t: any) => (
                  <div key={t.id} className="group p-2.5 rounded-md bg-secondary/20 hover:bg-secondary/40 transition-colors border border-transparent hover:border-primary/20">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium truncate">{t.topic}</span>
                      <Badge variant="outline" className="text-[10px] h-4 bg-primary/5 text-primary border-primary/10 px-1">
                        {t.category}
                      </Badge>
                    </div>
                    {t.search_volume && (
                      <p className="text-[10px] text-muted-foreground mt-0.5">{t.search_volume} buscas</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

      {/* === ARTIGOS MAIS VISTOS === */}
      {jetpackStats?.topPosts && jetpackStats.topPosts.length > 0 && (
        <Card className="glass-card neon-border-lilac overflow-hidden animate-fade-in">
          <CardHeader className="pb-3 border-b border-white/5">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg uppercase tracking-tighter">Artigos Mais Vistos</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-0 divide-y md:divide-y-0 md:divide-x divide-white/5">
              {jetpackStats.topPosts.slice(0, 6).map((post: any, i: number) => (
                <div 
                  key={i} 
                  className="flex items-start gap-4 p-5 hover:bg-white/5 transition-colors group cursor-pointer"
                  onClick={() => post.url && window.open(post.url, '_blank')}
                >
                  <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center bg-primary/10 text-primary font-black text-lg border border-primary/20">
                    {i + 1}
                  </div>
                  <div className="flex flex-col gap-1 min-w-0">
                    <h4 className="text-sm font-bold text-foreground line-clamp-2 leading-tight group-hover:text-primary transition-colors uppercase tracking-tight">
                      {post.title}
                    </h4>
                    <div className="flex items-center gap-3 mt-1">
                      <div className="flex items-center gap-1 text-[10px] text-muted-foreground font-bold uppercase tracking-widest">
                        <Eye className="h-3 w-3 text-primary" />
                        <span>{post.views.toLocaleString()} <span className="opacity-50 font-normal">views</span></span>
                      </div>
                      <ExternalLink className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Métricas por Categoria */}
      <Card className="glass-card neon-border-pink">
        <CardHeader>
          <div className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-accent" />
            <CardTitle className="text-lg text-foreground">Métricas por Categoria</CardTitle>
          </div>
          <p className="text-sm text-muted-foreground">
            Distribuição de artigos por categoria, com status de publicação.
          </p>
        </CardHeader>
        <CardContent>
          {categoryStats.length === 0 ? (
            <p className="text-muted-foreground text-sm py-8 text-center">
              Nenhuma categoria configurada.
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {categoryStats.map((c, idx) => {
                const pct = stats.total > 0 ? Math.round((c.total / stats.total) * 100) : 0;
                return (
                  <div
                    key={c.category}
                    className="p-4 rounded-lg bg-secondary/30 hover:bg-secondary/60 transition-all duration-200 border border-border/40 animate-float-up"
                    style={{ animationDelay: `${idx * 50}ms` }}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-foreground truncate">
                        {categoryLabels[c.category] || c.category}
                      </span>
                      <Badge variant="secondary" className="bg-primary/15 text-primary text-[10px] shrink-0">
                        {pct}%
                      </Badge>
                    </div>
                    <p className="text-2xl font-bold text-foreground tabular-nums mb-3">{c.total}</p>
                    <div className="h-1.5 w-full rounded-full bg-background/50 overflow-hidden mb-3">
                      <div
                        className="h-full gradient-primary transition-all duration-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between gap-2 text-[11px]">
                      <div className="flex items-center gap-1 text-success">
                        <CheckCircle className="h-3 w-3" />
                        <span className="tabular-nums">{c.published}</span>
                      </div>
                      <div className="flex items-center gap-1 text-warning">
                        <Clock className="h-3 w-3" />
                        <span className="tabular-nums">{c.pending}</span>
                      </div>
                      <div className="flex items-center gap-1 text-destructive">
                        <span className="h-2 w-2 rounded-full bg-destructive" />
                        <span className="tabular-nums">{c.failed}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>


      {/* Logs de Auditoria e Erros */}
      <div id="audit-logs-section" className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Audit Logs */}
        <Card className="glass-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg text-foreground flex items-center gap-2">
              <Clock className="h-5 w-5 text-primary" />
              Logs de Auditoria
            </CardTitle>
            <p className="text-xs text-muted-foreground">Histórico recente de alterações no sistema</p>
          </CardHeader>
          <CardContent className="space-y-3">
            {auditLogs.length === 0 ? (
              <p className="text-xs text-muted-foreground py-4 text-center">Nenhuma atividade registrada ainda.</p>
            ) : (
              auditLogs.map((log) => (
                <div key={log.id} className="p-3 rounded-md bg-background/40 border border-border/50 text-xs flex flex-col gap-1">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-primary">
                      {log.action === 'update_writer_prompt' ? '📝 Prompt do Escritor' : 
                       log.action === 'update_settings' ? '⚙️ Configurações' : 
                       log.action === 'generate_articles' ? '🚀 Geração Iniciada' : 
                       log.action === 'approve_article' ? '✅ Artigo Aprovado' :
                       log.action === 'delete_article' ? '🗑️ Artigo Excluído' :
                       log.action === 'pause_article' ? '⏸️ Artigo Pausado' : log.action}
                    </span>
                    <span className="text-[10px] text-muted-foreground italic">
                      {format(new Date(log.created_at), "dd/MM 'às' HH:mm", { locale: ptBR })}
                    </span>
                  </div>
                  <p className="text-muted-foreground">
                    {log.details?.reason || log.details?.prompt_length ? `Tamanho: ${log.details.prompt_length} caracteres` : 'Alteração realizada com sucesso'}
                  </p>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Erros Recentes */}
        <Card className="glass-card border-destructive/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg text-foreground flex items-center gap-2">
              <div className="h-3 w-3 rounded-full bg-destructive" />
              Falhas de Publicação
            </CardTitle>
            <p className="text-xs text-muted-foreground">Erros ao tentar postar no WordPress</p>
          </CardHeader>
          <CardContent className="space-y-3">
            {recentErrors.length === 0 ? (
              <p className="text-xs text-muted-foreground py-4 text-center">Nenhum erro recente.</p>
            ) : (
              recentErrors.map((err) => (
                <div key={err.id} className="p-3 rounded-lg bg-destructive/5 border border-destructive/10">
                  <p className="text-xs text-destructive font-medium line-clamp-2">{err.error_message || 'Erro desconhecido'}</p>
                  <p className="text-[10px] text-muted-foreground mt-1">{new Date(err.created_at).toLocaleString('pt-BR')}</p>
                </div>
              ))
            )}
            {stats.failed > 0 && (
              <p className="text-[10px] text-center text-muted-foreground mt-2">Vá em Artigos para tentar novamente.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="text-lg text-foreground">Artigos Recentes</CardTitle>
        </CardHeader>
        <CardContent>
          {recentArticles.length === 0 ? (
            <p className="text-muted-foreground text-sm py-8 text-center">
              Nenhum artigo ainda. Clique em "Gerar Artigos" para começar!
            </p>
          ) : (
            <div className="space-y-2.5">
              {recentArticles.map((article, idx) => (
                <div
                  key={article.id}
                  className="flex items-center justify-between gap-3 p-3 sm:p-4 rounded-lg bg-secondary/30 hover:bg-secondary/60 hover:translate-x-1 transition-all duration-200 animate-float-up"
                  style={{ animationDelay: `${idx * 40}ms` }}
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-foreground text-sm sm:text-base truncate">{article.title}</p>
                    <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <span className="text-[11px] sm:text-xs text-muted-foreground cursor-pointer hover:text-primary transition-colors flex items-center gap-1">
                            {categoryLabels[article.category] || article.category}
                            <ChevronDown className="h-2.5 w-2.5" />
                          </span>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="max-h-[300px] overflow-y-auto">
                          {userCategories.map((cat) => (
                            <DropdownMenuItem 
                              key={cat} 
                              onClick={() => handleUpdateCategory(article.id, cat)}
                              className={`capitalize text-xs ${article.category === cat ? 'bg-primary/10 text-primary' : ''}`}
                            >
                              {categoryLabels[cat] || cat}
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                      {article.seo_keyword && (
                        <span className="text-[11px] sm:text-xs text-muted-foreground truncate">• {article.seo_keyword}</span>
                      )}
                    </div>
                  </div>
                  <Badge className={`${statusColors[article.status] || ''} shrink-0 text-[10px] sm:text-xs`} variant="secondary">
                    {article.status}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

    </div>
  );
};

export default Dashboard;
