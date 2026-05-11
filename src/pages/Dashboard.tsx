import { useEffect, useState, useMemo } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  FileText, TrendingUp, CheckCircle, Clock, Sparkles, RefreshCw, ChevronDown, Facebook, ExternalLink, BarChart3, X, Eye, MessageSquare, Bot, UserCheck, ArrowRight
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
import { getErrorMessage, runBackendQuery } from '@/lib/backend';
import { format, subDays, startOfDay, isSameDay } from 'date-fns';
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
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from 'recharts';

const Dashboard = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [stats, setStats] = useState({ total: 0, published: 0, pending: 0, trending: 0, failed: 0 });
  const [recentArticles, setRecentArticles] = useState<any[]>([]);
  const [recentErrors, setRecentErrors] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [categoryStats, setCategoryStats] = useState<any[]>([]);
  const [generating, setGenerating] = useState(false);
  const [trendingList, setTrendingList] = useState<any[]>([]);
  const [loadingTrends, setLoadingTrends] = useState(true);
  const [userCategories, setUserCategories] = useState<string[]>([]);
  const [metaMetrics, setMetaMetrics] = useState<any[] | null>(null);
  const [loadingMeta, setLoadingMeta] = useState(false);
  const [selectedPageForMetrics, setSelectedPageForMetrics] = useState<string | null>(null);
  const [isMetricsModalOpen, setIsMetricsModalOpen] = useState(false);
  const [interactions, setInteractions] = useState<any[]>([]);
  const [loadingInteractions, setLoadingInteractions] = useState(false);
  const [processingInteractions, setProcessingInteractions] = useState(false);
  const [refreshInterval, setRefreshInterval] = useState(30);
  const [nextRefresh, setNextRefresh] = useState<Date | null>(null);
  const [widgets, setWidgets] = useState({
    stats: true,
    meta: true,
    robot: true,
    trends: true,
    categories: true,
    audit: true,
    alternate_stats: true,
    chart: true,
  });

  const fetchStats = async () => {
    if (!user) return;
    setLoadingTrends(true);
    try {
      const [articles, trendingTopics, recent, errors, logs, topTrends, categoriesData] = await Promise.all([
        runBackendQuery(() => supabase.from('articles').select('id, status, category').eq('user_id', user.id)),
        runBackendQuery(() => supabase.from('trending_topics').select('id').eq('user_id', user.id).eq('used', false)),
        runBackendQuery(() => supabase.from('articles').select('id, title, category, seo_keyword, status').eq('user_id', user.id).order('created_at', { ascending: false }).limit(5)),
        runBackendQuery(() => supabase.from('publish_log').select('id, article_id, error_message, created_at, status').eq('user_id', user.id).eq('status', 'failed').order('created_at', { ascending: false }).limit(5)),
        runBackendQuery(() => supabase.from('audit_logs').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(10)),
        runBackendQuery(() => supabase.from('trending_topics').select('*').eq('user_id', user.id).eq('used', false).order('fetched_at', { ascending: false }).limit(10)),
        runBackendQuery(() => supabase.from('user_settings').select('categories, dashboard_widgets').eq('user_id', user.id).maybeSingle()),
      ]);

      setTrendingList(topTrends || []);
      setUserCategories(categoriesData?.categories || ['esportes', 'politica', 'policia', 'saude', 'celebridades', 'financas']);
      if (categoriesData?.dashboard_widgets) setWidgets(categoriesData.dashboard_widgets as any);
      setLoadingTrends(false);

      setStats({
        total: articles?.length || 0,
        published: (articles || []).filter((a: any) => a.status === 'published').length,
        pending: (articles || []).filter((a: any) => a.status === 'ready' || a.status === 'draft').length,
        trending: trendingTopics?.length || 0,
        failed: (articles || []).filter((a: any) => a.status === 'failed').length,
      });

      const ALL_CATEGORIES = ['esportes', 'politica', 'policia', 'saude', 'celebridades', 'financas'];
      const byCat: Record<string, any> = {};
      ALL_CATEGORIES.forEach(cat => byCat[cat] = { total: 0, published: 0, pending: 0, failed: 0 });
      (articles || []).forEach((a: any) => {
        const cat = a.category || 'outros';
        if (!byCat[cat]) byCat[cat] = { total: 0, published: 0, pending: 0, failed: 0 };
        byCat[cat].total += 1;
        if (a.status === 'published') byCat[cat].published += 1;
        else if (a.status === 'failed') byCat[cat].failed += 1;
        else byCat[cat].pending += 1;
      });
      setCategoryStats(Object.entries(byCat).map(([category, v]) => ({ category, ...v })).sort((a, b) => b.total - a.total));
      setRecentArticles(recent || []);
      setRecentErrors(errors || []);
      setAuditLogs(logs || []);
    } catch (error) {
      toast({ title: 'Erro ao carregar painel', description: getErrorMessage(error), variant: 'destructive' });
    }
  };

  const fetchMetaMetrics = async () => {
    if (!user) return;
    setLoadingMeta(true);
    try {
      const { data } = await supabase.functions.invoke('fetch-meta-metrics', { body: { userId: user.id } });
      if (data?.pages) setMetaMetrics(data.pages.length > 0 ? data.pages : null);
    } catch (error) { console.error(error); } finally { setLoadingMeta(false); }
  };

  const fetchInteractions = async () => {
    if (!user) return;
    setLoadingInteractions(true);
    try {
      const { data } = await supabase.from('social_interactions').select('*').order('created_at', { ascending: false }).limit(5);
      setInteractions(data || []);
    } catch (error) { console.error(error); } finally { setLoadingInteractions(false); }
  };

  const handleProcessInteractions = async () => {
    if (!user) return;
    setProcessingInteractions(true);
    try {
      await supabase.functions.invoke('handle-social-interactions', { body: { userId: user.id } });
      const { data } = await supabase.functions.invoke('process-social-replies', { body: { userId: user.id } });
      toast({ title: 'Interações processadas', description: `${data?.replied || 0} respostas geradas.` });
      fetchInteractions();
    } catch (error) { toast({ title: 'Erro', description: getErrorMessage(error), variant: 'destructive' }); } finally { setProcessingInteractions(false); }
  };

  useEffect(() => {
    fetchStats();
    fetchMetaMetrics();
    fetchInteractions();
    const fetchIntervalSettings = async () => {
      if (!user) return;
      const { data } = await supabase.from('user_settings').select('metrics_refresh_interval').eq('user_id', user.id).maybeSingle();
      if (data?.metrics_refresh_interval) setRefreshInterval(data.metrics_refresh_interval);
    };
    fetchIntervalSettings();
  }, [user]);

  useEffect(() => {
    if (!user || refreshInterval <= 0) return;
    const intervalMs = refreshInterval * 60 * 1000;
    setNextRefresh(new Date(Date.now() + intervalMs));
    const interval = setInterval(() => { fetchMetaMetrics(); setNextRefresh(new Date(Date.now() + intervalMs)); }, intervalMs);
    return () => clearInterval(interval);
  }, [user, refreshInterval]);

  const handleGenerateArticles = async () => {
    if (!user) return;
    setGenerating(true);
    try {
      const { data } = await supabase.functions.invoke('generate-articles', { body: { userId: user.id } });
      toast({ title: 'Geração iniciada!', description: data?.message || 'Artigos sendo gerados...' });
      setTimeout(fetchStats, 5000);
    } catch (error) { toast({ title: 'Erro ao gerar artigos', description: getErrorMessage(error), variant: 'destructive' }); } finally { setGenerating(false); }
  };

  const handleUpdateCategory = async (articleId: string, newCategory: string) => {
    try {
      await supabase.from('articles').update({ category: newCategory }).eq('id', articleId);
      setRecentArticles(prev => prev.map(a => a.id === articleId ? { ...a, category: newCategory } : a));
      toast({ title: 'Categoria atualizada' });
      fetchStats();
    } catch (error) { toast({ title: 'Erro', description: getErrorMessage(error), variant: 'destructive' }); }
  };

  const statusColors: Record<string, string> = { draft: 'bg-muted', generating: 'bg-warning/20', ready: 'bg-primary/20', published: 'bg-success/20', failed: 'bg-destructive/20' };
  const categoryLabels: Record<string, string> = { esportes: '⚽ Esportes', politica: '🏛️ Política', policia: '🚔 Polícia', saude: '💚 Saúde', celebridades: '⭐ Celebridades', financas: '💰 Finanças' };

  const statCards = [
    { icon: FileText, label: 'Total Artigos', value: stats.total, color: 'text-primary', accent: 'from-primary/10', glow: 'neon-border-lilac' },
    { icon: CheckCircle, label: 'Publicados', value: stats.published, color: 'text-success', accent: 'from-success/10', glow: '' },
    { icon: Clock, label: 'Pendentes', value: stats.pending, color: 'text-warning', accent: 'from-warning/10', glow: '' },
    { icon: TrendingUp, label: 'Tendências', value: stats.trending, color: 'text-accent', accent: 'from-accent/10', glow: 'neon-border-pink' },
  ];

  return (
    <div className="space-y-6 lg:space-y-8 pb-10">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex flex-col">
          <h1 className="text-2xl sm:text-3xl font-bold neon-text-lilac uppercase tracking-tighter">NEURAL VORTEX</h1>
          <div className="flex items-center gap-2 mt-1">
            <p className="text-muted-foreground text-sm">Visão geral e métricas</p>
            {nextRefresh && <Badge variant="outline" className="text-[10px] animate-pulse">Auto-update: {format(nextRefresh, "HH:mm")}</Badge>}
          </div>
        </div>
        <Button onClick={handleGenerateArticles} disabled={generating} className="gradient-primary uppercase tracking-widest text-[10px] h-9 px-6 rounded-none font-bold">
          {generating ? <RefreshCw className="h-3 w-3 mr-2 animate-spin" /> : <Sparkles className="h-3 w-3 mr-2" />}
          Gerar Artigos
        </Button>
      </div>

      <div className="flex justify-end">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="text-[9px] uppercase font-bold tracking-[0.2em] text-muted-foreground/60 hover:text-primary gap-2 h-7">
              <RefreshCw className={cn("h-2.5 w-2.5", loadingMeta && "animate-spin")} />
              Atualizar a cada {refreshInterval} min
              <ChevronDown className="h-2.5 w-2.5 opacity-50" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="glass-card">
            {[5, 10, 15, 30, 60].map((min) => (
              <DropdownMenuItem key={min} onClick={async () => { setRefreshInterval(min); await supabase.from('user_settings').update({ metrics_refresh_interval: min }).eq('user_id', user!.id); }} className={cn("text-xs font-bold uppercase", refreshInterval === min && "bg-primary/10 text-primary")}>
                {min} Minutos
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {widgets.stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {statCards.map((stat, i) => (
            <Card key={stat.label} className={`glass-card hover-lift ${stat.glow} relative overflow-hidden animate-float-up`}>
              <div className={`absolute inset-0 bg-gradient-to-br ${stat.accent} to-transparent opacity-50`} />
              <CardContent className="p-4 sm:p-5 relative">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{stat.label}</p>
                    <p className="text-2xl font-bold mt-1.5 tabular-nums">{stat.value}</p>
                  </div>
                  <div className={`p-2 rounded-lg bg-background/40 ${stat.color}`}><stat.icon className="h-5 w-5" /></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {widgets.alternate_stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-fade-in">
          <Card className="glass-card neon-border-lilac p-6 flex items-center justify-between">
            <div>
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold mb-1">Total de Postagens</p>
              <h4 className="text-3xl font-black tabular-nums">{stats.total}</h4>
              <p className="text-[10px] text-success font-medium mt-1">✓ {stats.published} PUBLICADOS</p>
            </div>
            <div className="h-12 w-12 border border-primary/30 flex items-center justify-center bg-primary/5"><FileText className="h-6 w-6 text-primary" /></div>
          </Card>
          <Card className="glass-card neon-border-pink p-6 flex items-center justify-between">
            <div>
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold mb-1">Agendamentos Ativos</p>
              <h4 className="text-3xl font-black tabular-nums">{stats.pending}</h4>
              <p className="text-[10px] text-warning font-medium mt-1">🕒 AGUARDANDO PUBLICAÇÃO</p>
            </div>
            <div className="h-12 w-12 border border-accent/30 flex items-center justify-center bg-accent/5"><Clock className="h-6 w-6 text-accent" /></div>
          </Card>
        </div>
      )}

      {widgets.meta && metaMetrics && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 animate-fade-in">
          {metaMetrics.map((pg: any, idx: number) => (
            <div key={pg.page_id || idx} className="glass-card hover-lift p-6 flex flex-col items-center relative overflow-hidden group">
              <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-primary to-transparent opacity-50" />
              <div className="h-20 w-20 rounded-full border-2 border-primary/40 p-1 bg-background mb-4 overflow-hidden shadow-neon-lilac">
                {pg.facebook?.picture?.data?.url ? <img src={pg.facebook.picture.data.url} className="h-full w-full rounded-full object-cover" alt="" /> : <Facebook className="h-10 w-10 text-primary m-4" />}
              </div>
              <h3 className="text-lg font-bold text-center mb-4 uppercase tracking-tighter line-clamp-1">{pg.page_name}</h3>
              <div className="grid grid-cols-2 gap-4 w-full mb-5 text-[10px] uppercase text-muted-foreground font-bold">
                <div className="flex flex-col items-center">
                  <span className="text-foreground text-sm font-black">{(pg.facebook?.followers_count || 0).toLocaleString()}</span>
                  <span>Seguidores</span>
                </div>
                <div className="flex flex-col items-center">
                  <span className="text-foreground text-sm font-black">{(pg.facebook?.fan_count || 0).toLocaleString()}</span>
                  <span>Curtidas</span>
                </div>
              </div>
              <Button variant="outline" size="sm" className="w-full text-[10px] uppercase font-bold tracking-widest rounded-none border-primary/30" onClick={() => { setSelectedPageForMetrics(pg.page_id); setIsMetricsModalOpen(true); }}>
                Ver métricas
              </Button>
            </div>
          ))}
        </div>
      )}

      <Dialog open={isMetricsModalOpen} onOpenChange={setIsMetricsModalOpen}>
        <DialogContent className="max-w-7xl h-[90vh] glass-card p-0 sm:p-6 overflow-y-auto">
          <DialogHeader className="p-6 sm:p-0">
            <div className="flex items-center justify-between">
              <DialogTitle className="text-2xl font-bold neon-text-lilac uppercase tracking-tighter">Métricas da Página</DialogTitle>
              <DialogClose className="opacity-70 hover:opacity-100"><X className="h-6 w-6" /></DialogClose>
            </div>
          </DialogHeader>
          <AnalyticsPage isModal={true} pageId={selectedPageForMetrics} />
        </DialogContent>
      </Dialog>

      {widgets.robot && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-fade-in">
          <Card className="glass-card neon-border-lilac overflow-hidden">
            <CardHeader className="pb-3 border-b border-white/5 flex flex-row items-center justify-between">
              <div className="flex items-center gap-2">
                <Bot className="h-5 w-5 text-primary" />
                <CardTitle className="text-lg uppercase tracking-tighter">Robô Social Humano</CardTitle>
              </div>
              <Button size="sm" onClick={handleProcessInteractions} disabled={processingInteractions} className="gradient-primary h-7 px-3 text-[10px] font-bold uppercase tracking-widest rounded-none">
                {processingInteractions ? <RefreshCw className="h-3 w-3 mr-2 animate-spin" /> : <UserCheck className="h-3 w-3 mr-2" />}
                Responder
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-white/5">
                {interactions.length > 0 ? interactions.map(item => (
                  <div key={item.id} className="p-3 hover:bg-white/5 transition-colors flex items-center justify-between gap-3 min-w-0">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="shrink-0 h-8 w-8 rounded-full border border-[hsl(200_100%_60%)]/20 bg-background flex items-center justify-center text-[hsl(200_100%_60%)] text-[10px] font-bold overflow-hidden">
                        {item.author_avatar ? <img src={item.author_avatar} alt="" /> : item.author_name?.[0]?.toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-black text-[hsl(200_100%_60%)] uppercase truncate max-w-[120px]">{item.author_name}</span>
                          <Badge variant="outline" className="text-[7px] h-3 px-1 border-[hsl(200_100%_60%)]/20 text-[hsl(200_100%_60%)] opacity-70 uppercase shrink-0">{item.platform}</Badge>
                        </div>
                        <p className="text-[11px] italic truncate opacity-80">"{item.content}"</p>
                      </div>
                    </div>
                    <Badge variant="outline" className="text-[8px] font-bold border-success/30 text-success shrink-0 px-1.5 h-5">RESOLVIDO</Badge>
                  </div>
                )) : <div className="p-10 text-center text-muted-foreground text-xs uppercase opacity-50">Nenhuma interação</div>}
              </div>
              {interactions.length > 0 && (
                <div className="p-3 border-t border-white/5">
                  <Button variant="ghost" size="sm" onClick={() => navigate('/robot')} className="w-full text-[10px] font-bold uppercase tracking-widest text-primary gap-2">
                    Ver todas <ArrowRight className="h-3 w-3" />
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
          <AIProvidersPanel />
        </div>
      )}

      {widgets.trends && (
        <Card className="glass-card neon-border-lilac">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg uppercase tracking-tighter">Google Trends Brasil 🇧🇷</CardTitle>
            </div>
            <Button variant="ghost" size="sm" onClick={() => navigate('/trends')} className="text-xs h-7 uppercase font-bold tracking-widest text-primary">Ver tudo</Button>
          </CardHeader>
          <CardContent>
            {loadingTrends ? <div className="flex justify-center py-8"><RefreshCw className="h-6 w-6 animate-spin text-primary" /></div> : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {trendingList.slice(0, 6).map(t => (
                  <div key={t.id} className="p-3 rounded-none bg-secondary/20 border border-primary/10 hover:border-primary/30 transition-colors">
                    <span className="text-sm font-bold uppercase tracking-tighter">{t.topic}</span>
                    <Badge variant="outline" className="ml-2 text-[9px] h-3.5 border-primary/20 text-primary">{t.category}</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {widgets.categories && (
        <Card className="glass-card neon-border-pink">
          <CardHeader><CardTitle className="text-lg uppercase tracking-tighter flex items-center gap-2"><TrendingUp className="h-5 w-5 text-accent" />Métricas por Categoria</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {categoryStats.map(c => {
                const pct = stats.total > 0 ? Math.round((c.total / stats.total) * 100) : 0;
                return (
                  <div key={c.category} className="p-4 bg-secondary/30 border border-border/40 animate-float-up">
                    <div className="flex justify-between mb-2">
                      <span className="text-sm font-bold uppercase tracking-tighter truncate">{categoryLabels[c.category] || c.category}</span>
                      <Badge variant="secondary" className="bg-primary/15 text-primary text-[10px]">{pct}%</Badge>
                    </div>
                    <p className="text-2xl font-bold tabular-nums mb-3">{c.total}</p>
                    <div className="h-1.5 w-full bg-background/50 overflow-hidden mb-3"><div className="h-full gradient-primary" style={{ width: `${pct}%` }} /></div>
                    <div className="flex justify-between text-[11px] font-bold uppercase tracking-widest">
                      <span className="text-success">{c.published} OK</span>
                      <span className="text-warning">{c.pending} WAIT</span>
                      <span className="text-destructive">{c.failed} FAIL</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {widgets.audit && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-fade-in">
          <Card className="glass-card">
            <CardHeader className="pb-2 flex flex-row items-center gap-2"><Clock className="h-5 w-5 text-primary" /><CardTitle className="text-lg uppercase tracking-tighter">Logs de Auditoria</CardTitle></CardHeader>
            <CardContent className="space-y-3 p-4">
              {auditLogs.length > 0 ? auditLogs.map(log => (
                <div key={log.id} className="p-3 bg-background/40 border border-border/50 text-[10px] font-bold uppercase tracking-widest flex flex-col gap-1">
                  <div className="flex justify-between">
                    <span className="text-primary">{log.action.replace(/_/g, ' ')}</span>
                    <span className="text-muted-foreground">{format(new Date(log.created_at), "dd/MM HH:mm")}</span>
                  </div>
                  <p className="text-muted-foreground font-normal normal-case">{log.details?.reason || 'Ação concluída'}</p>
                </div>
              )) : <p className="p-4 text-center text-muted-foreground opacity-50">Sem logs</p>}
            </CardContent>
          </Card>
          <Card className="glass-card border-destructive/20">
            <CardHeader className="pb-2 flex flex-row items-center gap-2"><div className="h-3 w-3 rounded-full bg-destructive" /><CardTitle className="text-lg uppercase tracking-tighter">Falhas Recentes</CardTitle></CardHeader>
            <CardContent className="space-y-3 p-4">
              {recentErrors.length > 0 ? recentErrors.map(err => (
                <div key={err.id} className="p-3 bg-destructive/5 border border-destructive/10">
                  <p className="text-xs text-destructive font-bold line-clamp-2 uppercase tracking-tighter">{err.error_message || 'Erro no WordPress'}</p>
                  <p className="text-[10px] text-muted-foreground mt-1">{new Date(err.created_at).toLocaleString()}</p>
                </div>
              )) : <p className="p-4 text-center text-muted-foreground opacity-50">Sem falhas</p>}
            </CardContent>
          </Card>
        </div>
      )}

      <Card className="glass-card">
        <CardHeader><CardTitle className="text-lg uppercase tracking-tighter">Artigos Recentes</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-2.5">
            {recentArticles.map((article, idx) => (
              <div key={article.id} className="flex items-center justify-between p-3 sm:p-4 bg-secondary/30 hover:bg-secondary/60 hover:translate-x-1 transition-all animate-float-up" style={{ animationDelay: `${idx * 40}ms` }}>
                <div className="min-w-0 flex-1">
                  <p className="font-bold uppercase tracking-tighter text-sm sm:text-base truncate">{article.title}</p>
                  <div className="flex items-center gap-1.5 mt-1">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground cursor-pointer hover:text-primary transition-colors flex items-center gap-1">
                          {categoryLabels[article.category] || article.category} <ChevronDown className="h-2.5 w-2.5" />
                        </span>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start" className="max-h-[250px] overflow-y-auto">
                        {userCategories.map(cat => (
                          <DropdownMenuItem key={cat} onClick={() => handleUpdateCategory(article.id, cat)} className={`capitalize text-xs font-bold ${article.category === cat ? 'bg-primary/10 text-primary' : ''}`}>
                            {categoryLabels[cat] || cat}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                    <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">• {article.seo_keyword || 'Sem keyword'}</span>
                  </div>
                </div>
                <Badge className={`${statusColors[article.status] || ''} text-[10px] font-bold uppercase tracking-widest rounded-none border-primary/20 text-primary`} variant="outline">{article.status}</Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Dashboard;
