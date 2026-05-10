import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Loader2, RefreshCw, MessageSquare, Bot, UserCheck, ExternalLink, History, ThumbsUp, AtSign, Power, PowerOff, Activity, AlertCircle, Info, Instagram, ChevronRight, ChevronDown as ChevronDownIcon } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { getErrorMessage } from '@/lib/backend';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

const SocialRobotPage = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [interactions, setInteractions] = useState<any[]>([]);
  const [metrics, setMetrics] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMetrics, setLoadingMetrics] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [automationEnabled, setAutomationEnabled] = useState(false);
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [logs, setLogs] = useState<any[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [activeTab, setActiveTab] = useState<'interactions' | 'metrics' | 'telemetry'>('telemetry');

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

  const fetchSettings = async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('user_settings')
        .select('automation_enabled')
        .eq('user_id', user.id)
        .maybeSingle();
      
      if (data) {
        setAutomationEnabled(!!data.automation_enabled);
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

  useEffect(() => {
    fetchInteractions();
    fetchSettings();
    fetchLogs();
    fetchMetrics();

    const logsChannel = supabase
      .channel('realtime-robot-data')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'automation_logs' }, () => {
        fetchLogs();
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'social_interactions' }, () => {
        fetchInteractions();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(logsChannel);
    };
  }, [user]);

  return (
    <div className="space-y-6 lg:space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold neon-text-lilac uppercase tracking-tighter flex items-center gap-3">
            <Bot className="h-8 w-8 text-primary animate-pulse" />
            Vortex Robot Log
          </h1>
          <p className="text-muted-foreground text-xs mt-1 uppercase tracking-widest flex items-center gap-2">
            <Activity className="h-3 w-3 text-success animate-pulse" />
            Sistema em Operação Real-Time
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button
            variant="outline"
            onClick={() => toggleAutomation(!automationEnabled)}
            disabled={loadingSettings}
            className={cn(
              "font-bold uppercase tracking-widest text-[10px] h-9 px-6 rounded-none transition-all shadow-sm border-2",
              automationEnabled 
                ? "border-success/50 bg-success/5 text-success hover:bg-success/10 shadow-neon-success" 
                : "border-destructive/20 bg-destructive/5 text-destructive hover:bg-destructive/10"
            )}
          >
            {loadingSettings ? (
              <Loader2 className="h-3 w-3 mr-2 animate-spin" />
            ) : automationEnabled ? (
              <Power className="h-3 w-3 mr-2 animate-pulse" />
            ) : (
              <PowerOff className="h-3 w-3 mr-2" />
            )}
            {automationEnabled ? "Robô Ligado" : "Robô Desligado"}
          </Button>

          <Button
            onClick={handleProcessInteractions}
            disabled={processing}
            size="sm"
            className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold uppercase tracking-widest text-[10px] h-9 px-6 rounded-none transition-all shadow-sm border-none"
          >
            {processing ? <Loader2 className="h-3 w-3 mr-2 animate-spin" /> : <UserCheck className="h-3 w-3 mr-2" />}
            Sincronizar
          </Button>
        </div>
      </div>

      <div className="flex gap-1 mb-2 p-1 bg-white/[0.03] w-fit rounded-none border border-white/5">
        <Button 
          variant={activeTab === 'telemetry' ? 'secondary' : 'ghost'} 
          size="sm" 
          onClick={() => {
            setActiveTab('telemetry');
            fetchLogs();
          }}
          className="text-[9px] uppercase font-bold tracking-widest h-7 px-3 rounded-none relative overflow-hidden group"
        >
          {activeTab === 'telemetry' && <div className="absolute inset-0 bg-primary/10 animate-pulse" />}
          <Bot className={cn("h-3 w-3 mr-1.5 opacity-70 z-10", activeTab === 'telemetry' && "animate-pulse")} />
          <span className="z-10 text-primary">Log do Robô</span>
        </Button>
        <Button 
          variant={activeTab === 'interactions' ? 'secondary' : 'ghost'} 
          size="sm" 
          onClick={() => setActiveTab('interactions')}
          className="text-[9px] uppercase font-bold tracking-widest h-7 px-3 rounded-none"
        >
          <History className="h-3 w-3 mr-1.5 opacity-70" />
          Interações
        </Button>
        <Button 
          variant={activeTab === 'metrics' ? 'secondary' : 'ghost'} 
          size="sm" 
          onClick={() => {
            setActiveTab('metrics');
            fetchMetrics();
          }}
          className="text-[9px] uppercase font-bold tracking-widest h-7 px-3 rounded-none"
        >
          <Activity className="h-3 w-3 mr-1.5 opacity-70" />
          Métricas
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {activeTab === 'interactions' ? (
          <Card className="glass-card neon-border-lilac overflow-hidden">
            <CardHeader className="pb-3 border-b border-white/5 flex flex-row items-center justify-between">
              <div className="flex items-center gap-2">
                <History className="h-5 w-5 text-primary" />
                <CardTitle className="text-lg uppercase tracking-tighter">Histórico de Interações</CardTitle>
              </div>
              <Badge variant="outline" className="border-primary/20 text-primary">
                {interactions.length} Interações
              </Badge>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-white/5">
                {loading ? (
                  <div className="p-20 flex flex-col items-center gap-4">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    <p className="text-xs text-muted-foreground uppercase tracking-widest">Escaneando redes sociais...</p>
                  </div>
                ) : interactions.length > 0 ? (
                  interactions.map((item) => (
                    <div key={item.id} className="p-6 hover:bg-white/5 transition-all group">
                      <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
                        <div className="flex gap-4 min-w-0 flex-1">
                          <div className="relative shrink-0">
                            <div className="h-12 w-12 rounded-none border-2 border-primary/20 bg-background overflow-hidden shadow-neon-lilac/20">
                              {item.author_avatar ? (
                                <img src={item.author_avatar} alt={item.author_name} className="h-full w-full object-cover" />
                              ) : (
                                <div className="h-full w-full flex items-center justify-center bg-primary/10 text-primary text-lg font-black">
                                  {item.author_name?.substring(0, 1).toUpperCase()}
                                </div>
                              )}
                            </div>
                            {item.page_avatar && (
                              <div className="absolute -top-2 -right-2 h-6 w-6 rounded-full border border-primary/40 bg-background overflow-hidden shadow-sm z-10">
                                <img src={item.page_avatar} alt="Página" className="h-full w-full object-cover" />
                              </div>
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-3 mb-2 flex-wrap">
                              <span className="text-sm font-black text-primary uppercase tracking-tight">{item.author_name}</span>
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className="text-[10px] h-4 px-2 border-primary/20 text-primary bg-primary/5">
                                  {item.platform}
                                </Badge>
                                <Badge variant="secondary" className={cn(
                                  "text-[9px] h-4 px-2 border-none font-bold",
                                  item.interaction_type === 'reaction' ? "bg-blue-500/20 text-blue-400" : 
                                  item.interaction_type === 'mention' ? "bg-purple-500/20 text-purple-400" : 
                                  "bg-lilac-500/20 text-lilac-400"
                                )}>
                                  {item.interaction_type === 'reaction' ? <ThumbsUp className="h-2 w-2 mr-1" /> : 
                                   item.interaction_type === 'mention' ? <AtSign className="h-2 w-2 mr-1" /> : 
                                   <MessageSquare className="h-2 w-2 mr-1" />}
                                  {item.interaction_type === 'reaction' ? 'Curtida' : 
                                   item.interaction_type === 'mention' ? 'Menção' : 'Comentário'}
                                </Badge>
                              </div>
                              <span className="text-[10px] text-muted-foreground font-medium uppercase">
                                {format(new Date(item.created_at), "dd/MM 'às' HH:mm", { locale: ptBR })}
                              </span>
                              {item.original_link && (
                                <a 
                                  href={item.original_link} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="text-[10px] text-primary hover:underline flex items-center gap-1 font-bold uppercase"
                                >
                                  Ver Original <ExternalLink className="h-2 w-2" />
                                </a>
                              )}
                            </div>
                            <div className="bg-white/5 p-4 border-l-4 border-white/10 mb-4">
                              <p className="text-sm text-foreground italic leading-relaxed">"{item.content}"</p>
                            </div>
                            
                            {item.ai_response && (
                              <div className="mt-4 flex gap-4 items-start bg-primary/5 p-4 border-l-4 border-primary shadow-neon-lilac/5">
                                <MessageSquare className="h-4 w-4 text-primary mt-1 shrink-0" />
                                <div className="space-y-1">
                                  <p className="text-[10px] font-black text-primary uppercase tracking-widest mb-1">Resposta da IA</p>
                                  <p className="text-sm text-foreground leading-relaxed font-medium">{item.ai_response}</p>
                                  {item.processed_at && (
                                    <p className="text-[9px] text-muted-foreground italic mt-2">
                                      Processado em {format(new Date(item.processed_at), "dd/MM HH:mm", { locale: ptBR })}
                                    </p>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex flex-row md:flex-col items-center md:items-end gap-3">
                          <Badge 
                            variant="secondary" 
                            className={cn(
                              "text-[10px] uppercase font-black px-3 py-1 tracking-widest",
                              item.status === 'replied' ? "bg-success/20 text-success border border-success/30" : 
                              item.status === 'processed' ? "bg-blue-500/20 text-blue-400 border border-blue-500/30" :
                              "bg-warning/20 text-warning border border-warning/30"
                            )}
                          >
                            {item.status === 'replied' ? 'Respondido ✓' : 
                             item.status === 'processed' ? 'Analisado ✓' : 
                             'Pendente'}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="p-20 text-center space-y-4">
                    <div className="mx-auto w-16 h-16 rounded-full bg-primary/5 flex items-center justify-center border border-primary/10">
                      <Bot className="h-8 w-8 text-primary/40" />
                    </div>
                    <div className="max-w-xs mx-auto">
                      <p className="text-sm text-foreground font-bold uppercase tracking-widest">Silêncio no Vortex</p>
                      <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
                        Nenhuma interação recente encontrada nas suas páginas conectadas. Clique em sincronizar para buscar novos comentários.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ) : activeTab === 'metrics' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {loadingMetrics ? (
              <Card className="col-span-full p-20 flex flex-col items-center gap-4 glass-card neon-border-lilac">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-xs text-muted-foreground uppercase tracking-widest">Analisando métricas das páginas...</p>
              </Card>
            ) : metrics.length > 0 ? (
              metrics.map((page) => (
                <Card key={page.page_id} className="glass-card neon-border-lilac overflow-hidden flex flex-col">
                  <CardHeader className="pb-3 border-b border-white/5 bg-white/5">
                    <div className="flex items-center gap-4">
                      <div className="h-12 w-12 rounded-none border-2 border-primary/20 bg-background overflow-hidden shadow-neon-lilac/20">
                        <img src={page.facebook?.picture?.data?.url || `https://graph.facebook.com/${page.page_id}/picture?type=large`} className="h-full w-full object-cover" alt="" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <CardTitle className="text-lg uppercase tracking-tighter truncate">{page.page_name}</CardTitle>
                        <div className="flex flex-wrap gap-2 mt-1">
                          <Badge variant="outline" className="text-[9px] px-1 border-primary/20 text-primary">FB: {page.facebook?.fan_count || 0} Seguidores</Badge>
                          {page.instagram && (
                            <Badge variant="outline" className="text-[9px] px-1 border-purple-500/20 text-purple-400">IG: {page.instagram.followers_count || 0}</Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="p-4 space-y-4 flex-1">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      <div className="bg-white/5 p-3 border border-white/5 text-center flex flex-col justify-center">
                        <p className="text-[10px] text-muted-foreground uppercase font-black tracking-tighter mb-1">Postagens</p>
                        <p className="text-xl font-black text-primary leading-none">{page.facebook?.post_stats?.total_posts || 0}</p>
                      </div>
                      <div className="bg-white/5 p-3 border border-white/5 text-center flex flex-col justify-center">
                        <p className="text-[10px] text-muted-foreground uppercase font-black tracking-tighter mb-1">Curtidas</p>
                        <p className="text-xl font-black text-primary leading-none">{page.facebook?.post_stats?.total_likes || 0}</p>
                      </div>
                      <div className="bg-white/5 p-3 border border-white/5 text-center flex flex-col justify-center">
                        <p className="text-[10px] text-muted-foreground uppercase font-black tracking-tighter mb-1">Comentários</p>
                        <p className="text-xl font-black text-primary leading-none">{page.facebook?.post_stats?.total_comments || 0}</p>
                      </div>
                      <div className="bg-white/5 p-3 border border-white/5 text-center flex flex-col justify-center">
                        <p className="text-[10px] text-muted-foreground uppercase font-black tracking-tighter mb-1">Compartilhamentos</p>
                        <p className="text-xl font-black text-primary leading-none">{page.facebook?.post_stats?.total_shares || 0}</p>
                      </div>
                    </div>
                    
                    {page.instagram?.post_stats && (
                      <div className="pt-2 border-t border-white/5">
                        <p className="text-[9px] font-black text-purple-400 uppercase tracking-widest mb-2 flex items-center gap-1">
                          <Instagram className="h-3 w-3" /> Instagram Stats (Total Analisado)
                        </p>
                        <div className="grid grid-cols-3 gap-2">
                          <div className="bg-purple-500/5 p-2 border border-purple-500/10 text-center">
                            <p className="text-[8px] text-muted-foreground uppercase">Posts</p>
                            <p className="text-md font-bold text-purple-400">{page.instagram.post_stats.total_posts || 0}</p>
                          </div>
                          <div className="bg-purple-500/5 p-2 border border-purple-500/10 text-center">
                            <p className="text-[8px] text-muted-foreground uppercase">Likes</p>
                            <p className="text-md font-bold text-purple-400">{page.instagram.post_stats.total_likes || 0}</p>
                          </div>
                          <div className="bg-purple-500/5 p-2 border border-purple-500/10 text-center">
                            <p className="text-[8px] text-muted-foreground uppercase">Engajamento</p>
                            <p className="text-md font-bold text-purple-400">{page.instagram.post_stats.avg_engagement || 0}</p>
                          </div>
                        </div>
                      </div>
                    )}

                    {page.facebook?.insights?.page_impressions && (
                      <div className="pt-2 border-t border-white/5">
                        <div className="flex justify-between items-center mb-1">
                          <p className="text-[9px] font-black text-success uppercase tracking-widest">Alcance (28 dias)</p>
                          <span className="text-xs font-bold text-success">+{page.facebook.insights.page_impressions.total.toLocaleString()}</span>
                        </div>
                        <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-success shadow-neon-success" 
                            style={{ width: `${Math.min(100, (page.facebook.insights.page_impressions.total / 10000) * 100)}%` }} 
                          />
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))
            ) : (
              <Card className="col-span-full p-20 text-center space-y-4 glass-card neon-border-lilac">
                <Bot className="h-12 w-12 text-primary/40 mx-auto" />
                <p className="text-sm font-bold uppercase tracking-widest">Nenhuma métrica disponível</p>
                <Button variant="outline" size="sm" onClick={fetchMetrics} className="uppercase text-[10px] font-bold">Tentar Novamente</Button>
              </Card>
            )}
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
                            <div className="mt-2 p-2 bg-black/40 rounded border border-white/5 overflow-hidden">
                              <pre className="text-[10px] text-muted-foreground font-mono whitespace-pre-wrap break-all">
                                {JSON.stringify(log.details, null, 2)}
                              </pre>
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
