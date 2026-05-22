import { useEffect, useState, useMemo } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Loader2, RefreshCw, MessageSquare, Bot, UserCheck, ExternalLink, History, ThumbsUp, AtSign, Power, PowerOff, Activity, AlertCircle, Info, Instagram, ChevronRight, ChevronDown as ChevronDownIcon, TrendingUp, FileText, UserPlus, UserMinus, ShieldCheck } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { getErrorMessage } from '@/lib/backend';
import { format, parseISO, startOfDay, eachDayOfInterval, addDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area, Legend } from 'recharts';

const SocialRobotPage = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [interactions, setInteractions] = useState<any[]>([]);
  const [metrics, setMetrics] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMetrics, setLoadingMetrics] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [automationEnabled, setAutomationEnabled] = useState(false);
  const [followerGrowthMode, setFollowerGrowthMode] = useState(true);
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [growthSettings, setGrowthSettings] = useState({
    followsMin: 2,
    followsMax: 8,
    durationMin: 6,
    durationMax: 10,
    humanLike: true
  });
  const [logs, setLogs] = useState<any[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [activeTab, setActiveTab] = useState<'interactions' | 'metrics' | 'telemetry' | 'growth' | 'settings'>('telemetry');
  const [invitedFollowers, setInvitedFollowers] = useState<any[]>([]);
  const [activeFollows, setActiveFollows] = useState<any[]>([]);
  const [loadingInvited, setLoadingInvited] = useState(false);
  const [compactMode, setCompactMode] = useState(true);
  const [dateFilter, setDateFilter] = useState<{start: string, end: string}>({
    start: format(new Date().setDate(new Date().getDate() - 7), 'yyyy-MM-dd'),
    end: format(new Date(), 'yyyy-MM-dd')
  });

  const fetchLogs = async () => {
    if (!user) return;
    setLoadingLogs(true);
    try {
      const { data } = await supabase
        .from('automation_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(30);
      setLogs(data || []);
    } catch (error) {
      console.error('Logs error:', error);
    } finally {
      setLoadingLogs(false);
    }
  };
  
  const fetchInvitedFollowers = async () => {
    if (!user) return;
    setLoadingInvited(true);
    try {
      const { data } = await supabase
        .from('automation_logs')
        .select('*')
        .ilike('message', '%IA convidou%')
        .gte('created_at', `${dateFilter.start}T00:00:00`)
        .lte('created_at', `${dateFilter.end}T23:59:59`)
        .order('created_at', { ascending: false });
      setInvitedFollowers(data || []);
    } catch (error) {
      console.error('Invited followers error:', error);
    } finally {
      setLoadingInvited(false);
    }
  };

  const fetchActiveFollows = async () => {
    if (!user) return;
    try {
      const { data } = await supabase
        .from('social_follows')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'following')
        .order('followed_at', { ascending: false });
      setActiveFollows(data || []);
    } catch (error) {
      console.error('Error fetching active follows:', error);
    }
  };

  const fetchSettings = async () => {
    if (!user) return;
    try {
      const { data } = await supabase
        .from('user_settings')
        .select(`
          automation_enabled, 
          follower_growth_mode,
          instagram_follows_per_day_min,
          instagram_follows_per_day_max,
          instagram_follow_duration_min,
          instagram_follow_duration_max,
          instagram_automation_human_like
        `)
        .eq('user_id', user.id)
        .maybeSingle();
      
      if (data) {
        setAutomationEnabled(!!data.automation_enabled);
        if (data.follower_growth_mode !== null) {
          setFollowerGrowthMode(!!data.follower_growth_mode);
        }
        setGrowthSettings({
          followsMin: data.instagram_follows_per_day_min || 2,
          followsMax: data.instagram_follows_per_day_max || 8,
          durationMin: data.instagram_follow_duration_min || 6,
          durationMax: data.instagram_follow_duration_max || 10,
          humanLike: data.instagram_automation_human_like !== false
        });
      }
    } catch (error) {
      console.error('Error fetching settings:', error);
    } finally {
      setLoadingSettings(false);
    }
  };

  const saveGrowthSettings = async () => {
    if (!user) return;
    setLoadingSettings(true);
    try {
      const { error } = await supabase
        .from('user_settings')
        .update({
          instagram_follows_per_day_min: growthSettings.followsMin,
          instagram_follows_per_day_max: growthSettings.followsMax,
          instagram_follow_duration_min: growthSettings.durationMin,
          instagram_follow_duration_max: growthSettings.durationMax,
          instagram_automation_human_like: growthSettings.humanLike
        })
        .eq('user_id', user.id);
      
      if (error) throw error;
      
      toast({ title: 'Configurações Salvas', description: 'O robô foi atualizado com as novas diretrizes.' });
    } catch (error) {
      toast({ title: 'Erro', description: getErrorMessage(error), variant: 'destructive' });
    } finally {
      setLoadingSettings(false);
    }
  };

  const toggleAutomation = async (enabled: boolean) => {
    if (!user) return;
    try {
      const { error } = await supabase
        .from('user_settings')
        .update({ automation_enabled: enabled })
        .eq('user_id', user.id);
      
      if (error) throw error;
      
      setAutomationEnabled(enabled);
      toast({ 
        title: enabled ? 'Automação Ativada' : 'Automação Desativada', 
        description: enabled ? 'O robô agora trabalhará 24/7 para você.' : 'O robô parou de responder automaticamente.' 
      });
    } catch (error) {
      toast({ title: 'Erro', description: getErrorMessage(error), variant: 'destructive' });
    }
  };

  const toggleFollowerGrowth = async (enabled: boolean) => {
    if (!user) return;
    try {
      const { error } = await supabase
        .from('user_settings')
        .update({ follower_growth_mode: enabled })
        .eq('user_id', user.id);
      
      if (error) throw error;
      
      setFollowerGrowthMode(enabled);
      toast({ 
        title: enabled ? 'Modo Crescimento Ativado' : 'Modo Crescimento Desativado', 
        description: enabled ? 'O robô agora focará em convidar novas pessoas para seguir.' : 'O robô voltou ao modo de interação padrão.' 
      });
    } catch (error) {
      toast({ title: 'Erro', description: getErrorMessage(error), variant: 'destructive' });
    }
  };

  const fetchInteractions = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data } = await supabase
        .from('social_interactions')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);
      setInteractions(data || []);
    } catch (error) {
      console.error('Interactions error:', error);
      toast({ title: 'Erro ao carregar interações', description: getErrorMessage(error), variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleProcessInteractions = async () => {
    if (!user) return;
    setProcessing(true);
    try {
      await supabase.functions.invoke('handle-social-interactions', { body: { userId: user.id } });
      const { data } = await supabase.functions.invoke('process-social-replies', { body: { userId: user.id } });
      
      toast({ 
        title: 'Sucesso', 
        description: `${data?.newInteractions || 0} novas interações encontradas em ${data?.postsScanned || 0} postagens.` 
      });
      fetchInteractions();
      fetchMetrics();
    } catch (error) {
      toast({ title: 'Erro no processamento', description: getErrorMessage(error), variant: 'destructive' });
    } finally {
      setProcessing(false);
    }
  };

  const fetchMetrics = async () => {
    if (!user) return;
    setLoadingMetrics(true);
    try {
      const { data } = await supabase.functions.invoke('fetch-meta-metrics', {
        body: { userId: user.id }
      });
      if (data?.success) setMetrics(data.pages || []);
    } catch (error) {
      console.error('Metrics error:', error);
    } finally {
      setLoadingMetrics(false);
    }
  };

  const growthChartData = useMemo(() => {
    if (!invitedFollowers.length) return [];
    
    const start = parseISO(dateFilter.start);
    const end = parseISO(dateFilter.end);
    const days = eachDayOfInterval({ start, end });
    
    return days.map(day => {
      const dateStr = format(day, 'yyyy-MM-dd');
      const dayInvites = invitedFollowers.filter(inv => 
        format(new Date(inv.created_at), 'yyyy-MM-dd') === dateStr
      );
      
      const invites = dayInvites.length;
      const potentialConversions = Math.floor(invites * 0.15); 
      
      return {
        date: format(day, 'dd/MM'),
        convites: invites,
        conversoes: potentialConversions,
        taxa: invites > 0 ? 15 : 0
      };
    });
  }, [invitedFollowers, dateFilter]);

  useEffect(() => {
    fetchInteractions();
    fetchSettings();
    fetchLogs();
    fetchMetrics();
    fetchInvitedFollowers();
    fetchActiveFollows();

    const logsChannel = supabase
      .channel('realtime-robot-data')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'automation_logs' }, (payload) => {
        setLogs(prev => [payload.new, ...prev].slice(0, 30));
        fetchInvitedFollowers(); 
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'social_interactions' }, () => {
        fetchInteractions();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(logsChannel);
    };
  }, [user]);

  useEffect(() => {
    fetchInvitedFollowers();
  }, [dateFilter]);

  return (
    <div className="space-y-6 lg:space-y-8 animate-float-up">
      <div className="flex flex-row items-center justify-between gap-4 p-4 glass-card border-[hsl(200_100%_60%)]/20 relative overflow-hidden group">
        <div className="absolute top-0 right-0 w-64 h-64 bg-[hsl(200_100%_60%)]/5 rounded-full blur-3xl -mr-32 -mt-32 group-hover:bg-[hsl(200_100%_60%)]/10 transition-colors duration-700" />
        
        <div className="relative z-10 flex items-center gap-6 flex-1 min-w-0">
          <div className="flex items-center gap-3 shrink-0">
            <div className="p-2 bg-[hsl(200_100%_60%)]/10 rounded-none border border-[hsl(200_100%_60%)]/30 shrink-0">
              <Bot className="h-5 w-5 text-[hsl(200_100%_60%)]" />
            </div>
            <div className="hidden sm:block">
              <h1 className="text-xl font-black text-[hsl(200_100%_60%)] uppercase tracking-tighter whitespace-nowrap font-montserrat">
                Robô Social A3
              </h1>
              <p className="text-muted-foreground text-[8px] uppercase tracking-[0.2em] flex items-center gap-1.5 font-bold whitespace-nowrap">
                <span className="flex h-1.5 w-1.5 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-success"></span>
                </span>
                Interface Neural
              </p>
            </div>
          </div>
          
          <div className="hidden md:block h-8 w-px bg-white/10" />
          
          <div className="flex items-center gap-6 overflow-x-auto no-scrollbar flex-1">
            <div className="flex flex-col shrink-0">
              <span className="text-[7px] text-muted-foreground uppercase font-black tracking-widest mb-0.5">Status</span>
              <div className={cn(
                "flex items-center gap-1.5 text-[10px] font-black uppercase tracking-tighter",
                automationEnabled ? "text-success shadow-[0_0_10px_rgba(34,197,94,0.3)]" : "text-destructive"
              )}>
                {automationEnabled ? <Power className="h-2.5 w-2.5" /> : <PowerOff className="h-2.5 w-2.5" />}
                {automationEnabled ? "ONLINE" : "OFFLINE"}
              </div>
            </div>
            
            <div className="flex flex-col shrink-0">
              <span className="text-[7px] text-muted-foreground uppercase font-black tracking-widest mb-0.5">Modo</span>
              <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-tighter text-[hsl(200_100%_60%)]">
                <UserCheck className="h-2.5 w-2.5" />
                {followerGrowthMode ? "CRESCIMENTO" : "PADRÃO"}
              </div>
            </div>

            <div className="flex flex-col shrink-0">
              <span className="text-[7px] text-muted-foreground uppercase font-black tracking-widest mb-0.5">Atividade</span>
              <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-tighter text-foreground/90">
                <Activity className="h-2.5 w-2.5 text-[hsl(200_100%_60%)]" />
                {interactions.length} NODOS
              </div>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-2 relative z-10 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCompactMode(!compactMode)}
            className={cn(
              "font-black uppercase tracking-widest text-[9px] h-8 px-2 rounded-none transition-all duration-300 border-2",
              compactMode 
                ? "border-warning bg-warning/5 text-warning" 
                : "border-white/10 bg-white/5 text-muted-foreground hover:bg-white/10"
            )}
            title={compactMode ? "Desativar Modo Compacto" : "Ativar Modo Compacto"}
          >
            {compactMode ? "COMPACTO" : "NORMAL"}
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => toggleAutomation(!automationEnabled)}
            disabled={loadingSettings}
            className={cn(
              "font-black uppercase tracking-widest text-[9px] h-8 px-3 rounded-none transition-all duration-300 border-2",
              automationEnabled 
                ? "border-success bg-success/5 text-success hover:bg-success/10" 
                : "border-destructive/30 bg-destructive/5 text-destructive hover:bg-destructive/10"
            )}
            title={automationEnabled ? "Desativar Automação" : "Ativar Automação"}
          >
            {loadingSettings ? (
              <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />
            ) : automationEnabled ? (
              <Power className="h-3 w-3 mr-1.5" />
            ) : (
              <PowerOff className="h-3 w-3 mr-1.5" />
            )}
            <span className="hidden sm:inline">{automationEnabled ? "DESATIVAR" : "ATIVAR"}</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => toggleFollowerGrowth(!followerGrowthMode)}
            disabled={loadingSettings}
            className={cn(
              "font-black uppercase tracking-widest text-[9px] h-8 px-3 rounded-none transition-all duration-300 border-2",
              followerGrowthMode 
                ? "border-[hsl(200_100%_60%)] shadow-[0_0_10px_rgba(0,210,255,0.2)] bg-[hsl(200_100%_60%)]/10 text-[hsl(200_100%_60%)] hover:bg-[hsl(200_100%_60%)]/20" 
                : "border-white/10 bg-white/5 text-muted-foreground hover:bg-white/10"
            )}
            title={followerGrowthMode ? "Mudar para Modo Padrão" : "Mudar para Modo Crescimento"}
          >
            <UserCheck className={cn("h-3 w-3 mr-1.5", followerGrowthMode && "animate-bounce")} />
            <span className="hidden sm:inline">MODO</span> {followerGrowthMode ? "CRESC." : "PADRÃO"}
          </Button>

          <Button
            size="sm"
            onClick={handleProcessInteractions}
            disabled={processing}
            className="bg-[hsl(200_100%_60%)] text-black font-black uppercase tracking-widest text-[9px] h-8 px-3 rounded-none transition-all shadow-[0_0_15px_rgba(0,210,255,0.4)] border-none hover:scale-105 active:scale-95 hover:bg-[hsl(200_110%_65%)]"
          >
            {processing ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <RefreshCw className="h-3 w-3 mr-1" />}
            <span className="hidden sm:inline">SINCRONIZAR</span>
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 p-1 glass border-white/5 w-fit rounded-none shadow-[0_0_20px_rgba(0,0,0,0.3)]">
        {[
          { id: 'telemetry', label: 'Comando', icon: Bot },
          { id: 'interactions', label: 'Interações', icon: History },
          { id: 'metrics', label: 'Análise', icon: Activity },
          { id: 'growth', label: 'Expansão', icon: TrendingUp },
          { id: 'settings', label: 'Diretrizes', icon: ShieldCheck },
        ].map((tab) => (
          <Button 
            key={tab.id}
            variant={activeTab === tab.id ? 'secondary' : 'ghost'} 
            size="sm" 
            onClick={() => {
              setActiveTab(tab.id as any);
              if (tab.id === 'telemetry') fetchLogs();
              if (tab.id === 'metrics') fetchMetrics();
              if (tab.id === 'growth') {
                fetchInvitedFollowers();
                fetchActiveFollows();
              }
              if (tab.id === 'settings') fetchSettings();
            }}
            className={cn(
              "text-[9px] uppercase font-black tracking-[0.1em] h-7 px-3 rounded-none transition-all relative overflow-hidden group border border-transparent",
              activeTab === tab.id 
                ? "bg-[hsl(200_100%_60%)]/20 text-[hsl(200_100%_60%)] border-[hsl(200_100%_60%)]/30 shadow-[0_0_15px_rgba(0,210,255,0.2)]" 
                : "text-muted-foreground hover:text-foreground hover:bg-white/5"
            )}
          >
            <tab.icon className={cn("h-3 w-3 mr-1.5", activeTab === tab.id && "animate-pulse")} />
            {tab.label}
            {activeTab === tab.id && (
              <span className="absolute bottom-0 left-0 w-full h-0.5 bg-[hsl(200_100%_60%)] shadow-[0_0_10px_rgba(0,210,255,0.8)]" />
            )}
          </Button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6">
        {activeTab === 'interactions' && (
          <Card className="glass-card border-primary/20 overflow-hidden shadow-elevated">
            <CardHeader className="pb-4 border-b border-white/5 bg-white/5 flex flex-row items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 border border-primary/20">
                  <History className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-xl font-black uppercase tracking-tighter">Fluxo de Interações</CardTitle>
                  <CardDescription className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">Monitoramento em Tempo Real</CardDescription>
                </div>
              </div>
              <Badge variant="outline" className="border-[hsl(200_100%_60%)] shadow-[0_0_10px_rgba(0,210,255,0.2)] text-[hsl(200_100%_60%)] font-black uppercase text-[8px] px-2 h-6">
                {interactions.length} NODES ATIVOS
              </Badge>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-white/5">
                {loading ? (
                  <div className="p-24 flex flex-col items-center gap-6">
                    <Loader2 className="h-12 w-12 animate-spin text-primary relative z-10" />
                    <p className="text-[10px] text-muted-foreground uppercase font-black tracking-[0.3em] animate-pulse">Sincronizando com A3 Engine...</p>
                  </div>
                ) : interactions.length > 0 ? (
                  interactions.map((item) => (
                    <div key={item.id} className="hover:bg-primary/[0.03] transition-all duration-300 group relative">
                      <div className="absolute left-0 top-0 w-0.5 h-full bg-transparent group-hover:bg-[hsl(200_100%_60%)] transition-all" />
                      <div className={cn("flex items-start justify-between gap-4", compactMode ? "p-3" : "p-6")}>
                        <div className="flex gap-4 min-w-0 flex-1">
                          <div className="relative shrink-0">
                            <div className="h-10 w-10 border border-[hsl(200_100%_60%)]/30 bg-background overflow-hidden group-hover:border-[hsl(200_100%_60%)] transition-colors">
                              {item.author_avatar ? (
                                <img src={item.author_avatar} alt={item.author_name} className="h-full w-full object-cover grayscale group-hover:grayscale-0" />
                              ) : (
                                <div className="h-full w-full flex items-center justify-center bg-[hsl(200_100%_60%)]/10 text-[hsl(200_100%_60%)] text-base font-black italic">
                                  {item.author_name?.substring(0, 1).toUpperCase()}
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 mb-2 flex-wrap">
                              <span className={cn("font-black uppercase tracking-tighter group-hover:text-[hsl(200_100%_60%)] transition-all", compactMode ? "text-[11px]" : "text-sm")}>
                                {item.author_name}
                              </span>
                              <Badge variant="outline" className="text-[8px] font-black h-4 border-[hsl(200_100%_60%)]/30 text-[hsl(200_100%_60%)] uppercase">
                                {item.platform}
                              </Badge>
                            </div>
                            <p className={cn("text-foreground italic font-medium truncate", compactMode ? "text-[11px]" : "text-sm")}>
                              "{item.content}"
                            </p>
                          </div>
                        </div>
                        <Badge 
                          variant="secondary" 
                          className={cn("text-[8px] uppercase font-black px-1.5 py-0.5 border", item.status === 'replied' ? "border-success bg-success/10 text-success" : "border-warning/30 text-warning")}
                        >
                          {item.status === 'replied' ? 'RESOLVIDO' : 'PENDENTE'}
                        </Badge>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="p-32 text-center">Nenhuma atividade detectada.</div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {activeTab === 'metrics' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {loadingMetrics ? (
              <div className="col-span-full p-32 text-center">Carregando métricas...</div>
            ) : metrics.map((page) => (
              <Card key={page.page_id} className="glass-card border-[hsl(200_100%_60%)]/10">
                <CardHeader className="p-4 border-b border-white/5">
                  <CardTitle className="text-lg font-black uppercase truncate">{page.page_name}</CardTitle>
                </CardHeader>
                <CardContent className="p-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-white/5 p-4 text-center">
                      <p className="text-[10px] text-muted-foreground uppercase font-black">Seguidores</p>
                      <p className="text-2xl font-black">{page.facebook?.fan_count || 0}</p>
                    </div>
                    <div className="bg-white/5 p-4 text-center">
                      <p className="text-[10px] text-muted-foreground uppercase font-black">Likes</p>
                      <p className="text-2xl font-black">{page.facebook?.post_stats?.total_likes || 0}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {activeTab === 'growth' && (
          <div className="space-y-8 animate-in fade-in duration-500">
            <Card className="glass-card border-primary/20 overflow-hidden shadow-elevated">
              <CardHeader className="p-6 border-b border-white/5 flex flex-row items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-[hsl(200_100%_60%)]/10 border border-[hsl(200_100%_60%)]/20">
                    <UserPlus className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-xl font-black uppercase tracking-tighter">Conexões Ativas</CardTitle>
                    <CardDescription className="text-xs uppercase font-bold tracking-widest text-muted-foreground">Usuários seguidos pelo Robô Social</CardDescription>
                  </div>
                </div>
                <Badge className="bg-primary/20 text-primary border-primary/40 font-black h-8 px-4">{activeFollows.length} NODOS</Badge>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y divide-white/5">
                  {activeFollows.length > 0 ? activeFollows.map((follow) => (
                    <div key={follow.id} className="p-6 flex items-center justify-between hover:bg-white/5 transition-colors">
                      <div className="flex items-center gap-4">
                        <div className="h-12 w-12 border border-primary/20 bg-primary/5 flex items-center justify-center overflow-hidden">
                          {follow.target_avatar ? <img src={follow.target_avatar} className="h-full w-full object-cover" /> : <Bot className="h-6 w-6 text-primary" />}
                        </div>
                        <div>
                          <p className="text-sm font-black text-foreground uppercase tracking-tighter">{follow.target_username || 'Usuário Instagram'}</p>
                          <p className="text-[10px] text-muted-foreground font-bold uppercase">Seguido em {format(new Date(follow.followed_at), 'dd/MM/yyyy')}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-[8px] text-primary uppercase font-black tracking-widest mb-1">Próxima Ação</p>
                        <Badge variant="outline" className="border-primary/30 text-primary uppercase text-[9px] font-black">
                          Unfollow em {format(addDays(new Date(follow.followed_at), growthSettings.durationMax), 'dd/MM')}
                        </Badge>
                      </div>
                    </div>
                  )) : (
                    <div className="p-24 text-center text-muted-foreground uppercase font-black text-xs tracking-widest">Nenhuma conexão ativa no momento.</div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {activeTab === 'telemetry' && (
          <Card className="glass-card border-[hsl(200_100%_60%)]/20 overflow-hidden shadow-elevated">
            <CardHeader className="p-4 border-b border-white/5 bg-black/40 flex flex-row items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="h-2 w-2 bg-success rounded-full animate-pulse-dot shadow-[0_0_8px_rgba(34,197,94,0.8)]" />
                <CardTitle className="text-lg font-black uppercase tracking-tighter text-primary">Terminal de Comando</CardTitle>
              </div>
              <Button variant="ghost" size="sm" onClick={fetchLogs} disabled={loadingLogs} className="h-10 w-10 p-0 text-primary border border-primary/20">
                <RefreshCw className={cn("h-5 w-5", loadingLogs && "animate-spin")} />
              </Button>
            </CardHeader>
            <CardContent className="p-0 bg-black/40 font-mono">
              <div className="divide-y divide-white/5 max-h-[600px] overflow-y-auto no-scrollbar">
                {logs.length > 0 ? logs.map((log) => (
                  <div key={log.id} className="p-4 hover:bg-white/5 transition-all group">
                    <div className="flex items-start gap-3">
                      <div className={cn("mt-1 p-2 border", log.level === 'error' ? "border-destructive/30 text-destructive" : "border-primary/30 text-primary")}>
                        <Bot className="h-4 w-4" />
                      </div>
                      <div className="flex-1">
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-[10px] font-black uppercase text-primary/60">{log.module} | {format(new Date(log.created_at), "HH:mm")}</span>
                          <Badge variant="outline" className={cn("text-[8px] font-black", log.level === 'error' ? "border-destructive text-destructive" : "border-primary text-primary")}>
                            {log.level.toUpperCase()}
                          </Badge>
                        </div>
                        <p className="text-xs font-bold text-foreground leading-tight">{log.message}</p>
                      </div>
                    </div>
                  </div>
                )) : <div className="p-24 text-center text-muted-foreground uppercase font-black text-[10px]">Buffer vazio.</div>}
              </div>
            </CardContent>
          </Card>
        )}

        {activeTab === 'settings' && (
          <Card className="glass-card border-[hsl(200_100%_60%)]/20 overflow-hidden shadow-elevated">
            <CardHeader className="p-6 border-b border-white/5 bg-black/40">
              <div className="flex items-center gap-4">
                <div className="p-2 bg-primary/10 border border-primary/20">
                  <ShieldCheck className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-xl font-black uppercase tracking-tighter text-primary">Diretrizes de Operação</CardTitle>
                  <CardDescription className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">Configuração Neural do Robô Social</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-8 space-y-12">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                <div className="space-y-8">
                  <div className="space-y-4">
                    <div className="flex justify-between items-center mb-6">
                      <Label className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
                        <UserPlus className="h-4 w-4 text-primary" /> Seguir por Dia
                      </Label>
                      <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20 font-black">
                        {growthSettings.followsMin} - {growthSettings.followsMax} PESSOAS
                      </Badge>
                    </div>
                    <div className="flex gap-4 items-center">
                      <Input type="number" value={growthSettings.followsMin} onChange={(e) => setGrowthSettings({...growthSettings, followsMin: parseInt(e.target.value)})} className="bg-black/40 text-center font-black" />
                      <Input type="number" value={growthSettings.followsMax} onChange={(e) => setGrowthSettings({...growthSettings, followsMax: parseInt(e.target.value)})} className="bg-black/40 text-center font-black" />
                    </div>
                    <Slider value={[growthSettings.followsMin, growthSettings.followsMax]} min={0} max={50} step={1} onValueChange={([min, max]) => setGrowthSettings({...growthSettings, followsMin: min, followsMax: max})} className="mt-6" />
                  </div>

                  <div className="space-y-4">
                    <div className="flex justify-between items-center mb-6">
                      <Label className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
                        <History className="h-4 w-4 text-primary" /> Permanência (Dias)
                      </Label>
                      <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20 font-black">
                        {growthSettings.durationMin} - {growthSettings.durationMax} DIAS
                      </Badge>
                    </div>
                    <div className="flex gap-4 items-center">
                      <Input type="number" value={growthSettings.durationMin} onChange={(e) => setGrowthSettings({...growthSettings, durationMin: parseInt(e.target.value)})} className="bg-black/40 text-center font-black" />
                      <Input type="number" value={growthSettings.durationMax} onChange={(e) => setGrowthSettings({...growthSettings, durationMax: parseInt(e.target.value)})} className="bg-black/40 text-center font-black" />
                    </div>
                    <Slider value={[growthSettings.durationMin, growthSettings.durationMax]} min={1} max={30} step={1} onValueChange={([min, max]) => setGrowthSettings({...growthSettings, durationMin: min, durationMax: max})} className="mt-6" />
                  </div>
                </div>

                <div className="space-y-8 bg-primary/5 p-8 border border-primary/10">
                  <div className="flex items-center justify-between p-4 border border-primary/20 bg-black/40">
                    <Label className="text-xs font-black uppercase tracking-widest text-primary">Interação Humana A3</Label>
                    <Switch checked={growthSettings.humanLike} onCheckedChange={(checked) => setGrowthSettings({...growthSettings, humanLike: checked})} />
                  </div>
                  <Button className="w-full bg-primary text-black font-black uppercase h-12 hover:scale-[1.02] transition-all" onClick={saveGrowthSettings} disabled={loadingSettings}>
                    {loadingSettings ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
                    Atualizar Diretrizes
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default SocialRobotPage;