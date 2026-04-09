import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { Label } from '@/components/ui/label';
import { Globe, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import ConnectionCard from '@/components/ConnectionCard';
import type { UserSettings } from '@/pages/SettingsPage';

interface Props {
  settings: UserSettings;
  onChange: (partial: Partial<UserSettings>) => void;
}

const WordPressSettings = ({ settings, onChange }: Props) => {
  const connected = !!(settings.wordpress_url && settings.wordpress_app_password);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<'success' | 'error' | null>(null);
  const { toast } = useToast();

  const testConnection = async () => {
    if (!settings.wordpress_url || !settings.wordpress_app_password) {
      toast({ title: 'Preencha URL e Chave/Senha', variant: 'destructive' });
      return;
    }
    setTesting(true);
    setTestResult(null);
    try {
      const wpUrl = settings.wordpress_url.replace(/\/$/, '');
      const isPlugin = !settings.wordpress_username || settings.wordpress_username.toLowerCase() === 'autoblog-ai';

      let res: Response;
      if (isPlugin) {
        res = await fetch(`${wpUrl}/wp-json/autoblog-ai/v1/status`, {
          headers: { 'X-AutoBlog-Key': settings.wordpress_app_password },
        });
      } else {
        const auth = btoa(`${settings.wordpress_username}:${settings.wordpress_app_password}`);
        res = await fetch(`${wpUrl}/wp-json/wp/v2/users/me`, {
          headers: { Authorization: `Basic ${auth}` },
        });
      }

      if (res.ok) {
        setTestResult('success');
        toast({ title: '✅ Conexão WordPress OK!' });
      } else {
        setTestResult('error');
        toast({ title: `❌ Erro ${res.status}`, variant: 'destructive' });
      }
    } catch (e: any) {
      setTestResult('error');
      toast({ title: '❌ Falha na conexão', description: e.message, variant: 'destructive' });
    } finally {
      setTesting(false);
    }
  };

  return (
    <ConnectionCard
      icon={<Globe className="h-5 w-5 text-primary" />}
      title="WordPress"
      description="Publicação automática via Plugin AutoBlog AI ou REST API"
      connected={connected}
      connectedInfo={connected ? `Conectado a ${settings.wordpress_url}` : undefined}
      onDisconnect={() => onChange({ wordpress_url: '', wordpress_username: '', wordpress_app_password: '' })}
    >
      <div className="space-y-3">
        <div className="p-2.5 rounded-lg bg-accent/30 border border-accent/50 text-xs text-muted-foreground">
          <strong className="text-foreground">💡 Plugin recomendado:</strong> Instale o plugin <code className="text-primary">AutoBlog AI Connector</code> no WordPress. 
          Se usar o plugin, deixe o campo Usuário vazio ou digite <code className="text-primary">autoblog-ai</code>.
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">URL do WordPress</Label>
          <Input
            placeholder="https://meublog.com.br"
            value={settings.wordpress_url}
            onChange={(e) => onChange({ wordpress_url: e.target.value })}
            className="h-9 text-sm"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Usuário <span className="text-muted-foreground">(vazio = modo Plugin)</span></Label>
          <Input
            placeholder="admin ou deixe vazio para modo plugin"
            value={settings.wordpress_username}
            onChange={(e) => onChange({ wordpress_username: e.target.value })}
            className="h-9 text-sm"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Chave API / Senha de Aplicativo</Label>
          <PasswordInput
            placeholder="Cole a chave do plugin ou senha de aplicativo"
            value={settings.wordpress_app_password}
            onChange={(e) => onChange({ wordpress_app_password: e.target.value })}
            className="h-9 text-sm"
          />
          <p className="text-[10px] text-muted-foreground">
            Plugin: copie da página Configurações → AutoBlog AI no WordPress. Padrão: gere em Usuários → Perfil → Senhas de Aplicativo.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={testConnection}
          disabled={testing}
          className="w-full"
        >
          {testing ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : testResult === 'success' ? (
            <CheckCircle2 className="h-4 w-4 mr-2 text-green-400" />
          ) : testResult === 'error' ? (
            <XCircle className="h-4 w-4 mr-2 text-red-400" />
          ) : null}
          {testing ? 'Testando...' : 'Testar Conexão'}
        </Button>
      </div>
    </ConnectionCard>
  );
};

export default WordPressSettings;
