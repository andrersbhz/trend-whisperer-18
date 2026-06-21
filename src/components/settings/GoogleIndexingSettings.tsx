import { useState, useEffect } from 'react';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Search, LogIn, Loader2, RefreshCw, CheckCircle2, History, ExternalLink, AlertCircle } from 'lucide-react';
import ConnectionCard from '@/components/ConnectionCard';
import type { UserSettings } from '@/pages/SettingsPage';
import { forwardRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

interface Props {
  settings: UserSettings;
  onChange: (partial: Partial<UserSettings>) => void;
}

const GoogleIndexingSettings = forwardRef<HTMLDivElement, Props>(({ settings, onChange }, ref) => {
  const { toast } = useToast();
  const [oauthLoading, setOauthLoading] = useState(false);
  const [hasGoogleToken, setHasGoogleToken] = useState(false);
  const [history, setHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const connected = !!settings.google_indexing_key || hasGoogleToken;

  useEffect(() => {
    const checkConnector = async () => {
      const { data } = await supabase.functions.invoke('google-search-console-status');
      if (data?.connected) setHasGoogleToken(true);
    };
    checkConnector();
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    setLoadingHistory(true);
    try {
      const { data, error } = await supabase
        .from('google_indexing_history' as any)
        .select('*, articles(title)')
        .order('created_at', { ascending: false })
        .limit(10);
      
      if (error) throw error;
      setHistory(data || []);
    } catch (e) {
      console.error('Error fetching indexing history:', e);
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleGoogleConnect = async () => {
    setOauthLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('google-search-console-status');
      if (error) throw error;
      if (data?.connected) {
        setHasGoogleToken(true);
        toast({ title: 'Google Search Console conectado!' });
      } else {
        toast({
          title: 'Conexão Google não encontrada',
          description: 'Abra Configurações → Conectores e vincule "Google Search Console".',
          variant: 'destructive',
        });
      }
    } catch (e: any) {
      toast({ title: 'Erro ao verificar', description: e.message, variant: 'destructive' });
    } finally {
      setOauthLoading(false);
    }
  };

  return (
    <ConnectionCard
      ref={ref}
      icon={<Search className="h-5 w-5 text-primary" />}
      title="Google Search Console / Indexing API"
      description="Indexação imediata e monitoramento de novos posts no Google"
      connected={connected}
      connectedInfo={connected ? (hasGoogleToken ? "Conectado via Google OAuth" : "Configurado (Chave JSON)") : undefined}
      onTest={handleGoogleConnect}
      testing={oauthLoading}
      onDisconnect={async () => {
        if (hasGoogleToken) {
           await supabase.from('user_settings').update({ google_search_console_token: null } as any).eq('user_id', (await supabase.auth.getUser()).data.user?.id);
           setHasGoogleToken(false);
        }
        onChange({ google_indexing_key: '' });
      }}
    >
      <div className="space-y-4">
        <div className="p-3 rounded-lg border border-primary/40 bg-gradient-to-br from-primary/10 to-accent/10">
          <div className="flex items-start gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground">Conectar com Conta Google (Simples)</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Maneira mais rápida de autorizar a indexação automática via Search Console.
              </p>
            </div>
            <Button
              size="sm"
              onClick={handleGoogleConnect}
              disabled={oauthLoading}
              className="gradient-primary shrink-0"
            >
              {oauthLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : hasGoogleToken ? (
                <><RefreshCw className="h-4 w-4 mr-1.5" />Reconectar</>
              ) : (
                <><LogIn className="h-4 w-4 mr-1.5" />Conectar</>
              )}
            </Button>
          </div>
        </div>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-border" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-background px-2 text-muted-foreground">Ou use chave JSON</span>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">Chave JSON da Conta de Serviço (Avançado)</Label>
          <Textarea
            placeholder='{"type": "service_account", "project_id": "...", ...}'
            value={settings.google_indexing_key || ''}
            onChange={(e) => onChange({ google_indexing_key: e.target.value })}
            className="h-20 text-xs font-mono"
          />
        </div>

        <Collapsible open={showHistory} onOpenChange={setShowHistory} className="space-y-2 border-t border-border pt-4 mt-4">
          <div className="flex items-center justify-between">
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="p-0 h-auto hover:bg-transparent text-muted-foreground flex items-center gap-2">
                <History className="h-4 w-4" />
                <span className="text-xs font-medium uppercase tracking-wider">Histórico de Indexação</span>
              </Button>
            </CollapsibleTrigger>
            {loadingHistory && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
          </div>

          <CollapsibleContent className="space-y-3">
            {history.length === 0 && !loadingHistory ? (
              <p className="text-xs text-muted-foreground italic py-2">Nenhuma solicitação enviada ainda.</p>
            ) : (
              <ScrollArea className="h-[200px] pr-4">
                <div className="space-y-3 pt-2">
                  {history.map((item) => (
                    <div key={item.id} className="p-2.5 rounded-md bg-muted/50 border border-border flex flex-col gap-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <Badge variant={item.status === 'success' ? 'default' : 'destructive'} className="text-[10px] h-4 px-1">
                          {item.status === 'success' ? 'Sucesso' : 'Erro'}
                        </Badge>
                        <span className="text-[10px] text-muted-foreground">
                          {format(new Date(item.created_at), "dd/MM 'às' HH:mm", { locale: ptBR })}
                        </span>
                      </div>
                      
                      <div className="flex flex-col">
                        {item.articles?.title && (
                          <span className="text-xs font-semibold line-clamp-1">{item.articles.title}</span>
                        )}
                        <div className="flex items-center gap-1 mt-0.5">
                          <span className="text-[10px] text-muted-foreground truncate flex-1">{item.url}</span>
                          <a href={item.url} target="_blank" rel="noopener noreferrer" className="text-primary hover:text-primary/80">
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        </div>
                      </div>

                      {item.status === 'error' && item.response_details?.error?.message && (
                        <div className="mt-1 p-1.5 rounded bg-destructive/10 border border-destructive/20 flex items-start gap-1.5">
                          <AlertCircle className="h-3 w-3 text-destructive shrink-0 mt-0.5" />
                          <span className="text-[10px] text-destructive line-clamp-2">
                            {item.response_details.error.message}
                          </span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
            <Button 
              variant="outline" 
              size="sm" 
              className="w-full text-[10px] h-7" 
              onClick={fetchHistory}
              disabled={loadingHistory}
            >
              <RefreshCw className={`h-3 w-3 mr-1.5 ${loadingHistory ? 'animate-spin' : ''}`} />
              Atualizar Histórico
            </Button>
          </CollapsibleContent>
        </Collapsible>
      </div>
    </ConnectionCard>
  );
});

GoogleIndexingSettings.displayName = 'GoogleIndexingSettings';

export default GoogleIndexingSettings;

