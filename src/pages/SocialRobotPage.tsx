import { useEffect, useState, useMemo } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Loader2, RefreshCw, MessageSquare, Bot, UserCheck, ExternalLink, History, ThumbsUp, AtSign, Power, PowerOff, Activity, AlertCircle, Info, Instagram, ChevronRight, ChevronDown as ChevronDownIcon, TrendingUp, FileText } from 'lucide-react';
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
      <div className="flex flex-row items-center justify-between gap-4 p-4 glass-card border-[hsl(200_100%_60%)]/20 relative overflow-hidden group">
        <div className="absolute top-0 right-0 w-64 h-64 bg-[hsl(200_100%_60%)]/5 rounded-full blur-3xl -mr-32 -mt-32 group-hover:bg-[hsl(200_100%_60%)]/10 transition-colors duration-700" />
        
        <div className="relative z-10 flex items-center gap-6 flex-1 min-w-0">
          <div className="flex items-center gap-3 shrink-0">
            <div className="p-2 bg-[hsl(200_100%_60%)]/10 rounded-none border border-[hsl(200_100%_60%)]/30 shadow-[0_0_15px_rgba(0,210,255,0.3)] animate-glow shrink-0">
              <Bot className="h-6 w-6 text-[hsl(200_100%_60%)] animate-pulse" />
            </div>
            <div className="hidden sm:block">
              <h1 className="text-xl font-black text-[hsl(200_100%_60%)] uppercase tracking-tighter whitespace-nowrap font-montserrat drop-shadow-[0_0_8px_rgba(0,210,255,0.5)]">
                Robô Social A3
              </h1>
              <p className="text-muted-foreground text-[8px] uppercase tracking-[0.2em] flex items-center gap-1.5 font-bold whitespace-nowrap">
                <span className="flex h-1.5 w-1.5 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-success"></span>
                </span>
                Neural Interface
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
                {interactions.length} NODES
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
              <Badge variant="outline" className="border-[hsl(200_100%_60%)] shadow-[0_0_10px_rgba(0,210,255,0.2)] text-[hsl(200_100%_60%)] font-black uppercase text-[8px] px-2 h-6">
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
                    <p className="text-[10px] text-muted-foreground uppercase font-black tracking-[0.3em] animate-pulse">Sincronizando com A3 Engine...</p>
                  </div>
                ) : interactions.length > 0 ? (
                  interactions.map((item) => (
                    <div key={item.id} className="hover:bg-primary/[0.03] transition-all duration-300 group relative">
                      <div className="absolute left-0 top-0 w-0.5 h-full bg-transparent group-hover:bg-[hsl(200_100%_60%)] transition-all shadow-[0_0_10px_rgba(0,210,255,0.4)]" />
                      <div className={cn(
                        "flex items-start justify-between gap-4",
                        compactMode ? "p-3" : "p-6"
                      )}>
                        <div className="flex gap-4 min-w-0 flex-1">
                          <div className="relative shrink-0">
                            <div className="h-12 w-12 rounded-none border border-[hsl(200_100%_60%)]/30 bg-background overflow-hidden group-hover:border-[hsl(200_100%_60%)] transition-colors shadow-[0_0_10px_rgba(0,210,255,0.1)]">
                              {item.author_avatar ? (
                                <img src={item.author_avatar} alt={item.author_name} className="h-full w-full object-cover grayscale group-hover:grayscale-0 transition-all duration-500" />
                              ) : (
                                <div className="h-full w-full flex items-center justify-center bg-[hsl(200_100%_60%)]/10 text-[hsl(200_100%_60%)] text-lg font-black italic">
                                  {item.author_name?.substring(0, 1).toUpperCase()}
                                </div>
                              )}
                            </div>
                            {item.page_avatar && (
                              <div className="absolute -bottom-1 -right-1 h-6 w-6 rounded-none border border-[hsl(200_100%_60%)]/40 bg-background overflow-hidden z-10">
                                <img src={item.page_avatar} alt="Página" className="h-full w-full object-cover" />
                              </div>
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 mb-2 flex-wrap">
                              <span className={cn(
                                "font-black uppercase tracking-tighter group-hover:drop-shadow-[0_0_5px_rgba(0,210,255,0.5)] transition-all",
                                compactMode ? "text-xs" : "text-sm"
                              )}>
                                {item.author_name}
                              </span>
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className="text-[8px] font-black h-4 px-1 border-[hsl(200_100%_60%)]/30 text-[hsl(200_100%_60%)] bg-[hsl(200_100%_60%)]/5 uppercase">
                                  {item.platform}
                                </Badge>
                                <Badge variant="secondary" className={cn(
                                  "text-[8px] font-black h-4 px-1 border-none uppercase tracking-widest",
                                   item.interaction_type === 'reaction' ? "bg-blue-500/10 text-blue-400" : 
                                   item.interaction_type === 'mention' ? "bg-purple-500/10 text-purple-400" : 
                                   "bg-[hsl(200_100%_60%)]/10 text-[hsl(200_100%_60%)]"
                                 )}>
                                   {item.interaction_type === 'reaction' ? <ThumbsUp className="h-3 w-3 mr-1.5" /> : 
                                    item.interaction_type === 'mention' ? <AtSign className="h-3 w-3 mr-1.5" /> : 
                                    <MessageSquare className="h-3 w-3 mr-1.5" />}
                                   <span className={compactMode ? "hidden sm:inline" : ""}>
                                     {item.interaction_type === 'reaction' ? 'Reação' : 
                                      item.interaction_type === 'mention' ? 'Menção' : 
                                      'Comentário'}
                                   </span>
                                 </Badge>
                              </div>
                            </div>
                            <div className={cn(
                              "bg-white/[0.03] border-l-4 border-[hsl(200_100%_60%)]/20 group-hover:border-[hsl(200_100%_60%)]/50 transition-colors relative",
                              compactMode ? "p-2 mb-2" : "p-4 mb-4"
                            )}>
                              <p className={cn(
                                "text-foreground italic font-medium leading-relaxed truncate",
                                compactMode ? "text-[11px]" : "text-sm"
                              )}>
                                "{item.content}"
                              </p>
                            </div>
                            
                            {item.ai_response && (
                              <div className={cn(
                                "flex gap-3 items-start bg-[hsl(200_100%_60%)]/5 border border-[hsl(200_100%_60%)]/20 relative group/ai",
                                compactMode ? "p-2 mt-2" : "p-4 mt-4"
                              )}>
                                <div className="absolute top-0 right-0 px-2 py-0.5 bg-[hsl(200_100%_60%)] text-black text-[7px] font-black uppercase tracking-[0.2em]">IA Response</div>
                                <div className={cn(
                                  "bg-[hsl(200_100%_60%)]/20 border border-[hsl(200_100%_60%)]/30 rounded-none shrink-0",
                                  compactMode ? "p-1" : "p-1.5"
                                )}>
                                  <Bot className={cn("text-[hsl(200_100%_60%)] animate-pulse", compactMode ? "h-3 w-3" : "h-3.5 w-3.5")} />
                                </div>
                                <div className="min-w-0 flex-1">
                                  <p className={cn(
                                    "text-foreground font-semibold italic text-[hsl(200_100%_60%)]/90 truncate",
                                    compactMode ? "text-[11px]" : "text-xs"
                                  )}>
                                    {item.ai_response}
                                  </p>
                                </div>
                              </div>
                            )}
                            
                            {item.post_url && (
                              <div className="mt-3">
                                <a 
                                  href={item.post_url} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="text-[9px] text-[hsl(200_100%_60%)] hover:drop-shadow-[0_0_5px_rgba(0,210,255,0.6)] transition-all flex items-center gap-1.5 font-black uppercase tracking-widest border border-[hsl(200_100%_60%)]/20 w-fit px-2 py-1 bg-[hsl(200_100%_60%)]/5 hover:bg-[hsl(200_100%_60%)]/10"
                                >
                                  Ver Postagem Original <ExternalLink className="h-2.5 w-2.5" />
                                </a>
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex flex-row md:flex-col items-center md:items-end gap-2 shrink-0">
                          <Badge 
                            variant="secondary" 
                            className={cn(
                              "text-[8px] uppercase font-black px-1.5 py-0.5 tracking-[0.05em] border",
                              item.status === 'replied' ? "border-success bg-success/10 text-success" : 
                              item.status === 'processed' ? "border-[hsl(200_100%_60%)] bg-[hsl(200_100%_60%)]/10 text-[hsl(200_100%_60%)]" :
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
                <Card key={page.page_id} className="glass-card border-[hsl(200_100%_60%)]/10 overflow-hidden flex flex-col group hover:border-[hsl(200_100%_60%)]/40 transition-all duration-500 shadow-elevated">
                  <CardHeader className="p-4 border-b border-white/5 bg-white/[0.02] relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-0.5 bg-[hsl(200_100%_60%)] opacity-30" />
                    <div className="flex items-center gap-4 relative z-10">
                      <div className="h-12 w-12 rounded-none border border-[hsl(200_100%_60%)]/30 bg-background overflow-hidden shadow-[0_0_10px_rgba(0,210,255,0.1)] group-hover:scale-105 transition-transform duration-500">
                        <img src={page.facebook?.picture?.data?.url || `https://graph.facebook.com/${page.page_id}/picture?type=large`} className="h-full w-full object-cover grayscale group-hover:grayscale-0 transition-all duration-500" alt="" />
                      </div>
                      <div className="min-w-0 flex-1 flex items-center justify-between gap-4">
                        <div className="min-w-0">
                          <p className="text-[7px] font-black text-[hsl(200_100%_60%)] uppercase tracking-[0.2em] mb-0.5">Página Ativa</p>
                          <CardTitle className="text-lg font-black uppercase tracking-tighter truncate text-foreground group-hover:text-[hsl(200_100%_60%)] transition-colors">{page.page_name}</CardTitle>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <Badge variant="outline" className="text-[7px] font-black px-1.5 py-0 border-[hsl(200_100%_60%)]/30 text-[hsl(200_100%_60%)] bg-[hsl(200_100%_60%)]/5 uppercase tracking-widest h-5">
                            {page.facebook?.fan_count || 0} SEGUIDORES
                          </Badge>
                          {page.instagram && (
                            <Badge variant="outline" className="text-[7px] font-black px-1.5 py-0 border-purple-500/30 text-purple-400 bg-purple-500/5 uppercase tracking-widest h-5">
                              {page.instagram.followers_count || 0} IG
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="p-6 space-y-6 flex-1 bg-gradient-to-b from-transparent to-primary/[0.02]">
                    <div className="grid grid-cols-4 gap-3">
                      {[
                        { label: 'Posts', value: page.facebook?.post_stats?.total_posts || 0, icon: FileText },
                        { label: 'Likes', value: page.facebook?.post_stats?.total_likes || 0, icon: ThumbsUp },
                        { label: 'Feedbk', value: page.facebook?.post_stats?.total_comments || 0, icon: MessageSquare },
                        { label: 'Share', value: page.facebook?.post_stats?.total_shares || 0, icon: ExternalLink },
                      ].map((stat, idx) => (
                        <div key={idx} className="bg-white/5 p-3 border border-white/10 relative group/stat hover:bg-white/[0.08] transition-colors overflow-hidden">
                          <div className="absolute top-0 left-0 w-full h-0.5 bg-[hsl(200_100%_60%)]/0 group-hover/stat:bg-[hsl(200_100%_60%)] transition-all duration-300" />
                          <p className="text-[7px] text-muted-foreground uppercase font-black tracking-widest mb-1 flex items-center justify-between">
                            {stat.label}
                          </p>
                          <p className="text-lg font-black text-foreground leading-none tracking-tighter">{stat.value.toLocaleString()}</p>
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
          <div className="space-y-8">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <Card className="lg:col-span-2 glass-card border-[hsl(200_100%_60%)]/10 overflow-hidden shadow-elevated group">
                <CardHeader className="p-4 border-b border-white/5 bg-white/[0.02] flex flex-col sm:flex-row sm:items-center justify-between gap-6 relative">
                  <div className="absolute top-0 left-0 w-full h-0.5 bg-[hsl(200_100%_60%)] opacity-30" />
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-[hsl(200_100%_60%)]/10 border border-[hsl(200_100%_60%)]/20">
                      <TrendingUp className="h-4 w-4 text-[hsl(200_100%_60%)]" />
                    </div>
                    <div>
                      <CardTitle className="text-lg font-black uppercase tracking-tighter text-[hsl(200_100%_60%)]">Vetor de Expansão</CardTitle>
                      <CardDescription className="text-[8px] uppercase font-bold tracking-widest text-muted-foreground">Análise de Crescimento Neural</CardDescription>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 bg-black/60 p-1.5 border border-primary/20 shadow-inner">
                    <input 
                      type="date" 
                      value={dateFilter.start} 
                      onChange={(e) => setDateFilter({...dateFilter, start: e.target.value})}
                      className="bg-transparent text-[10px] text-primary font-black uppercase outline-none px-2 py-1 hover:bg-primary/5 transition-colors"
                    />
                    <ChevronRight className="h-3 w-3 text-primary/40" />
                    <input 
                      type="date" 
                      value={dateFilter.end} 
                      onChange={(e) => setDateFilter({...dateFilter, end: e.target.value})}
                      className="bg-transparent text-[10px] text-primary font-black uppercase outline-none px-2 py-1 hover:bg-primary/5 transition-colors"
                    />
                  </div>
                </CardHeader>
                <CardContent className="p-8">
                  <div className="h-[350px] w-full mt-4">
                    {loadingInvited ? (
                      <div className="h-full w-full flex flex-col items-center justify-center gap-6">
                        <div className="relative">
                          <div className="absolute inset-0 bg-primary/20 rounded-full blur-xl animate-pulse" />
                          <Loader2 className="h-10 w-10 animate-spin text-primary relative z-10" />
                        </div>
                        <p className="text-[10px] text-muted-foreground uppercase font-black tracking-[0.3em] animate-pulse">Compilando Dados de Gráfico...</p>
                      </div>
                    ) : growthChartData.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={growthChartData}>
                          <defs>
                            <linearGradient id="colorInvites" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="hsl(210, 100%, 50%)" stopOpacity={0.4}/>
                              <stop offset="95%" stopColor="hsl(210, 100%, 50%)" stopOpacity={0}/>
                            </linearGradient>
                            <linearGradient id="colorConversions" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#10b981" stopOpacity={0.4}/>
                              <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" vertical={false} />
                          <XAxis 
                            dataKey="date" 
                            axisLine={false} 
                            tickLine={false} 
                            tick={{fill: 'rgba(255,255,255,0.4)', fontSize: 10, fontWeight: 'bold'}}
                          />
                          <YAxis 
                            axisLine={false} 
                            tickLine={false} 
                            tick={{fill: 'rgba(255,255,255,0.4)', fontSize: 10, fontWeight: 'bold'}}
                          />
                          <Tooltip 
                            contentStyle={{ 
                              backgroundColor: 'rgba(0,0,0,0.9)', 
                              border: '1px solid rgba(0, 150, 255, 0.3)',
                              borderRadius: '0px',
                              fontSize: '11px',
                              fontWeight: 'black',
                              textTransform: 'uppercase',
                              letterSpacing: '0.1em'
                            }}
                            itemStyle={{ color: '#fff' }}
                            cursor={{stroke: 'rgba(0, 150, 255, 0.2)', strokeWidth: 2}}
                          />
                          <Legend 
                            iconType="rect" 
                            verticalAlign="top" 
                            align="right" 
                            wrapperStyle={{paddingBottom: '20px', fontSize: '10px', fontWeight: 'black', textTransform: 'uppercase'}} 
                          />
                          <Area 
                            type="monotone" 
                            dataKey="convites" 
                            name="Interações IA"
                            stroke="hsl(210, 100%, 50%)" 
                            fillOpacity={1} 
                            fill="url(#colorInvites)" 
                            strokeWidth={4}
                            animationDuration={2000}
                          />
                          <Area 
                            type="monotone" 
                            dataKey="conversoes" 
                            name="Conversões"
                            stroke="#10b981" 
                            fillOpacity={1} 
                            fill="url(#colorConversions)" 
                            strokeWidth={4}
                            animationDuration={2500}
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="h-full w-full flex flex-col items-center justify-center gap-6 border-2 border-dashed border-white/5 bg-white/[0.02] relative">
                        <Activity className="h-12 w-12 text-muted-foreground/10" />
                        <p className="text-[10px] text-muted-foreground uppercase font-black tracking-[0.2em]">Sem fluxo de dados para o período selecionado</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              <div className="space-y-8">
                <Card className="glass-card border-[hsl(200_100%_60%)]/10 overflow-hidden shadow-elevated relative group">
                  <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                    <Activity className="h-24 w-24 text-[hsl(200_100%_60%)]" />
                  </div>
                  <CardHeader className="p-4 border-b border-white/5 bg-white/[0.02]">
                    <CardTitle className="text-[9px] font-black uppercase tracking-[0.2em] text-[hsl(200_100%_60%)]">Resumo Executivo</CardTitle>
                  </CardHeader>
                  <CardContent className="p-6 space-y-6">
                    <div className="flex items-center justify-between p-4 bg-[hsl(200_100%_60%)]/[0.03] border-l-4 border-[hsl(200_100%_60%)] relative overflow-hidden">
                      <div className="absolute top-0 right-0 w-16 h-16 bg-[hsl(200_100%_60%)]/5 rounded-full blur-2xl -mr-8 -mt-8" />
                      <div className="relative z-10">
                        <p className="text-[8px] text-muted-foreground uppercase font-black tracking-widest mb-1">Total Network Invites</p>
                        <h3 className="text-3xl font-black text-foreground tracking-tighter">{invitedFollowers.length}</h3>
                      </div>
                      <Bot className="h-8 w-8 text-[hsl(200_100%_60%)]/20 relative z-10" />
                    </div>
                    <div className="flex items-center justify-between p-4 bg-success/[0.03] border-l-4 border-success relative overflow-hidden">
                      <div className="absolute top-0 right-0 w-16 h-16 bg-success/5 rounded-full blur-2xl -mr-8 -mt-8" />
                      <div className="relative z-10">
                        <p className="text-[8px] text-muted-foreground uppercase font-black tracking-widest mb-1">Conversion Efficiency</p>
                        <h3 className="text-3xl font-black text-success tracking-tighter">15.4%</h3>
                      </div>
                      <TrendingUp className="h-8 w-8 text-success/20 relative z-10" />
                    </div>
...
                  </CardContent>
                </Card>

                <Card className="glass-card border-[hsl(200_100%_60%)]/10 overflow-hidden shadow-elevated relative">
                  <CardHeader className="p-4 border-b border-white/5 bg-white/[0.02]">
                    <CardTitle className="text-[9px] font-black uppercase tracking-[0.2em] text-[hsl(200_100%_60%)]">Status Operacional</CardTitle>
                  </CardHeader>
                  <CardContent className="p-8 flex flex-col items-center justify-center text-center space-y-6">
                    <div className="h-24 w-24 rounded-none border-4 border-primary/10 flex items-center justify-center relative p-1">
                      <div className="absolute inset-0 border-2 border-primary border-t-transparent animate-spin" />
                      <div className="absolute inset-2 border border-primary/30 border-b-transparent animate-spin [animation-direction:reverse]" />
                      <UserCheck className="h-10 w-10 text-primary animate-pulse" />
                    </div>
                    <div className="space-y-2">
                      <h4 className="font-black text-foreground uppercase tracking-[0.15em] text-sm">Modo de Expansão Ativo</h4>
                      <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest">
                        O robô está injetando convites ativamente em novas interações.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>

            <Card className="glass-card border-primary/20 overflow-hidden shadow-elevated">
            <CardHeader className="p-4 border-b border-white/5 bg-white/[0.02] flex flex-row items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-[hsl(200_100%_60%)]/10 border border-[hsl(200_100%_60%)]/20">
                  <History className="h-4 w-4 text-[hsl(200_100%_60%)]" />
                </div>
                <div>
                  <CardTitle className="text-lg font-black uppercase tracking-tighter text-[hsl(200_100%_60%)]">Log de Expansão</CardTitle>
                  <CardDescription className="text-[8px] uppercase font-bold tracking-widest text-muted-foreground">Últimos Convites Transmitidos</CardDescription>
                </div>
              </div>
              <Badge variant="outline" className="border-[hsl(200_100%_60%)] shadow-[0_0_10px_rgba(0,210,255,0.2)] text-[hsl(200_100%_60%)] font-black uppercase text-[8px] px-2 h-6">
                {invitedFollowers.length} TRANSMISSÕES
              </Badge>
            </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y divide-white/5">
                  {loadingInvited ? (
                    <div className="p-24 flex flex-col items-center gap-6">
                      <Loader2 className="h-10 w-10 animate-spin text-primary" />
                      <p className="text-[10px] text-muted-foreground uppercase font-black tracking-[0.3em] animate-pulse">Sincronizando Banco de Dados...</p>
                    </div>
                  ) : invitedFollowers.length > 0 ? (
                    invitedFollowers.map((log) => (
                      <div key={log.id} className="p-5 hover:bg-primary/[0.03] transition-all flex items-center justify-between group">
                        <div className="flex items-center gap-5">
                          <div className="h-10 w-10 rounded-none border border-primary/30 bg-primary/5 flex items-center justify-center group-hover:border-primary transition-colors">
                            <Bot className="h-5 w-5 text-primary group-hover:animate-pulse" />
                          </div>
                          <div>
                            <p className="text-sm font-bold text-foreground group-hover:text-primary transition-colors leading-tight">{log.message}</p>
                            <p className="text-[9px] text-muted-foreground uppercase font-black tracking-widest mt-1">
                              {format(new Date(log.created_at), "dd MMM yyyy '::' HH:mm", { locale: ptBR })}
                            </p>
                          </div>
                        </div>
                        <Badge variant="outline" className="text-[8px] font-black uppercase border-success/40 text-success bg-success/10 px-2 py-1 shadow-[0_0_10px_rgba(34,197,94,0.1)]">
                          TRANSMITIDO
                        </Badge>
                      </div>
                    ))
                  ) : (
                    <div className="p-24 text-center space-y-6">
                      <UserCheck className="h-14 w-14 text-muted-foreground/10 mx-auto" />
                      <p className="text-[10px] text-muted-foreground uppercase font-black tracking-[0.2em]">Nenhuma transmissão registrada no buffer</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        ) : (
          <Card className="glass-card border-[hsl(200_100%_60%)]/20 overflow-hidden shadow-elevated">
            <CardHeader className="p-4 border-b border-white/5 flex flex-row items-center justify-between bg-black/40 relative">
              <div className="absolute top-0 left-0 w-full h-0.5 bg-[hsl(200_100%_60%)] opacity-30" />
              <div className="flex items-center gap-4 relative z-10">
                <div className="h-2 w-2 bg-success rounded-full animate-pulse-dot shadow-[0_0_8px_rgba(34,197,94,0.8)]" />
                <div>
                  <CardTitle className="text-lg font-black uppercase tracking-tighter text-[hsl(200_100%_60%)]">Terminal de Comando</CardTitle>
                  <CardDescription className="text-[8px] uppercase font-bold tracking-widest text-muted-foreground">Kernel Operations Live-Feed</CardDescription>
                </div>
              </div>
              <div className="flex items-center gap-4 relative z-10">
                <span className="text-[8px] text-[hsl(200_100%_60%)]/60 font-mono font-black uppercase tracking-[0.2em] animate-pulse">System Live</span>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={fetchLogs} 
                  disabled={loadingLogs} 
                  className="h-10 w-10 p-0 text-primary hover:bg-primary/10 rounded-none border border-primary/20"
                >
                  <RefreshCw className={cn("h-5 w-5", loadingLogs && "animate-spin")} />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0 bg-black/40">
              <div className="divide-y divide-white/5 font-mono">
                {loadingLogs ? (
                  <div className="p-32 flex flex-col items-center gap-6">
                    <Loader2 className="h-10 w-10 animate-spin text-primary" />
                    <p className="text-[10px] text-muted-foreground uppercase font-black tracking-[0.3em] animate-pulse">Acessando Core Logs...</p>
                  </div>
                ) : logs.length > 0 ? (
                  logs.map((log) => (
                    <div key={log.id} className="p-3 hover:bg-white/[0.03] transition-all relative group">
                      <div className="flex items-start gap-3">
                        <div className={cn(
                          "mt-0.5 p-2 rounded-none border transition-all group-hover:scale-110",
                          log.level === 'error' ? "border-destructive/30 bg-destructive/10 text-destructive shadow-[0_0_15px_rgba(239,68,68,0.2)]" :
                          log.level === 'warn' ? "border-warning/30 bg-warning/10 text-warning" :
                           "border-[hsl(200_100%_60%)]/30 bg-[hsl(200_100%_60%)]/10 text-[hsl(200_100%_60%)] shadow-[0_0_10px_rgba(0,210,255,0.1)]"
                        )}>
                          {log.level === 'error' ? <AlertCircle className="h-3.5 w-3.5" /> :
                           log.level === 'warn' ? <AlertCircle className="h-3.5 w-3.5" /> :
                           <Bot className="h-3.5 w-3.5" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[8px] font-black uppercase tracking-[0.2em] text-[hsl(200_100%_60%)]/60 group-hover:text-[hsl(200_100%_60%)] transition-colors">
                              {log.module} <span className="text-white/20 mx-1">|</span> {format(new Date(log.created_at), "HH:mm", { locale: ptBR })}
                            </span>
                            <Badge variant="outline" className={cn(
                              "text-[8px] px-1.5 h-4 font-black uppercase tracking-widest rounded-none border",
                              log.level === 'error' ? "border-destructive text-destructive" : "border-[hsl(200_100%_60%)] text-[hsl(200_100%_60%)]"
                            )}>
                              {log.level.toUpperCase()}
                            </Badge>
                          </div>
                          <p className="text-xs font-bold text-foreground leading-tight group-hover:text-[hsl(200_100%_60%)] transition-colors truncate">{log.message}</p>
                          {log.details && (
                            <div className="mt-4 p-5 bg-black/60 border border-primary/20 shadow-inner overflow-hidden">
                              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
                                {Object.entries(log.details).filter(([key]) => ['curtidas', 'seguidores', 'compartilhamentos', 'comentarios', 'numero_postagens'].includes(key)).map(([key, value]) => (
                                  <div key={key} className="flex flex-col items-center p-2 bg-[hsl(200_100%_60%)]/[0.03] border border-[hsl(200_100%_60%)]/10 group-hover:border-[hsl(200_100%_60%)]/30 transition-colors">
                                    <span className="text-[7px] text-[hsl(200_100%_60%)]/60 font-black uppercase tracking-tighter mb-0.5">{key.replace('_', ' ')}</span>
                                    <span className="text-base font-black text-white leading-none">
                                      {typeof value === 'number' ? value.toLocaleString() : String(value)}
                                    </span>
                                  </div>
                                ))}
                              </div>
                              <div className="space-y-2 opacity-80">
                                {Object.entries(log.details).filter(([key]) => !['curtidas', 'seguidores', 'compartilhamentos', 'comentarios', 'numero_postagens'].includes(key)).map(([key, value]) => (
                                  <div key={key} className="flex gap-4 text-[11px] border-b border-white/5 pb-2 last:border-0 hover:bg-white/5 transition-colors px-1">
                                    <span className="text-primary font-black uppercase w-32 shrink-0 tracking-tighter">{key.replace('_', ' ')}:</span>
                                    <span className="text-muted-foreground break-all font-medium">
                                      {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                                    </span>
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
                  <div className="p-24 text-center">
                    <p className="text-[10px] text-muted-foreground uppercase font-black tracking-[0.3em] animate-pulse">Buffer de log vazio. Aguardando atividade...</p>
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
