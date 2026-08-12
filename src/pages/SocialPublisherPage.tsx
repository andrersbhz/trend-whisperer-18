import { useEffect, useMemo, useState } from 'react';
import { Facebook, Instagram, MessageSquareText, Plus, RefreshCw, Send, CheckCircle2, AlertCircle, Trash2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

type SocialAccount = {
  key: string;
  platform: 'facebook' | 'instagram' | 'threads';
  name: string;
  subtitle?: string;
  avatar?: string | null;
  active: boolean;
};

const SocialPublisherPage = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [accounts, setAccounts] = useState<SocialAccount[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState(false);
  const [caption, setCaption] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [results, setResults] = useState<any[]>([]);

  const loadAccounts = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [{ data: meta }, { data: threads }] = await Promise.all([
        supabase
          .from('facebook_accounts')
          .select('page_id,page_name,picture_url,instagram_account_id,is_active')
          .eq('user_id', user.id)
          .eq('is_active', true),
        supabase
          .from('threads_accounts' as any)
          .select('id,threads_user_id,username,is_active')
          .eq('user_id', user.id)
          .eq('is_active', true),
      ]);

      const next: SocialAccount[] = [];
      for (const row of (meta || []) as any[]) {
        next.push({
          key: `facebook:${row.page_id}`,
          platform: 'facebook',
          name: row.page_name || row.page_id,
          subtitle: 'Página do Facebook',
          avatar: row.picture_url,
          active: true,
        });
        if (row.instagram_account_id) {
          next.push({
            key: `instagram:${row.instagram_account_id}`,
            platform: 'instagram',
            name: `${row.page_name} · Instagram`,
            subtitle: `Instagram Business vinculado a ${row.page_name}`,
            avatar: row.picture_url,
            active: true,
          });
        }
      }
      for (const row of (threads || []) as any[]) {
        next.push({
          key: `threads:${row.id}`,
          platform: 'threads',
          name: row.username ? `@${row.username}` : row.threads_user_id,
          subtitle: 'Perfil do Threads',
          active: true,
        });
      }
      setAccounts(next);
      setSelected((current) => current.filter((k) => next.some((a) => a.key === k)));
    } catch (e: any) {
      toast({ title: 'Erro ao carregar contas', description: e.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadAccounts(); }, [user]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const threads = params.get('threads');
    if (threads === 'connected') {
      toast({ title: 'Threads conectado', description: 'A conta já pode ser selecionada para publicação.' });
      loadAccounts();
      window.history.replaceState({}, '', '/social');
    } else if (threads === 'error') {
      toast({ title: 'Falha ao conectar Threads', description: params.get('message') || 'Verifique o app da Meta.', variant: 'destructive' });
      window.history.replaceState({}, '', '/social');
    }
  }, []);

  const selectedAccounts = useMemo(() => accounts.filter((a) => selected.includes(a.key)), [accounts, selected]);
  const toggle = (key: string) => setSelected((s) => s.includes(key) ? s.filter((x) => x !== key) : [...s, key]);

  const connectMeta = async () => {
    const { data, error } = await supabase.functions.invoke('facebook-oauth-start', {
      body: { returnUrl: `${window.location.origin}/social` },
    });
    if (error || !data?.authUrl) {
      toast({ title: 'Falha ao iniciar Meta', description: error?.message || data?.error || 'OAuth indisponível', variant: 'destructive' });
      return;
    }
    window.location.href = data.authUrl;
  };

  const connectThreads = async () => {
    const { data, error } = await supabase.functions.invoke('threads-oauth-start', {
      body: { returnUrl: `${window.location.origin}/social` },
    });
    if (error || !data?.authUrl) {
      toast({ title: 'Falha ao iniciar Threads', description: error?.message || data?.error || 'OAuth indisponível', variant: 'destructive' });
      return;
    }
    window.location.href = data.authUrl;
  };

  const removeThreads = async (key: string) => {
    const id = key.replace('threads:', '');
    const { error } = await supabase.from('threads_accounts' as any).delete().eq('id', id);
    if (error) return toast({ title: 'Erro ao remover', description: error.message, variant: 'destructive' });
    toast({ title: 'Conta removida' });
    loadAccounts();
  };

  const publish = async () => {
    if (!user) return;
    if (!caption.trim()) return toast({ title: 'Escreva uma legenda', variant: 'destructive' });
    if (selected.length === 0) return toast({ title: 'Selecione ao menos uma conta', variant: 'destructive' });

    setPublishing(true);
    setResults([]);
    try {
      const { data, error } = await supabase.functions.invoke('publish-social', {
        body: {
          userId: user.id,
          content: { caption: caption.trim(), imageUrl: imageUrl.trim() || null, linkUrl: linkUrl.trim() || null },
          targetKeys: selected,
        },
      });
      if (error) throw error;
      setResults(data?.results || []);
      toast({
        title: data?.success ? 'Publicação concluída' : 'Nenhuma publicação concluída',
        description: data?.message,
        variant: data?.success ? 'default' : 'destructive',
      });
    } catch (e: any) {
      toast({ title: 'Erro ao publicar', description: e.message, variant: 'destructive' });
    } finally {
      setPublishing(false);
    }
  };

  const iconFor = (platform: SocialAccount['platform']) => platform === 'facebook' ? Facebook : platform === 'instagram' ? Instagram : MessageSquareText;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between border-b border-border/60 pb-5">
        <div>
          <p className="text-[11px] uppercase tracking-[0.2em] font-semibold text-muted-foreground">Social Publisher</p>
          <h1 className="text-2xl font-semibold tracking-tight mt-1">Publicação independente em redes sociais</h1>
          <p className="text-sm text-muted-foreground mt-2 max-w-2xl">Publique diretamente no Facebook, Instagram e Threads. O WordPress continua disponível, mas não é necessário para este fluxo.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={loadAccounts} disabled={loading}><RefreshCw className={loading ? 'animate-spin' : ''} />Atualizar</Button>
          <Button variant="outline" onClick={connectMeta}><Plus />Adicionar Meta</Button>
          <Button onClick={connectThreads}><Plus />Adicionar Threads</Button>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <Card className="border-border/60 bg-card/70 shadow-sm">
          <CardHeader><CardTitle className="text-base font-semibold">Contas conectadas</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {accounts.length === 0 && !loading && <div className="rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground text-center">Nenhuma conta encontrada. Use “Adicionar Meta” ou “Adicionar Threads”.</div>}
            {accounts.map((account) => {
              const Icon = iconFor(account.platform);
              const checked = selected.includes(account.key);
              return (
                <div key={account.key} className={`flex items-center gap-3 rounded-lg border p-3 transition-colors ${checked ? 'border-primary bg-primary/5' : 'border-border/60 bg-background/35 hover:bg-muted/40'}`}>
                  <button onClick={() => toggle(account.key)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                    <div className="h-10 w-10 rounded-lg border border-border/60 bg-background flex items-center justify-center overflow-hidden shrink-0">{account.avatar ? <img src={account.avatar} alt="" className="h-full w-full object-cover" /> : <Icon className="h-4 w-4" />}</div>
                    <div className="min-w-0 flex-1"><p className="text-sm font-semibold truncate">{account.name}</p><p className="text-xs text-muted-foreground truncate">{account.subtitle}</p></div>
                    <div className={`h-5 w-5 rounded-full border flex items-center justify-center ${checked ? 'bg-primary border-primary text-primary-foreground' : 'border-border'}`}>{checked && <CheckCircle2 className="h-3.5 w-3.5" />}</div>
                  </button>
                  {account.platform === 'threads' && <Button variant="ghost" size="icon" onClick={() => removeThreads(account.key)} title="Remover conta"><Trash2 /></Button>}
                </div>
              );
            })}
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-card/70 shadow-sm">
          <CardHeader><CardTitle className="text-base font-semibold">Nova publicação</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2"><Label>Legenda</Label><Textarea value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="Escreva a publicação..." className="min-h-44 resize-y" /></div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2"><Label>URL da imagem</Label><Input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="https://.../imagem.jpg" /></div>
              <div className="space-y-2"><Label>Link opcional</Label><Input value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} placeholder="https://..." /></div>
            </div>
            <div className="rounded-lg border border-border/60 bg-muted/20 px-3 py-2 text-xs text-muted-foreground">Selecionadas: <strong className="text-foreground">{selectedAccounts.length}</strong> conta(s). Instagram exige imagem pública; Facebook e Threads aceitam texto.</div>
            <Button className="w-full md:w-auto" onClick={publish} disabled={publishing}>{publishing ? <RefreshCw className="animate-spin" /> : <Send />}{publishing ? 'Publicando...' : 'Publicar nas contas selecionadas'}</Button>
          </CardContent>
        </Card>
      </div>

      {results.length > 0 && (
        <Card className="border-border/60 bg-card/70 shadow-sm">
          <CardHeader><CardTitle className="text-base font-semibold">Resultado por conta</CardTitle></CardHeader>
          <CardContent className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {results.map((r, i) => (
              <div key={`${r.accountKey || r.target}-${i}`} className="rounded-lg border border-border/60 p-3 bg-background/30">
                <div className="flex items-start gap-2">{r.ok ? <CheckCircle2 className="h-4 w-4 text-success mt-0.5" /> : <AlertCircle className="h-4 w-4 text-destructive mt-0.5" />}<div className="min-w-0"><p className="text-sm font-semibold truncate">{r.target || r.accountKey}</p><p className="text-xs text-muted-foreground">{r.channel}</p>{r.error && <p className="text-xs text-destructive mt-1 break-words">{r.error}</p>}</div></div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default SocialPublisherPage;
