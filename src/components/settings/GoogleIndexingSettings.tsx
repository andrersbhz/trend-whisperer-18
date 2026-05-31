import { useState, useEffect } from 'react';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Search, LogIn, Loader2, RefreshCw, CheckCircle2 } from 'lucide-react';
import ConnectionCard from '@/components/ConnectionCard';
import type { UserSettings } from '@/pages/SettingsPage';
import { forwardRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface Props {
  settings: UserSettings;
  onChange: (partial: Partial<UserSettings>) => void;
}

const GoogleIndexingSettings = forwardRef<HTMLDivElement, Props>(({ settings, onChange }, ref) => {
  const { toast } = useToast();
  const [oauthLoading, setOauthLoading] = useState(false);
  const [hasGoogleToken, setHasGoogleToken] = useState(false);
  const connected = !!settings.google_indexing_key || hasGoogleToken;

  useEffect(() => {
    const checkConnector = async () => {
      const { data } = await supabase.functions.invoke('google-search-console-status');
      if (data?.connected) setHasGoogleToken(true);
    };
    checkConnector();
  }, []);

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
      </div>
    </ConnectionCard>
  );
});

GoogleIndexingSettings.displayName = 'GoogleIndexingSettings';

export default GoogleIndexingSettings;

