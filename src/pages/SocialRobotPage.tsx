import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Loader2, RefreshCw, MessageSquare, Bot, UserCheck, ExternalLink, History, ThumbsUp, AtSign, Power, PowerOff, Activity, AlertCircle, Info, ChevronRight, ChevronDown as ChevronDownIcon } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { getErrorMessage } from '@/lib/backend';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

const SocialRobotPage = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [interactions, setInteractions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [automationEnabled, setAutomationEnabled] = useState(false);
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [logs, setLogs] = useState<any[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [activeTab, setActiveTab] = useState<'interactions' | 'telemetry'>('interactions');

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
      // Step 1: Fetch new ones from API
      await supabase.functions.invoke('handle-social-interactions', { body: { userId: user.id } });
      // Step 2: Generate AI replies
      const { data } = await supabase.functions.invoke('process-social-replies', { body: { userId: user.id } });
      
      toast({ 
        title: 'Sucesso', 
        description: `${data?.replied || 0} novas respostas humanas geradas.` 
      });
      fetchInteractions();
    } catch (error) {
      toast({ title: 'Erro no processamento', description: getErrorMessage(error), variant: 'destructive' });
    } finally {
      setProcessing(false);
    }
  };

  useEffect(() => {
    fetchInteractions();
    fetchSettings();
    fetchLogs();
  }, [user]);

  return (
    <div className="space-y-6 lg:space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold neon-text-lilac uppercase tracking-tighter flex items-center gap-3">
            <Bot className="h-8 w-8 text-primary" />
            Robô Social Humano
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Interaja com seu público de forma orgânica e automática</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Card className={cn(
            "flex items-center gap-4 px-4 py-2 border-2 transition-all duration-500",
            automationEnabled ? "border-success/50 bg-success/5 shadow-neon-success" : "border-destructive/20 bg-destructive/5"
          )}>
            <div className="flex items-center gap-3">
              <div className={cn(
                "p-2 rounded-full",
                automationEnabled ? "bg-success/20 text-success animate-pulse" : "bg-destructive/20 text-destructive"
              )}>
                {automationEnabled ? <Power className="h-5 w-5" /> : <PowerOff className="h-5 w-5" />}
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] font-black uppercase tracking-widest opacity-70">Status 24/7</span>
                <span className={cn("text-xs font-bold uppercase", automationEnabled ? "text-success" : "text-destructive")}>
                  {automationEnabled ? "Ativado" : "Desativado"}
                </span>
              </div>
              <Switch 
                checked={automationEnabled} 
                onCheckedChange={toggleAutomation}
                className="data-[state=checked]:bg-success"
              />
            </div>
          </Card>

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

      <div className="flex gap-2 mb-2 p-1 bg-white/5 w-fit rounded-lg">
        <Button 
          variant={activeTab === 'interactions' ? 'secondary' : 'ghost'} 
          size="sm" 
          onClick={() => setActiveTab('interactions')}
          className="text-[10px] uppercase font-bold tracking-widest gap-2"
        >
          <History className="h-3 w-3" />
          Interações
        </Button>
        <Button 
          variant={activeTab === 'telemetry' ? 'secondary' : 'ghost'} 
          size="sm" 
          onClick={() => {
            setActiveTab('telemetry');
            fetchLogs();
          }}
          className="text-[10px] uppercase font-bold tracking-widest gap-2"
        >
          <Activity className="h-3 w-3" />
          Telemetria
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
        ) : (
          <Card className="glass-card border-accent/20 overflow-hidden">
            <CardHeader className="pb-3 border-b border-white/5 flex flex-row items-center justify-between">
              <div className="flex items-center gap-2">
                <Activity className="h-5 w-5 text-accent" />
                <CardTitle className="text-lg uppercase tracking-tighter">Telemetria da Automação</CardTitle>
              </div>
              <Button variant="ghost" size="sm" onClick={fetchLogs} disabled={loadingLogs}>
                <RefreshCw className={cn("h-4 w-4", loadingLogs && "animate-spin")} />
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-white/5">
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
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="text-[9px] uppercase tracking-widest px-1 h-4 border-white/10">
                                {log.module}
                              </Badge>
                              <span className={cn(
                                "text-[10px] font-black uppercase tracking-tighter",
                                log.level === 'error' ? "text-destructive" :
                                log.level === 'warn' ? "text-warning" :
                                "text-primary"
                              )}>
                                {log.level}
                              </span>
                            </div>
                            <span className="text-[10px] text-muted-foreground font-medium">
                              {format(new Date(log.created_at), "HH:mm:ss 'em' dd/MM", { locale: ptBR })}
                            </span>
                          </div>
                          <p className="text-sm font-medium text-foreground">{log.message}</p>
                          {log.details && Object.keys(log.details).length > 0 && (
                            <details className="mt-2">
                              <summary className="text-[10px] cursor-pointer uppercase font-bold text-muted-foreground hover:text-primary transition-colors flex items-center gap-1">
                                Detalhes Técnicos <ChevronRight className="h-2 w-2" />
                              </summary>
                              <pre className="mt-2 p-3 bg-black/40 rounded-lg text-[10px] text-muted-foreground overflow-x-auto border border-white/5">
                                {JSON.stringify(log.details, null, 2)}
                              </pre>
                            </details>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="p-20 text-center space-y-4">
                    <div className="mx-auto w-16 h-16 rounded-full bg-accent/5 flex items-center justify-center border border-accent/10">
                      <Activity className="h-8 w-8 text-accent/40" />
                    </div>
                    <div className="max-w-xs mx-auto">
                      <p className="text-sm text-foreground font-bold uppercase tracking-widest">Sem Registros</p>
                      <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
                        A telemetria começará a aparecer assim que o ciclo de automação for executado.
                      </p>
                    </div>
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