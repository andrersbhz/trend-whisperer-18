import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { AtSign, Loader2, Save, Activity, ExternalLink, CheckCircle2, XCircle } from 'lucide-react';

interface ThreadsAppSettingsProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConnected?: () => void;
}

const ThreadsAppSettings = ({ open, onOpenChange, onConnected }: ThreadsAppSettingsProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [appId, setAppId] = useState('');
  const [appSecret, setAppSecret] = useState('');
  const [hasSecret, setHasSecret] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [connected, setConnected] = useState(false);
  const [statusText, setStatusText] = useState('Nenhuma credencial salva');

  const load = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [{ data: creds }, { data: accounts }] = await Promise.all([
        supabase.from('threads_app_credentials' as any).select('app_id').eq('user_id', user.id).maybeSingle(),
        supabase.from('threads_accounts' as any).select('id, username').eq('user_id', user.id).eq('is_active', true),
      ]);
      const credRow = creds as any;
      const accountRows = (accounts as any[]) || [];
      setAppId(credRow?.app_id || '');
      setHasSecret(!!credRow?.app_id);
      setConnected(accountRows.length > 0);
      setStatusText(
        accountRows.length > 0
          ? `Conta conectada: ${accountRows.map((a) => '@' + (a.username || 'threads')).join(', ')}`
          : credRow?.app_id
            ? 'Credenciais salvas. Falta autorizar sua conta do Threads.'
            : 'Nenhuma credencial salva',
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, user]);

  const save = async () => {
    if (!user) return;
    if (!appId.trim() || (!appSecret.trim() && !hasSecret)) {
      toast({ title: 'Preencha os dois campos', description: 'ID do app e chave secreta são obrigatórios.', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const payload: any = { user_id: user.id, app_id: appId.trim() };
      if (appSecret.trim()) payload.app_secret = appSecret.trim();

      const { data: existing } = await supabase
        .from('threads_app_credentials' as any)
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

      const { error } = existing
        ? await supabase.from('threads_app_credentials' as any).update(payload).eq('user_id', user.id)
        : await supabase.from('threads_app_credentials' as any).insert(payload);
      if (error) throw error;

      setAppSecret('');
      toast({ title: 'Credenciais salvas', description: 'Agora teste a conexão ou autorize sua conta do Threads.' });
      await load();
    } catch (e: any) {
      toast({ title: 'Erro ao salvar', description: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const test = async () => {
    setTesting(true);
    try {
      const { data, error } = await supabase.functions.invoke('test-threads-connection', { body: {} });
      if (error) throw error;
      setConnected(!!data?.connected && data?.success);
      setStatusText(data?.message || data?.error || 'Teste concluído');
      toast({
        title: data?.success ? 'Teste concluído' : 'Falha no teste',
        description: data?.message || data?.error,
        variant: data?.success ? 'default' : 'destructive',
      });
    } catch (e: any) {
      toast({ title: 'Falha no teste', description: e.message, variant: 'destructive' });
    } finally {
      setTesting(false);
    }
  };

  const connect = async () => {
    const { data, error } = await supabase.functions.invoke('threads-oauth-start', {
      body: { returnUrl: `${window.location.origin}/social` },
    });
    if (error || !data?.authUrl) {
      toast({ title: 'Falha ao iniciar Threads', description: error?.message || data?.error || 'OAuth indisponível', variant: 'destructive' });
      return;
    }
    onConnected?.();
    const opened = window.open(data.authUrl, '_blank', 'noopener,noreferrer');
    if (!opened) {
      try {
        if (window.top) window.top.location.href = data.authUrl;
        else window.location.href = data.authUrl;
      } catch {
        window.location.href = data.authUrl;
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AtSign className="h-5 w-5 text-primary" /> Conectar Threads
          </DialogTitle>
          <DialogDescription>
            Informe as credenciais do seu app do Threads (painel de desenvolvedores da Meta) e autorize a conta.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-lg border border-border/60 bg-muted/30 p-3 flex items-center gap-2">
          <span className={`h-2.5 w-2.5 rounded-full ${connected ? 'bg-success animate-pulse' : 'bg-destructive'}`} />
          <span className="text-xs text-muted-foreground">{statusText}</span>
        </div>

        {loading ? (
          <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="threads-app-id">ID do app do Threads</Label>
              <Input
                id="threads-app-id"
                value={appId}
                onChange={(e) => setAppId(e.target.value)}
                placeholder="Ex: 1234567890123456"
                autoComplete="off"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="threads-app-secret">Chave secreta do app do Threads</Label>
              <PasswordInput
                id="threads-app-secret"
                value={appSecret}
                onChange={(e) => setAppSecret(e.target.value)}
                placeholder={hasSecret ? 'Chave salva. Preencha apenas para substituir.' : 'Cole a chave secreta'}
                autoComplete="new-password"
              />
              <p className="text-[11px] text-muted-foreground">A chave é guardada criptografada e nunca é exibida de volta.</p>
            </div>

            <div className="flex flex-wrap gap-2 pt-1">
              <Button onClick={save} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                Salvar
              </Button>
              <Button variant="outline" onClick={test} disabled={testing || !hasSecret}>
                {testing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Activity className="h-4 w-4 mr-2" />}
                Testar conexão
              </Button>
              <Button variant="outline" onClick={connect} disabled={!hasSecret}>
                <ExternalLink className="h-4 w-4 mr-2" />
                Conectar conta
              </Button>
            </div>

            <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
              {connected ? <CheckCircle2 className="h-3.5 w-3.5 text-success" /> : <XCircle className="h-3.5 w-3.5 text-destructive" />}
              {connected ? 'Conectado — estatísticas disponíveis na aba Threads.' : 'Ainda não conectado.'}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default ThreadsAppSettings;
