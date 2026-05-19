import { useEffect, useState, useMemo, Suspense, lazy } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { monitorPerformance, withCache } from '@/lib/performance';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  FileText, TrendingUp, CheckCircle, Clock, Sparkles, RefreshCw, ChevronDown, Facebook, Instagram, ExternalLink, BarChart3, X, Eye, MessageSquare, Bot, UserCheck, ArrowRight
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
  const [allArticles, setAllArticles] = useState<any[]>([]);
  const [recentArticles, setRecentArticles] = useState<any[]>([]);
  const [recentErrors, setRecentErrors] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [categoryStats, setCategoryStats] = useState<any[]>([]);
  const [generating, setGenerating] = useState(false);
  const [trendingList, setTrendingList] = useState<any[]>([]);
  const [trendingFilter, setTrendingFilter] = useState<"all" | "BR" | "World">("all");
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
  const [widgetOrder, setWidgetOrder] = useState<string[]>(['stats', 'alternate_stats', 'chart', 'meta', 'robot', 'trends', 'categories', 'audit']);

  const fetchStats = async (forceRefresh = false) => {
    if (!user) return;
    setLoadingTrends(true);
    
    try {
      const dashboardData = await monitorPerformance('Dashboard Full Load', async () => {
        const cacheKey = `dashboard_stats_${user.id}`;
        
        // Use cache for 60 seconds if not force refreshing
        return withCache(cacheKey, forceRefresh ? 0 : 60, async () => {
          const [articles, trendingTopics, recent, errors, logs, topTrends, categoriesData] = await Promise.all([
            supabase.from('articles').select('id, status, category, created_at').eq('user_id', user.id),
            supabase.from('trending_topics').select('id').eq('user_id', user.id).eq('used', false),
            supabase.from('articles').select('id, title, category, seo_keyword, status').eq('user_id', user.id).order('created_at', { ascending: false }).limit(5),
            supabase.from('publish_log').select('id, article_id, error_message, created_at, status').eq('user_id', user.id).eq('status', 'failed').order('created_at', { ascending: false }).limit(5),
            supabase.from('audit_logs').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(10),
            supabase.from('trending_topics').select('*').eq('user_id', user.id).eq('used', false).order('fetched_at', { ascending: false }).limit(10),
            supabase.from('user_settings').select('categories, dashboard_widgets, dashboard_order').eq('user_id', user.id).maybeSingle(),
          ]);

          return {
            articles: articles.data || [],
            trendingTopics: trendingTopics.data || [],
            recent: recent.data || [],
            errors: errors.data || [],
            logs: logs.data || [],
            topTrends: topTrends.data || [],
            settings: categoriesData.data
          };
        });
      });

      const { articles, trendingTopics, recent: data_recent, errors: data_errors, logs: data_logs, topTrends: data_topTrends, settings: data_settings } = dashboardData;

      setTrendingList(data_topTrends);
      setAllArticles(articles);
      setUserCategories(data_settings?.categories || ['esportes', 'politica', 'policia', 'saude', 'celebridades', 'financas']);
      if (data_settings?.dashboard_widgets) setWidgets(data_settings.dashboard_widgets as any);
      if (data_settings?.dashboard_order) setWidgetOrder(data_settings.dashboard_order as string[]);
      setLoadingTrends(false);

      setStats({
        total: articles.length,
        published: articles.filter((a: any) => a.status === 'published').length,
        pending: articles.filter((a: any) => a.status === 'ready' || a.status === 'draft').length,
        trending: trendingTopics.length,
        failed: articles.filter((a: any) => a.status === 'failed').length,
      });

      const ALL_CATEGORIES = ['esportes', 'politica', 'policia', 'saude', 'celebridades', 'financas'];
      const byCat: Record<string, any> = {};
      ALL_CATEGORIES.forEach(cat => byCat[cat] = { total: 0, published: 0, pending: 0, failed: 0 });
      articles.forEach((a: any) => {
        const cat = a.category || 'outros';
        if (!byCat[cat]) byCat[cat] = { total: 0, published: 0, pending: 0, failed: 0 };
        byCat[cat].total += 1;
        if (a.status === 'published') byCat[cat].published += 1;
        else if (a.status === 'failed') byCat[cat].failed += 1;
        else byCat[cat].pending += 1;
      });
      setCategoryStats(Object.entries(byCat).map(([category, v]) => ({ category, ...v })).sort((a, b) => b.total - a.total));
      setRecentArticles(data_recent);
      setRecentErrors(data_errors);
      setAuditLogs(data_logs);
    } catch (error) {
      toast({ title: 'Erro ao carregar painel', description: getErrorMessage(error), variant: 'destructive' });
    }
  };

  const fetchMetaMetrics = async (forceRefresh = false) => {
    if (!user) return;
    setLoadingMeta(true);
    try {
      const data = await monitorPerformance('Fetch Meta Metrics', async () => {
        const cacheKey = `meta_metrics_${user.id}`;
        return withCache(cacheKey, forceRefresh ? 0 : 300, async () => {
          const { data } = await supabase.functions.invoke('fetch-meta-metrics', { body: { userId: user.id } });
          return data;
        });
      });
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
    // Delay non-essential social metrics to prioritize core dashboard loading
    setTimeout(() => {
      fetchMetaMetrics();
      fetchInteractions();
    }, 1000);
    const fetchIntervalSettings = async () => {
      if (!user) return;
      const { data } = await supabase.from('user_settings').select('metrics_refresh_interval').eq('user_id', user.id).maybeSingle();
      if (data?.metrics_refresh_interval) setRefreshInterval(data.metrics_refresh_interval);
    };
    fetchIntervalSettings();

    const articlesSubscription = supabase
      .channel('articles-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'articles', filter: `user_id=eq.${user.id}` }, () => fetchStats())
      .subscribe();

    return () => { supabase.removeChannel(articlesSubscription); };
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
    { icon: FileText, label: 'Total de Artigos', value: stats.total, color: 'text-primary', accent: 'from-primary/10', glow: 'neon-border-lilac' },
    { icon: CheckCircle, label: 'Publicados', value: stats.published, color: 'text-success', accent: 'from-success/10', glow: '' },
    { icon: Clock, label: 'Pendentes', value: stats.pending, color: 'text-warning', accent: 'from-warning/10', glow: '' },
    { icon: TrendingUp, label: 'Tendências', value: stats.trending, color: 'text-accent', accent: 'from-accent/10', glow: 'neon-border-pink' },
  ];
  
  const chartData = useMemo(() => {
    if (!allArticles.length) return [];
    const last7Days = Array.from({ length: 7 }, (_, i) => startOfDay(subDays(new Date(), i))).reverse();
    return last7Days.map(day => ({
      name: format(day, 'dd/MM'),
      posts: allArticles.filter(a => isSameDay(new Date(a.created_at), day)).length
    }));
  }, [allArticles]);

  const customTooltipStyle = {
    backgroundColor: 'hsl(230, 25%, 6%)',
    border: '1px solid hsl(230, 20%, 20%)',
    borderRadius: '0px',
    color: 'hsl(210, 20%, 98%)',
  };

  return (
    <div className="space-y-6 lg:space-y-8 pb-10">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex flex-col">
          <h1 className="text-2xl sm:text-3xl font-bold neon-text-lilac uppercase tracking-tighter">NEURAL VORTEX</h1>
          <div className="flex items-center gap-2 mt-1">
            <p className="text-muted-foreground text-sm">Visão geral e métricas</p>
            {nextRefresh && <Badge variant="outline" className="text-[10px] animate-pulse">Auto-atualização: {format(nextRefresh, "HH:mm")}</Badge>}
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

      <Suspense fallback={<div className="flex flex-col gap-6 animate-pulse"><div className="h-24 bg-secondary/20 rounded-lg" /><div className="h-48 bg-secondary/20 rounded-lg" /></div>}>
      <div className="flex flex-col gap-6 lg:gap-8">
        {widgetOrder.map((widgetId) => {
          if (widgetId === 'stats' && widgets.stats) {
            return (
              <div key="stats" className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                {statCards.map((stat) => (
                  <Card key={stat.label} className={`glass-card hover-lift ${stat.glow} relative overflow-hidden animate-float-up`}>
                    <div className={`absolute inset-0 bg-gradient-to-br ${stat.accent} to-transparent opacity-50`} />
                    <CardContent className="p-4 sm:p-5 relative">
                      <div className="flex items-start justify-between">
                        <div><p className="text-[11px] uppercase tracking-wider text-muted-foreground">{stat.label}</p><p className="text-2xl font-bold mt-1.5 tabular-nums">{stat.value}</p></div>
                        <div className={`p-2 rounded-lg bg-background/40 ${stat.color}`}><stat.icon className="h-5 w-5" /></div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            );
          }
          if (widgetId === 'alternate_stats' && widgets.alternate_stats) {
            return (
              <div key="alternate_stats" className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-fade-in">
                <Card className="glass-card neon-border-lilac p-6 flex items-center justify-between"><div><p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold mb-1">Total de Postagens</p><h4 className="text-3xl font-black tabular-nums">{stats.total}</h4><p className="text-[10px] text-accent font-medium mt-1">✓ {stats.published} PUBLICADOS</p></div><div className="h-12 w-12 border border-primary/30 flex items-center justify-center bg-primary/5"><FileText className="h-6 w-6 text-primary" /></div></Card>
                <Card className="glass-card neon-border-pink p-6 flex items-center justify-between"><div><p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold mb-1">Agendamentos Ativos</p><h4 className="text-3xl font-black tabular-nums">{stats.pending}</h4><p className="text-[10px] text-warning font-medium mt-1">🕒 AGUARDANDO PUBLICAÇÃO</p></div><div className="h-12 w-12 border border-accent/30 flex items-center justify-center bg-accent/5"><Clock className="h-6 w-6 text-accent" /></div></Card>
              </div>
            );
          }
          if (widgetId === 'chart' && widgets.chart) {
            return (
              <Suspense key="chart" fallback={<div className="h-[300px] animate-pulse bg-secondary/20 rounded-lg" />}>
                <Card className="glass-card neon-border-lilac animate-fade-in overflow-hidden">
                  <CardHeader className="pb-2 flex flex-row items-center justify-between"><div className="flex items-center gap-2"><BarChart3 className="h-5 w-5 text-primary" /><CardTitle className="text-lg uppercase tracking-tighter">Volume de Artigos (7d)</CardTitle></div><Badge variant="outline" className="text-[10px] uppercase font-bold tracking-widest border-primary/20 text-primary">Atividade Recente</Badge></CardHeader>
                  <CardContent className="pt-4"><div className="h-[250px] w-full"><ResponsiveContainer width="100%" height="100%"><AreaChart data={chartData}><defs><linearGradient id="colorPosts" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="hsl(260, 100%, 70%)" stopOpacity={0.3}/><stop offset="95%" stopColor="hsl(260, 100%, 70%)" stopOpacity={0}/></linearGradient></defs><CartesianGrid strokeDasharray="3 3" stroke="hsl(230, 20%, 15%)" vertical={false} /><XAxis dataKey="name" fontSize={10} stroke="hsl(260, 10%, 45%)" tickLine={false} axisLine={false} dy={10} /><YAxis fontSize={10} stroke="hsl(260, 10%, 45%)" tickLine={false} axisLine={false} tickFormatter={(value) => `${value}`} /><Tooltip contentStyle={customTooltipStyle} cursor={{ stroke: 'hsl(260, 100%, 70%)', strokeWidth: 1 }} /><Area type="monotone" dataKey="posts" name="Artigos" stroke="hsl(260, 100%, 70%)" fillOpacity={1} fill="url(#colorPosts)" strokeWidth={3} animationDuration={1500} /></AreaChart></ResponsiveContainer></div></CardContent>
                </Card>
              </Suspense>
            );
          }
          if (widgetId === 'meta' && widgets.meta && metaMetrics) {
            return (
              <Suspense key="meta" fallback={<div className="h-[200px] animate-pulse bg-secondary/20 rounded-lg" />}>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 animate-fade-in">
                  {metaMetrics.map((pg: any, idx: number) => (
                    <div key={pg.page_id || idx} className="glass-card hover-lift p-5 flex flex-col relative overflow-hidden group">
                      <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-primary to-transparent opacity-50" />
                      <div className="flex items-center gap-3 mb-4">
                        <div className="h-14 w-14 rounded-full border-2 border-primary/40 p-0.5 bg-background overflow-hidden shadow-neon-lilac shrink-0">{pg.facebook?.picture?.data?.url ? <img src={pg.facebook.picture.data.url} className="h-full w-full rounded-full object-cover" alt="" /> : pg.instagram?.profile_picture_url ? <img src={pg.instagram.profile_picture_url} className="h-full w-full rounded-full object-cover" alt="" /> : <div className="h-full w-full rounded-full bg-secondary flex items-center justify-center">{pg.instagram ? <Instagram className="h-6 w-6 text-accent" /> : <Facebook className="h-6 w-6 text-primary" />}</div>}</div><div className="min-w-0 flex-1"><h3 className="text-sm font-black uppercase tracking-tighter truncate leading-tight">{pg.page_name}</h3><div className="flex items-center gap-2 mt-1"><Facebook className="h-3 w-3 text-primary" /><span className="text-[9px] font-black text-muted-foreground uppercase">Conectado</span>{pg.instagram && <><div className="h-1 w-1 rounded-full bg-muted-foreground/30" /><Instagram className="h-3 w-3 text-accent" /><span className="text-[9px] font-black text-muted-foreground uppercase">IG Ativo</span></>}</div></div></div><div className="grid grid-cols-1 gap-2.5 mb-5"><div className="bg-primary/5 border border-primary/10 p-3 flex items-center justify-between"><div className="flex items-center gap-2"><div className="p-1.5 bg-primary/10 rounded-sm"><Facebook className="h-3.5 w-3.5 text-primary" /></div><div><p className="text-[8px] uppercase tracking-widest text-muted-foreground font-bold">Facebook</p><p className="text-xs font-black uppercase tracking-tighter">Página Meta</p></div></div><div className="text-right"><p className="text-sm font-black tabular-nums">{(pg.facebook?.followers_count || pg.facebook?.fan_count || 0).toLocaleString()}</p><p className="text-[7px] uppercase font-bold text-muted-foreground">Seguidores</p></div></div>{pg.instagram ? <div className="bg-accent/5 border border-accent/10 p-3 flex items-center justify-between"><div className="flex items-center gap-2"><div className="p-1.5 bg-accent/10 rounded-sm"><Instagram className="h-3.5 w-3.5 text-accent" /></div><div><p className="text-[8px] uppercase tracking-widest text-muted-foreground font-bold">Instagram</p><p className="text-xs font-black uppercase tracking-tighter">@{pg.instagram.username || 'perfil'}</p></div></div><div className="text-right"><p className="text-sm font-black tabular-nums">{(pg.instagram.followers_count || 0).toLocaleString()}</p><p className="text-[7px] uppercase font-bold text-muted-foreground">Seguidores IG</p></div></div> : <div className="bg-muted/5 border border-dashed border-muted-foreground/20 p-3 flex items-center justify-center"><p className="text-[8px] uppercase font-bold text-muted-foreground opacity-50">Sem Instagram conectado</p></div>}</div><div className="grid grid-cols-2 gap-2 mt-auto"><Button variant="outline" size="sm" className="h-8 text-[9px] uppercase font-black tracking-widest rounded-none border-primary/20 hover:bg-primary/5" onClick={() => navigate(`/analytics?page=${pg.page_id}`)}><BarChart3 className="h-3 w-3 mr-1.5" /> Métricas</Button><Button variant="outline" size="sm" className="h-8 text-[9px] uppercase font-black tracking-widest rounded-none border-accent/20 hover:bg-accent/5" onClick={() => window.open(pg.facebook?.link || `https://facebook.com/${pg.page_id}`, '_blank')}><ExternalLink className="h-3 w-3 mr-1.5" /> Visitar</Button></div></div>
                  ))}
                </div>
              </Suspense>
            );
          }
          if (widgetId === 'robot' && widgets.robot) {
            return (
              <Suspense key="robot" fallback={<div className="h-[200px] animate-pulse bg-secondary/20 rounded-lg" />}>
                <div key="robot" className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-fade-in">
                  <Card className="glass-card neon-border-lilac overflow-hidden"><CardHeader className="pb-3 border-b border-white/5 flex flex-row items-center justify-between"><div className="flex items-center gap-2"><Bot className="h-5 w-5 text-primary" /><CardTitle className="text-lg uppercase tracking-tighter">Robô Social Humano</CardTitle></div><Button size="sm" onClick={handleProcessInteractions} disabled={processingInteractions} className="gradient-primary h-7 px-3 text-[10px] font-bold uppercase tracking-widest rounded-none">{processingInteractions ? <RefreshCw className="h-3 w-3 mr-2 animate-spin" /> : <UserCheck className="h-3 w-3 mr-2" />} Responder</Button></CardHeader><CardContent className="p-0"><div className="divide-y divide-white/5">{interactions.length > 0 ? interactions.map(item => (<div key={item.id} className="p-3 hover:bg-white/5 transition-colors flex items-center justify-between gap-3 min-w-0"><div className="flex items-center gap-3 min-w-0 flex-1"><div className="shrink-0 h-8 w-8 rounded-full border border-[hsl(200_100%_60%)]/20 bg-background flex items-center justify-center text-[hsl(200_100%_60%)] text-[10px] font-bold overflow-hidden">{item.author_avatar ? <img src={item.author_avatar} alt="" /> : item.author_name?.[0]?.toUpperCase()}</div><div className="min-w-0 flex-1"><div className="flex items-center gap-2"><span className="text-[10px] font-black text-[hsl(200_100%_60%)] uppercase truncate max-w-[120px]">{item.author_name}</span><Badge variant="outline" className="text-[7px] h-3 px-1 border-[hsl(200_100%_60%)]/20 text-[hsl(200_100%_60%)] opacity-70 uppercase shrink-0">{item.platform}</Badge></div><p className="text-[11px] italic truncate opacity-80">"{item.content}"</p></div></div><Badge variant="outline" className="text-[8px] font-bold border-success/30 text-success shrink-0 px-1.5 h-5">RESOLVIDO</Badge></div>)) : <div className="p-10 text-center text-muted-foreground text-xs uppercase opacity-50">Nenhuma interação</div>}</div>{interactions.length > 0 && (<div className="p-3 border-t border-white/5"><Button variant="ghost" size="sm" onClick={() => navigate('/robot')} className="w-full text-[10px] font-bold uppercase tracking-widest text-primary gap-2">Ver todas <ArrowRight className="h-3 w-3" /></Button></div>)}</CardContent></Card>
                  <AIProvidersPanel />
                </div>
              </Suspense>
            );
          }
          if (widgetId === 'trends' && widgets.trends) {
            return (
              <Suspense key="trends" fallback={<div className="h-[150px] animate-pulse bg-secondary/20 rounded-lg" />}>
                <Card className="glass-card neon-border-lilac"><CardHeader className="flex flex-row items-center justify-between pb-2"><div className="flex items-center gap-2"><TrendingUp className="h-5 w-5 text-primary" /><CardTitle className="text-lg uppercase tracking-tighter">Google Trends 🇧🇷🌎</CardTitle></div><div className="flex items-center gap-2"><div className="hidden sm:flex bg-background/50 border border-white/10 p-0.5"><Button variant="ghost" size="sm" onClick={() => setTrendingFilter('all')} className={`h-6 text-[9px] px-2 rounded-none ${trendingFilter === 'all' ? 'bg-primary text-primary-foreground' : 'hover:bg-white/5'}`}>Tudo</Button><Button variant="ghost" size="sm" onClick={() => setTrendingFilter('BR')} className={`h-6 text-[9px] px-2 rounded-none ${trendingFilter === 'BR' ? 'bg-primary text-primary-foreground' : 'hover:bg-white/5'}`}>Brasil 🇧🇷</Button><Button variant="ghost" size="sm" onClick={() => setTrendingFilter('World')} className={`h-6 text-[9px] px-2 rounded-none ${trendingFilter === 'World' ? 'bg-primary text-primary-foreground' : 'hover:bg-white/5'}`}>Mundo 🌎</Button></div><Button variant="ghost" size="sm" onClick={() => navigate('/trends')} className="text-xs h-7 uppercase font-bold tracking-widest text-primary">Ver tudo</Button></div></CardHeader><CardContent>{loadingTrends ? <div className="flex justify-center py-8"><RefreshCw className="h-6 w-6 animate-spin text-primary" /></div> : (<div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">{trendingList.filter(t => { if (trendingFilter === 'all') return true; const isWorld = t.source_name?.includes('US') || t.source_name?.includes('Global') || t.source_name?.includes('Mundo'); return trendingFilter === 'World' ? isWorld : !isWorld; }).slice(0, 6).map(t => (<div key={t.id} className="p-3 rounded-none bg-secondary/20 border border-primary/10 hover:border-primary/30 transition-colors"><span className="text-sm font-bold uppercase tracking-tighter">{t.topic}</span><Badge variant="outline" className="ml-2 text-[9px] h-3.5 border-primary/20 text-primary">{t.category}</Badge></div>))}</div>)}</CardContent></Card>
              </Suspense>
            );
          }
          if (widgetId === 'categories' && widgets.categories) {
            return (
              <Suspense key="categories" fallback={<div className="h-[200px] animate-pulse bg-secondary/20 rounded-lg" />}>
                <Card className="glass-card neon-border-pink"><CardHeader><CardTitle className="text-lg uppercase tracking-tighter flex items-center gap-2"><TrendingUp className="h-5 w-5 text-accent" />Métricas por Categoria</CardTitle></CardHeader><CardContent><div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">{categoryStats.map(c => { const pct = stats.total > 0 ? Math.round((c.total / stats.total) * 100) : 0; return (<div key={c.category} className="p-4 bg-secondary/30 border border-primary/10 glass-card animate-float-up"><div className="flex justify-between mb-2"><span className="text-sm font-bold uppercase tracking-tighter truncate">{categoryLabels[c.category] || c.category}</span><Badge variant="secondary" className="bg-primary/15 text-primary text-[10px]">{pct}%</Badge></div><p className="text-2xl font-bold tabular-nums mb-3">{c.total}</p><div className="h-1.5 w-full bg-background/50 overflow-hidden mb-3"><div className="h-full gradient-primary" style={{ width: `${pct}%` }} /></div><div className="flex justify-between text-[11px] font-bold uppercase tracking-widest"><span className="text-success">{c.published} OK</span><span className="text-warning">{c.pending} WAIT</span><span className="text-destructive">{c.failed} ERR</span></div></div>); })}</div></CardContent></Card>
              </Suspense>
            );
          }
          if (widgetId === 'audit' && widgets.audit) {
            return (
              <Suspense key="audit" fallback={<div className="h-[200px] animate-pulse bg-secondary/20 rounded-lg" />}>
                <div key="audit" className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-fade-in"><Card key="audit-logs" className="glass-card"><CardHeader className="pb-2 flex flex-row items-center gap-2"><Clock className="h-5 w-5 text-primary" /><CardTitle className="text-lg uppercase tracking-tighter">Logs de Auditoria</CardTitle></CardHeader><CardContent className="space-y-3 p-4">{auditLogs.length > 0 ? auditLogs.map(log => (<div key={log.id} className="p-3 bg-background/40 border border-primary/10 glass-card text-[10px] font-bold uppercase tracking-widest flex flex-col gap-1 hover:translate-x-1 transition-transform"><div className="flex justify-between"><span className="text-primary">{log.action.replace(/_/g, ' ')}</span><span className="text-muted-foreground">{format(new Date(log.created_at), "dd/MM HH:mm")}</span></div><p className="text-muted-foreground font-normal normal-case">{log.details?.reason || 'Ação concluída'}</p></div>)) : <p className="p-4 text-center text-muted-foreground opacity-50">Sem logs</p>}</CardContent></Card><Card key="recent-errors" className="glass-card border-destructive/20"><CardHeader className="pb-2 flex flex-row items-center gap-2"><div className="h-3 w-3 rounded-full bg-destructive" /><CardTitle className="text-lg uppercase tracking-tighter">Falhas Recentes</CardTitle></CardHeader><CardContent className="space-y-3 p-4">{recentErrors.length > 0 ? recentErrors.map(err => (<div key={err.id} className="p-3 bg-destructive/5 border border-destructive/10"><p className="text-xs text-destructive font-bold line-clamp-2 uppercase tracking-tighter">{err.error_message || 'Erro no WordPress'}</p><p className="text-[10px] text-muted-foreground mt-1">{new Date(err.created_at).toLocaleString()}</p></div>)) : <p className="p-4 text-center text-muted-foreground opacity-50">Sem falhas</p>}</CardContent></Card></div>
              </Suspense>
            );
          }
          return null;
        })}
      </div>

      <div className="mt-8 animate-fade-in">
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
                        <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground cursor-pointer hover:text-primary transition-colors flex items-center gap-1">{categoryLabels[article.category] || article.category} <ChevronDown className="h-2.5 w-2.5" /></span>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start" className="max-h-[250px] overflow-y-auto">
                        {userCategories.map(cat => (<DropdownMenuItem key={cat} onClick={() => handleUpdateCategory(article.id, cat)} className={`capitalize text-xs font-bold ${article.category === cat ? 'bg-primary/10 text-primary' : ''}`}>{categoryLabels[cat] || cat}</DropdownMenuItem>))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                    <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">• {article.seo_keyword || 'Sem palavra-chave'}</span>
                  </div>
                </div>
                <Badge className={`${statusColors[article.status] || ''} text-[10px] font-bold uppercase tracking-widest rounded-none border-primary/20 text-primary`} variant="outline">{article.status}</Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
      </div>
    </div>
  );
};

export default Dashboard;