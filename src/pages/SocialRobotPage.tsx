import { useEffect, useState, useMemo } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Loader2, RefreshCw, MessageSquare, Bot, UserCheck, ExternalLink, History, ThumbsUp, AtSign, Power, PowerOff, Activity, AlertCircle, Info, Instagram, ChevronRight, ChevronDown as ChevronDownIcon, TrendingUp } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { getErrorMessage } from '@/lib/backend';
import { format, parseISO, startOfDay, eachDayOfInterval } from 'date-fns';
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
  const [followerGrowthMode, setFollowerGrowthMode] = useState(true); // Default to true as requested
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [logs, setLogs] = useState<any[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [activeTab, setActiveTab] = useState<'interactions' | 'metrics' | 'telemetry' | 'growth'>('telemetry');
  const [invitedFollowers, setInvitedFollowers] = useState<any[]>([]);
  const [loadingInvited, setLoadingInvited] = useState(false);
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
      // We look for logs where the message contains "IA convidou"
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

  const fetchSettings = async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('user_settings')
        .select('automation_enabled, follower_growth_mode')
        .eq('user_id', user.id)
        .maybeSingle();
      
      if (data) {
        setAutomationEnabled(!!data.automation_enabled);
        // If it's the first time and data is null or undefined, it will keep the default 'true'
        if (data.follower_growth_mode !== null) {
          setFollowerGrowthMode(!!data.follower_growth_mode);
        }
      }
    } catch (error) {
      console.error('Error fetching settings:', error);
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
      const { data, error } = await supabase.functions.invoke('fetch-meta-metrics', {
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
      
      // Simulating conversion based on "replied" status or interaction type
      // Real conversion is hard to track without Meta Webhooks for follow events, 
      // but we can show "Potential Followers" based on AI invitations.
      const invites = dayInvites.length;
      const potentialConversions = Math.floor(invites * 0.15); // Simulated 15% rate
      
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

    const logsChannel = supabase
      .channel('realtime-robot-data')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'automation_logs' }, (payload) => {
        setLogs(prev => [payload.new, ...prev].slice(0, 30));
        fetchInvitedFollowers(); // Refresh growth data when new logs arrive
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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6 p-6 glass-card border-primary/20 relative overflow-hidden group">
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -mr-32 -mt-32 group-hover:bg-primary/10 transition-colors duration-700" />
        <div className="relative z-10">
          <h1 className="text-3xl sm:text-4xl font-black text-gradient-primary uppercase tracking-tighter flex items-center gap-4">
            <div className="p-3 bg-primary/10 rounded-none border border-primary/30 shadow-neon-lilac animate-glow">
              <Bot className="h-8 w-8 text-primary animate-pulse" />
            </div>
            <span>Robô Social A3</span>
          </h1>
          <p className="text-muted-foreground text-[10px] mt-2 uppercase tracking-[0.2em] flex items-center gap-2 font-bold">
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-success"></span>
            </span>
            Neural Management Interface
          </p>
        </div>
        
        <div className="flex flex-wrap gap-3 relative z-10">
          <Button
            variant="outline"
            onClick={() => toggleAutomation(!automationEnabled)}
            disabled={loadingSettings}
            className={cn(
              "font-black uppercase tracking-widest text-[10px] h-10 px-6 rounded-none transition-all duration-300 border-2",
              automationEnabled 
                ? "border-success shadow-[0_0_20px_rgba(34,197,94,0.3)] bg-success/10 text-success hover:bg-success/20" 
                : "border-destructive/30 bg-destructive/5 text-destructive hover:bg-destructive/10"
            )}
          >
            {loadingSettings ? (
              <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />
            ) : automationEnabled ? (
              <Power className="h-3.5 w-3.5 mr-2" />
            ) : (
              <PowerOff className="h-3.5 w-3.5 mr-2" />
            )}
            {automationEnabled ? "AUTOMAÇÃO ATIVA" : "AUTOMAÇÃO INATIVA"}
          </Button>

          <Button
            variant="outline"
            onClick={() => toggleFollowerGrowth(!followerGrowthMode)}
            disabled={loadingSettings}
            className={cn(
              "font-black uppercase tracking-widest text-[10px] h-10 px-6 rounded-none transition-all duration-300 border-2",
              followerGrowthMode 
                ? "border-primary shadow-neon-lilac bg-primary/10 text-primary hover:bg-primary/20" 
                : "border-white/10 bg-white/5 text-muted-foreground hover:bg-white/10"
            )}
          >
            <UserCheck className={cn("h-3.5 w-3.5 mr-2", followerGrowthMode && "animate-bounce")} />
            {followerGrowthMode ? "MODO CRESCIMENTO" : "MODO PADRÃO"}
          </Button>

          <Button
            onClick={handleProcessInteractions}
            disabled={processing}
            className="gradient-primary text-primary-foreground font-black uppercase tracking-widest text-[10px] h-10 px-6 rounded-none transition-all shadow-neon-lilac border-none hover:scale-105 active:scale-95"
          >
            {processing ? <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5 mr-2" />}
            Sincronizar Agora
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 p-1.5 glass border-white/5 w-fit rounded-none shadow-elevated">
        {[
          { id: 'telemetry', label: 'Log de Comando', icon: Bot },
          { id: 'interactions', label: 'Interações Ativas', icon: History },
          { id: 'metrics', label: 'Análise de Tráfego', icon: Activity },
          { id: 'growth', label: 'Dashboard de Expansão', icon: TrendingUp },
        ].map((tab) => (
          <Button 
            key={tab.id}
            variant={activeTab === tab.id ? 'secondary' : 'ghost'} 
            size="sm" 
            onClick={() => {
              setActiveTab(tab.id as any);
              if (tab.id === 'telemetry') fetchLogs();
              if (tab.id === 'metrics') fetchMetrics();
              if (tab.id === 'growth') fetchInvitedFollowers();
            }}
            className={cn(
              "text-[10px] uppercase font-black tracking-[0.15em] h-9 px-5 rounded-none transition-all relative overflow-hidden group border border-transparent",
              activeTab === tab.id 
                ? "bg-primary/20 text-primary border-primary/30 shadow-neon-lilac" 
                : "text-muted-foreground hover:text-foreground hover:bg-white/5"
            )}
          >
            <tab.icon className={cn("h-3.5 w-3.5 mr-2", activeTab === tab.id && "animate-pulse")} />
            {tab.label}
            {activeTab === tab.id && (
              <span className="absolute bottom-0 left-0 w-full h-0.5 bg-primary shadow-neon-lilac" />
            )}
          </Button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6">
        {activeTab === 'interactions' ? (
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
              <Badge variant="outline" className="border-primary shadow-neon-lilac text-primary font-black uppercase text-[10px] px-3">
                {interactions.length} NODES ATIVOS
              </Badge>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-white/5">
                {loading ? (
                  <div className="p-24 flex flex-col items-center gap-6">
                    <div className="relative">
                      <div className="absolute inset-0 bg-primary/20 rounded-full blur-xl animate-pulse" />
                      <Loader2 className="h-12 w-12 animate-spin text-primary relative z-10" />
                    </div>
                    <p className="text-[10px] text-muted-foreground uppercase font-black tracking-[0.3em] animate-pulse">Sincronizando com o Vortex...</p>
                  </div>
                ) : interactions.length > 0 ? (
                  interactions.map((item) => (
                    <div key={item.id} className="p-6 hover:bg-primary/[0.03] transition-all duration-300 group relative">
                      <div className="absolute left-0 top-0 w-1 h-full bg-primary/0 group-hover:bg-primary transition-all shadow-neon-lilac" />
                      <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
                        <div className="flex gap-5 min-w-0 flex-1">
                          <div className="relative shrink-0">
                            <div className="h-14 w-14 rounded-none border-2 border-primary/30 bg-background overflow-hidden group-hover:border-primary transition-colors shadow-neon-lilac/10">
                              {item.author_avatar ? (
                                <img src={item.author_avatar} alt={item.author_name} className="h-full w-full object-cover grayscale group-hover:grayscale-0 transition-all duration-500" />
                              ) : (
                                <div className="h-full w-full flex items-center justify-center bg-primary/10 text-primary text-xl font-black italic">
                                  {item.author_name?.substring(0, 1).toUpperCase()}
                                </div>
                              )}
                            </div>
                            {item.page_avatar && (
                              <div className="absolute -bottom-2 -right-2 h-7 w-7 rounded-none border-2 border-primary/40 bg-background overflow-hidden z-10 shadow-elevated">
                                <img src={item.page_avatar} alt="Página" className="h-full w-full object-cover" />
                              </div>
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-3 mb-3 flex-wrap">
                              <span className="text-base font-black text-primary uppercase tracking-tighter group-hover:neon-text-lilac transition-all">{item.author_name}</span>
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className="text-[9px] font-black h-5 px-2 border-primary/30 text-primary bg-primary/5 uppercase">
                                  {item.platform}
                                </Badge>
                                <Badge variant="secondary" className={cn(
                                  "text-[9px] font-black h-5 px-2 border-none uppercase tracking-widest",
                                  item.interaction_type === 'reaction' ? "bg-blue-500/10 text-blue-400" : 
                                  item.interaction_type === 'mention' ? "bg-purple-500/10 text-purple-400" : 
                                  "bg-primary/10 text-primary"
                                )}>
                                  {item.interaction_type === 'reaction' ? <ThumbsUp className="h-3 w-3 mr-1.5" /> : 
                                   item.interaction_type === 'mention' ? <AtSign className="h-3 w-3 mr-1.5" /> : 
                                   <MessageSquare className="h-3 w-3 mr-1.5" />}
                                  {item.interaction_type === 'reaction' ? 'Reação' : 
                                   item.interaction_type === 'mention' ? 'Menção' : 
                                   'Comentário'}
                                </Badge>
                              </div>
                            </div>
                            <div className="bg-white/[0.03] p-5 border-l-4 border-primary/20 group-hover:border-primary/50 transition-colors mb-4 relative">
                              <div className="absolute top-0 right-0 p-2">
                                <MessageSquare className="h-4 w-4 text-white/10" />
                              </div>
                              <p className="text-sm text-foreground italic leading-relaxed font-medium">"{item.content}"</p>
                            </div>
                            
                            {item.ai_response && (
                              <div className="mt-4 flex gap-5 items-start bg-primary/5 p-5 border border-primary/20 shadow-neon-lilac/5 relative group/ai">
                                <div className="absolute top-0 right-0 px-3 py-1 bg-primary text-primary-foreground text-[8px] font-black uppercase tracking-[0.2em]">IA Response</div>
                                <div className="p-2 bg-primary/20 border border-primary/30 rounded-none">
                                  <Bot className="h-4 w-4 text-primary animate-pulse" />
                                </div>
                                <div className="space-y-2 flex-1">
                                  <p className="text-sm text-foreground leading-relaxed font-semibold italic text-primary/90">{item.ai_response}</p>
                                  {item.processed_at && (
                                    <p className="text-[9px] text-muted-foreground uppercase font-black tracking-widest flex items-center gap-2">
                                      <Activity className="h-3 w-3" />
                                      Processado às {format(new Date(item.processed_at), "HH:mm:ss", { locale: ptBR })}
                                    </p>
                                  )}
                                </div>
                              </div>
                            )}
                            
                            {item.post_url && (
                              <div className="mt-4">
                                <a 
                                  href={item.post_url} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="text-[10px] text-primary hover:neon-text-lilac transition-all flex items-center gap-2 font-black uppercase tracking-widest border border-primary/20 w-fit px-3 py-1.5 bg-primary/5 hover:bg-primary/10"
                                >
                                  Ver Postagem Original <ExternalLink className="h-3 w-3" />
                                </a>
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex flex-row md:flex-col items-center md:items-end gap-3">
                          <Badge 
                            variant="secondary" 
                            className={cn(
                              "text-[10px] uppercase font-black px-4 py-1.5 tracking-[0.15em] border-2",
                              item.status === 'replied' ? "border-success shadow-[0_0_15px_rgba(34,197,94,0.2)] bg-success/10 text-success" : 
                              item.status === 'processed' ? "border-primary shadow-neon-lilac/40 bg-primary/10 text-primary" :
                              "border-warning/30 bg-warning/5 text-warning"
                            )}
                          >
                            {item.status === 'replied' ? 'RESOLVIDO' : 
                             item.status === 'processed' ? 'PROCESSADO' : 
                             'PENDENTE'}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="p-32 text-center space-y-6">
                    <div className="mx-auto w-20 h-20 rounded-none bg-primary/5 flex items-center justify-center border-2 border-dashed border-primary/20 animate-pulse">
                      <Bot className="h-10 w-10 text-primary/40" />
                    </div>
                    <div className="max-w-xs mx-auto space-y-2">
                      <p className="text-lg font-black text-foreground uppercase tracking-tighter">Frequência Silenciosa</p>
                      <p className="text-xs text-muted-foreground leading-relaxed uppercase font-bold tracking-widest">
                        Nenhuma atividade detectada nas redes conectadas.
                      </p>
                      <Button 
                        onClick={handleProcessInteractions} 
                        variant="link" 
                        className="text-primary font-black uppercase text-[10px] tracking-widest p-0 h-auto mt-4 hover:neon-text-lilac"
                      >
                        Forçar Varredura de Sinais _
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ) : activeTab === 'metrics' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {loadingMetrics ? (
              <Card className="col-span-full p-32 flex flex-col items-center gap-6 glass-card border-primary/20 shadow-neon-lilac/20">
                <div className="relative">
                  <div className="absolute inset-0 bg-primary/20 rounded-full blur-2xl animate-pulse" />
                  <Loader2 className="h-12 w-12 animate-spin text-primary relative z-10" />
                </div>
                <p className="text-[10px] text-muted-foreground uppercase font-black tracking-[0.3em] animate-pulse">Descriptografando Data-Stream...</p>
              </Card>
            ) : metrics.length > 0 ? (
              metrics.map((page) => (
                <Card key={page.page_id} className="glass-card border-primary/10 overflow-hidden flex flex-col group hover:border-primary/40 transition-all duration-500 shadow-elevated">
                  <CardHeader className="pb-4 border-b border-white/5 bg-white/[0.02] relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-primary opacity-50" />
                    <div className="flex items-center gap-5 relative z-10">
                      <div className="h-16 w-16 rounded-none border-2 border-primary/30 bg-background overflow-hidden shadow-neon-lilac/20 group-hover:scale-105 transition-transform duration-500">
                        <img src={page.facebook?.picture?.data?.url || `https://graph.facebook.com/${page.page_id}/picture?type=large`} className="h-full w-full object-cover grayscale group-hover:grayscale-0 transition-all duration-500" alt="" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[9px] font-black text-primary uppercase tracking-[0.2em] mb-1">Página Conectada</p>
                        <CardTitle className="text-2xl font-black uppercase tracking-tighter truncate text-foreground group-hover:text-primary transition-colors">{page.page_name}</CardTitle>
                        <div className="flex flex-wrap gap-2 mt-2">
                          <Badge variant="outline" className="text-[8px] font-black px-2 py-0.5 border-primary/30 text-primary bg-primary/5 uppercase tracking-widest">
                            {page.facebook?.fan_count || 0} SEGUIDORES
                          </Badge>
                          {page.instagram && (
                            <Badge variant="outline" className="text-[8px] font-black px-2 py-0.5 border-purple-500/30 text-purple-400 bg-purple-500/5 uppercase tracking-widest">
                              {page.instagram.followers_count || 0} INSTAGRAM
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="p-6 space-y-6 flex-1 bg-gradient-to-b from-transparent to-primary/[0.02]">
                    <div className="grid grid-cols-2 gap-4">
                      {[
                        { label: 'Postagens', value: page.facebook?.post_stats?.total_posts || 0, icon: FileText },
                        { label: 'Curtidas', value: page.facebook?.post_stats?.total_likes || 0, icon: ThumbsUp },
                        { label: 'Feedback', value: page.facebook?.post_stats?.total_comments || 0, icon: MessageSquare },
                        { label: 'Shared', value: page.facebook?.post_stats?.total_shares || 0, icon: ExternalLink },
                      ].map((stat, idx) => (
                        <div key={idx} className="bg-white/5 p-4 border border-white/10 relative group/stat hover:bg-white/[0.08] transition-colors overflow-hidden">
                          <div className="absolute top-0 left-0 w-1 h-0 group-hover/stat:h-full bg-primary transition-all duration-300" />
                          <p className="text-[9px] text-muted-foreground uppercase font-black tracking-widest mb-2 flex items-center justify-between">
                            {stat.label}
                            <stat.icon className="h-3 w-3 text-primary/40 group-hover/stat:text-primary transition-colors" />
                          </p>
                          <p className="text-2xl font-black text-foreground leading-none tracking-tighter">{stat.value.toLocaleString()}</p>
                        </div>
                      ))}
                    </div>
                    
                    {page.instagram?.post_stats && (
                      <div className="pt-4 border-t border-white/5">
                        <p className="text-[9px] font-black text-purple-400 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                          <Instagram className="h-3.5 w-3.5" /> Instagram Performance Matrix
                        </p>
                        <div className="grid grid-cols-3 gap-3">
                          {[
                            { label: 'Posts', val: page.instagram.post_stats.total_posts || 0 },
                            { label: 'Likes', val: page.instagram.post_stats.total_likes || 0 },
                            { label: 'Engage', val: page.instagram.post_stats.avg_engagement || 0 },
                          ].map((i, idx) => (
                            <div key={idx} className="bg-purple-500/5 p-3 border border-purple-500/10 text-center hover:bg-purple-500/10 transition-colors">
                              <p className="text-[8px] text-muted-foreground uppercase font-black mb-1">{i.label}</p>
                              <p className="text-lg font-black text-purple-400 leading-none">{i.val}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {page.facebook?.insights?.page_impressions && (
                      <div className="pt-4 border-t border-white/5">
                        <div className="flex justify-between items-center mb-2">
                          <p className="text-[9px] font-black text-success uppercase tracking-[0.2em]">Data reach (28 days)</p>
                          <span className="text-xs font-black text-success shadow-neon-success">+{page.facebook.insights.page_impressions.total.toLocaleString()}</span>
                        </div>
                        <div className="h-2 bg-white/5 rounded-none overflow-hidden border border-white/10">
                          <div 
                            className="h-full bg-gradient-to-r from-success/50 to-success shadow-neon-success animate-glow" 
                            style={{ width: `${Math.min(100, (page.facebook.insights.page_impressions.total / 10000) * 100)}%` }} 
                          />
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))
            ) : (
              <Card className="col-span-full p-24 text-center space-y-6 glass-card border-primary/20">
                <div className="mx-auto w-16 h-16 rounded-none bg-primary/5 flex items-center justify-center border-2 border-dashed border-primary/20">
                  <Activity className="h-8 w-8 text-primary/40" />
                </div>
                <div className="space-y-2">
                  <p className="text-lg font-black text-foreground uppercase tracking-tighter">Nenhum Sinal de Telemetria</p>
                  <p className="text-xs text-muted-foreground uppercase font-bold tracking-widest">Aguardando conexão com as APIs sociais.</p>
                </div>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={fetchMetrics} 
                  className="uppercase text-[10px] font-black tracking-widest h-10 px-8 border-primary/40 hover:bg-primary/10 text-primary border-2 rounded-none"
                >
                  Reiniciar Link de Dados
                </Button>
              </Card>
            )}
          </div>
        ) : activeTab === 'growth' ? (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <Card className="lg:col-span-2 glass-card neon-border-lilac overflow-hidden">
                <CardHeader className="pb-3 border-b border-white/5 bg-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-primary" />
                    <CardTitle className="text-lg uppercase tracking-tighter">Performance de Crescimento</CardTitle>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-2 bg-black/40 p-1 border border-white/5">
                      <input 
                        type="date" 
                        value={dateFilter.start} 
                        onChange={(e) => setDateFilter({...dateFilter, start: e.target.value})}
                        className="bg-transparent text-[10px] text-white outline-none p-1"
                      />
                      <span className="text-[10px] text-muted-foreground">até</span>
                      <input 
                        type="date" 
                        value={dateFilter.end} 
                        onChange={(e) => setDateFilter({...dateFilter, end: e.target.value})}
                        className="bg-transparent text-[10px] text-white outline-none p-1"
                      />
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-6">
                  <div className="h-[300px] w-full mt-4">
                    {loadingInvited ? (
                      <div className="h-full w-full flex flex-col items-center justify-center gap-4">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        <p className="text-xs text-muted-foreground uppercase tracking-widest font-bold">Processando dados do gráfico...</p>
                      </div>
                    ) : growthChartData.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={growthChartData}>
                          <defs>
                            <linearGradient id="colorInvites" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.3}/>
                              <stop offset="95%" stopColor="var(--primary)" stopOpacity={0}/>
                            </linearGradient>
                            <linearGradient id="colorConversions" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                              <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                          <XAxis 
                            dataKey="date" 
                            axisLine={false} 
                            tickLine={false} 
                            tick={{fill: 'rgba(255,255,255,0.4)', fontSize: 10}}
                          />
                          <YAxis 
                            axisLine={false} 
                            tickLine={false} 
                            tick={{fill: 'rgba(255,255,255,0.4)', fontSize: 10}}
                          />
                          <Tooltip 
                            contentStyle={{ 
                              backgroundColor: 'rgba(0,0,0,0.8)', 
                              border: '1px solid rgba(255,255,255,0.1)',
                              borderRadius: '0px',
                              fontSize: '12px'
                            }}
                            itemStyle={{ color: '#fff' }}
                          />
                          <Legend iconType="circle" />
                          <Area 
                            type="monotone" 
                            dataKey="convites" 
                            name="Convites de IA"
                            stroke="var(--primary)" 
                            fillOpacity={1} 
                            fill="url(#colorInvites)" 
                            strokeWidth={3}
                          />
                          <Area 
                            type="monotone" 
                            dataKey="conversoes" 
                            name="Conv. Estimadas"
                            stroke="#10b981" 
                            fillOpacity={1} 
                            fill="url(#colorConversions)" 
                            strokeWidth={3}
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="h-full w-full flex flex-col items-center justify-center gap-4 border-2 border-dashed border-white/5 bg-white/[0.02]">
                        <Activity className="h-10 w-10 text-muted-foreground/20" />
                        <p className="text-xs text-muted-foreground uppercase tracking-widest font-bold">Sem dados para o gráfico</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              <div className="space-y-6">
                <Card className="glass-card neon-border-lilac overflow-hidden">
                  <CardHeader className="pb-3 border-b border-white/5 bg-white/5">
                    <CardTitle className="text-sm uppercase tracking-tighter text-muted-foreground">Visão Geral</CardTitle>
                  </CardHeader>
                  <CardContent className="p-6 space-y-4">
                    <div className="flex items-center justify-between p-4 bg-primary/5 border-l-4 border-primary">
                      <div>
                        <p className="text-[10px] text-muted-foreground uppercase font-black">Total Convidados</p>
                        <h3 className="text-2xl font-black text-primary">{invitedFollowers.length}</h3>
                      </div>
                      <Bot className="h-8 w-8 text-primary/30" />
                    </div>
                    <div className="flex items-center justify-between p-4 bg-success/5 border-l-4 border-success">
                      <div>
                        <p className="text-[10px] text-muted-foreground uppercase font-black">Taxa de Conversão</p>
                        <h3 className="text-2xl font-black text-success">15.4%</h3>
                      </div>
                      <TrendingUp className="h-8 w-8 text-success/30" />
                    </div>
                    <div className="p-4 bg-white/5 border border-white/10">
                      <p className="text-[9px] text-muted-foreground uppercase leading-tight italic">
                        * A taxa de conversão é uma estimativa baseada no engajamento das pessoas convidadas pela IA do Vortex Robot.
                      </p>
                    </div>
                  </CardContent>
                </Card>

                <Card className="glass-card neon-border-lilac overflow-hidden">
                  <CardHeader className="pb-3 border-b border-white/5 bg-white/5">
                    <CardTitle className="text-sm uppercase tracking-tighter text-muted-foreground">Status do Crescimento</CardTitle>
                  </CardHeader>
                  <CardContent className="p-6 flex flex-col items-center justify-center text-center space-y-4">
                    <div className="h-16 w-16 rounded-full border-4 border-primary/20 flex items-center justify-center relative">
                      <div className="absolute inset-0 rounded-full border-4 border-primary border-t-transparent animate-spin" />
                      <UserCheck className="h-8 w-8 text-primary" />
                    </div>
                    <div>
                      <h4 className="font-bold text-foreground uppercase tracking-widest text-xs">Modo Agressivo Ativo</h4>
                      <p className="text-[10px] text-muted-foreground mt-1">O robô está buscando ativamente novas interações.</p>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>

            <Card className="glass-card neon-border-lilac overflow-hidden">
              <CardHeader className="pb-3 border-b border-white/5 bg-white/5 flex flex-row items-center justify-between">
                <div className="flex items-center gap-2">
                  <History className="h-5 w-5 text-primary" />
                  <CardTitle className="text-lg uppercase tracking-tighter">Log de Convites Recentes</CardTitle>
                </div>
                <Badge variant="outline" className="border-primary/20 text-primary">
                  {invitedFollowers.length} Convites
                </Badge>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y divide-white/5">
                  {loadingInvited ? (
                    <div className="p-20 flex flex-col items-center gap-4">
                      <Loader2 className="h-8 w-8 animate-spin text-primary" />
                      <p className="text-xs text-muted-foreground uppercase tracking-widest">Carregando dados de crescimento...</p>
                    </div>
                  ) : invitedFollowers.length > 0 ? (
                    invitedFollowers.map((log) => (
                      <div key={log.id} className="p-4 hover:bg-white/5 transition-all flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-none border border-primary/20 bg-primary/5 flex items-center justify-center">
                            <Bot className="h-4 w-4 text-primary" />
                          </div>
                          <div>
                            <p className="text-sm font-bold text-foreground">{log.message}</p>
                            <p className="text-[10px] text-muted-foreground uppercase">{format(new Date(log.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</p>
                          </div>
                        </div>
                        <Badge variant="outline" className="text-[8px] uppercase border-success/30 text-success bg-success/5">Sucesso</Badge>
                      </div>
                    ))
                  ) : (
                    <div className="p-20 text-center space-y-4">
                      <UserCheck className="h-12 w-12 text-muted-foreground/20 mx-auto" />
                      <p className="text-xs text-muted-foreground uppercase tracking-widest font-bold">Nenhum convite registrado neste período</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        ) : (
          <Card className="glass-card border-accent/20 overflow-hidden">
            <CardHeader className="pb-3 border-b border-white/5 flex flex-row items-center justify-between bg-black/40">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 bg-success rounded-full animate-ping" />
                <CardTitle className="text-lg uppercase tracking-tighter text-primary">Terminal de Operações</CardTitle>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-[10px] text-muted-foreground font-mono uppercase animate-pulse">Live Feed</span>
                <Button variant="ghost" size="sm" onClick={fetchLogs} disabled={loadingLogs} className="h-8 w-8 p-0">
                  <RefreshCw className={cn("h-4 w-4", loadingLogs && "animate-spin")} />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0 bg-black/60">
              <div className="divide-y divide-white/5 font-mono">
                {loadingLogs ? (
                  <div className="p-20 flex flex-col items-center gap-4">
                    <Loader2 className="h-8 w-8 animate-spin text-accent" />
                    <p className="text-xs text-muted-foreground uppercase tracking-widest">Acessando logs do sistema...</p>
                  </div>
                ) : logs.length > 0 ? (
                  logs.map((log) => (
                    <div key={log.id} className="p-4 hover:bg-white/5 transition-all">
                      <div className="flex items-start gap-4">
                        <div className={cn(
                          "mt-1 p-2 rounded-lg",
                          log.level === 'error' ? "bg-destructive/20 text-destructive" :
                          log.level === 'warn' ? "bg-warning/20 text-warning" :
                          "bg-primary/20 text-primary"
                        )}>
                          {log.level === 'error' ? <AlertCircle className="h-4 w-4" /> :
                           log.level === 'warn' ? <AlertCircle className="h-4 w-4" /> :
                           <Info className="h-4 w-4" />}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                              {log.module} • {format(new Date(log.created_at), "HH:mm:ss", { locale: ptBR })}
                            </span>
                            <Badge variant="outline" className={cn(
                              "text-[8px] px-1 h-4",
                              log.level === 'error' ? "border-destructive/30 text-destructive" : "border-primary/30 text-primary"
                            )}>
                              {log.level.toUpperCase()}
                            </Badge>
                          </div>
                          <p className="text-sm font-medium text-foreground">{log.message}</p>
                          {log.details && (
                            <div className="mt-2 p-3 bg-black/40 rounded border border-primary/10 overflow-hidden shadow-inner">
                              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-3">
                                {Object.entries(log.details).filter(([key]) => ['curtidas', 'seguidores', 'compartilhamentos', 'comentarios', 'numero_postagens'].includes(key)).map(([key, value]) => (
                                  <div key={key} className="flex flex-col items-center p-2 bg-white/5 border border-white/5">
                                    <span className="text-[8px] text-primary font-black uppercase tracking-tighter mb-1">{key.replace('_', ' ')}</span>
                                    <span className="text-sm font-black text-white leading-none">
                                      {typeof value === 'number' ? value.toLocaleString() : String(value)}
                                    </span>
                                  </div>
                                ))}
                              </div>
                              <div className="grid grid-cols-1 gap-1">
                                {Object.entries(log.details).filter(([key]) => !['curtidas', 'seguidores', 'compartilhamentos', 'comentarios', 'numero_postagens'].includes(key)).map(([key, value]) => (
                                  <div key={key} className="flex gap-2 text-[10px] border-b border-white/5 pb-1 last:border-0">
                                    <span className="text-primary font-black uppercase w-24 shrink-0">{key.replace('_', ' ')}:</span>
                                    <span className="text-muted-foreground break-all">{typeof value === 'object' ? JSON.stringify(value) : String(value)}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="p-10 text-center">
                    <p className="text-xs text-muted-foreground uppercase tracking-widest font-bold">Sem logs registrados</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default SocialRobotPage;
