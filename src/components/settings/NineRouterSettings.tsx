import { useEffect, useState } from 'react';
import { Network, Loader2, CheckCircle2, XCircle, Wifi, Save } from 'lucide-react';
import ConnectionCard from '@/components/ConnectionCard';
import { PasswordInput } from '@/components/ui/password-input';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

const DEFAULT_ENDPOINT = 'https://9router-e7ep.srv2129112.hstgr.cloud/v1';

export default function NineRouterSettings() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [endpoint, setEndpoint] = useState(DEFAULT_ENDPOINT);
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState('auto');
  const [enabled, setEnabled] = useState(true);
  const [hasKey, setHasKey] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);
  const [models, setModels] = useState<{ id: string }[]>([]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase.from('user_settings')
        .select('ninerouter_endpoint, ninerouter_model, ninerouter_enabled').eq('user_id', user.id).maybeSingle();
      if (data?.ninerouter_endpoint) { setEndpoint(data.ninerouter_endpoint); setSaved(true); }
      if (data?.ninerouter_model) setModel(data.ninerouter_model);
      if (data) setEnabled(data.ninerouter_enabled !== false);
      const { data: k } = await supabase.rpc('get_ninerouter_status' as any);
      setHasKey(!!k);
    })();
  }, [user]);

  const test = async () => {
    setTesting(true); setResult(null);
    const { data, error } = await supabase.functions.invoke('test-ninerouter-connection', { body: { endpoint, api_key: apiKey || undefined } });
    const ok = !!data?.success;
    setResult({ success: ok, message: data?.message || data?.error || error?.message || 'Falha' });
    if (ok) setModels(data.models || []);
    setTesting(false);
  };

  const save = async () => {
    if (!user) return;
    setSaving(true);
    const payload: any = { ninerouter_endpoint: endpoint.trim(), ninerouter_model: model.trim() || 'auto', ninerouter_enabled: enabled };
    if (apiKey) payload.ninerouter_api_key = apiKey.trim();
    const { data: ex } = await supabase.from('user_settings').select('id').eq('user_id', user.id).maybeSingle();
    const { error } = ex
      ? await supabase.from('user_settings').update(payload).eq('user_id', user.id)
      : await supabase.from('user_settings').insert({ ...payload, user_id: user.id });
    setSaving(false);
    if (error) return toast({ title: 'Erro ao salvar', description: error.message, variant: 'destructive' });
    if (apiKey) { setHasKey(true); setApiKey(''); }
    setSaved(true);
    toast({ title: '9Router salvo', description: enabled ? 'Será usado primeiro na criação dos artigos.' : 'Salvo, mas desativado.' });
  };

  const disconnect = async () => {
    if (!user) return;
    await supabase.from('user_settings').update({ ninerouter_endpoint: null, ninerouter_api_key: null } as any).eq('user_id', user.id);
    setSaved(false); setHasKey(false); setResult(null); setModels([]);
    toast({ title: '9Router desconectado' });
  };

  return (
    <ConnectionCard
      icon={<Network className="h-5 w-5 text-primary" />}
      title="9Router (Gateway de IA)"
      description="Seu roteador próprio com vários provedores. Quando ativo, é usado primeiro; se falhar, o sistema passa para Gemini, OpenAI e Groq."
      connected={saved}
      connectedInfo={saved ? (enabled ? 'Ativo como IA principal ✓' : 'Configurado (desativado)') : undefined}
      onTest={test}
      testing={testing}
      onDisconnect={disconnect}
    >
      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label className="text-xs">Endereço da API</Label>
          <Input value={endpoint} onChange={(e) => setEndpoint(e.target.value)} className="h-9 text-sm" placeholder={DEFAULT_ENDPOINT} />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Chave de API do 9Router</Label>
          <PasswordInput value={apiKey} onChange={(e) => setApiKey(e.target.value)} className="h-9 text-sm"
            placeholder={hasKey ? '••••••••  (salva no servidor)' : 'Cole sua chave sk-...'} />
          <p className="text-[10px] text-muted-foreground">Deixe em branco para manter a chave atual. A chave fica criptografada.</p>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Modelo ou combo</Label>
          {models.length > 0 ? (
            <Select value={model} onValueChange={setModel}>
              <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent className="max-h-72">
                {!models.some((m) => m.id === model) && <SelectItem value={model}>{model}</SelectItem>}
                {models.map((m) => <SelectItem key={m.id} value={m.id}>{m.id}</SelectItem>)}
              </SelectContent>
            </Select>
          ) : (
            <Input value={model} onChange={(e) => setModel(e.target.value)} className="h-9 text-sm" placeholder="auto" />
          )}
          <p className="text-[10px] text-muted-foreground">Clique em "Testar Conexão" para escolher da lista de modelos do seu 9Router.</p>
        </div>
        <div className="flex items-center justify-between rounded-lg border border-border p-2.5">
          <span className="text-xs">Usar 9Router como IA principal</span>
          <Switch checked={enabled} onCheckedChange={setEnabled} />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button type="button" size="sm" variant="outline" onClick={test} disabled={testing} className="gap-2">
            {testing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wifi className="h-3.5 w-3.5" />}
            {testing ? 'Testando...' : 'Testar Conexão'}
          </Button>
          <Button type="button" size="sm" onClick={save} disabled={saving} className="gap-2">
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} Salvar 9Router
          </Button>
          {result && (
            <div className={`flex items-center gap-1.5 text-xs ${result.success ? 'text-success' : 'text-destructive'}`}>
              {result.success ? <CheckCircle2 className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}
              <span>{result.message}</span>
            </div>
          )}
        </div>
      </div>
    </ConnectionCard>
  );
}
