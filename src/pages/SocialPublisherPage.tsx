import { useEffect, useMemo, useState } from 'react';
import {
  Facebook,
  Instagram,
  MessageSquareText,
  Plus,
  RefreshCw,
  Send,
  CheckCircle2,
  AlertCircle,
  Power,
  BarChart3,
  Eye,
  Heart,
  MessageCircle,
  Repeat2,
  Users,
  ShieldCheck,
  LogIn,
  Quote,
  FileText,
} from 'lucide-react';
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
  sourceId: string;
  platform: 'facebook' | 'instagram' | 'threads';
  name: string;
  subtitle?: string;
  avatar?: string | null;
  active: boolean;
};

type ThreadsMetricsAccount = {
  id: string;
  threads_user_id: string;
  username?: string | null;
  connected: boolean;
  has_insights_permission: boolean;
  token_expired: boolean;
  needs_reconnect?: boolean;
  error?: string;
  updated_at?: string;
  profile?: {
    username?: string | null;
    picture_url?: string | null;
    biography?: string | null;
  };
  metrics?: {
    views?: number;
    likes?: number;
    replies?: number;
    reposts?: number;
    quotes?: number;
    followers_count?: number;
    recent_posts?: number;
  } | null;
};

const formatMetric = (value?: number) => new Intl.NumberFormat('pt-BR', { notation: 'compact', maximumFractionDigits: 1 }).format(value || 0);

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
  const [threadsMetrics, setThreadsMetrics] = useState<ThreadsMetricsAccount[]>([]);
  const [loadingThreadsMetrics, setLoadingThreadsMetrics] = useState(false);
  const [connectingThreads, setConnectingThreads] = useState(false);

  const loadAccounts = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [{ data: meta, error: metaError }, { data: threads, error: threadsError }] = await Promise.all([
        supabase
          .from('facebook_accounts')
          .select('id,page_id,page_name,picture_url,instagram_account_id,is_active,facebook_enabled,instagram_enabled')
          .eq('user_id', user.id),
        supabase
          .from('threads_accounts' as any)
          .select('id,threads_user_id,username,is_active')
          .eq('user_id', user.id),
      ]);
      if (metaError) throw metaError;
      if (threadsError) throw threadsError;

      const next: SocialAccount[] = [];
      for (const row of (meta || []) as any[]) {
        next.push({
          key: `facebook:${row.page_id}`,
          sourceId: row.id,
          platform: 'facebook',
          name: row.page_name || row.page_id,
          subtitle: 'Página do Facebook',
          avatar: row.picture_url,
          active: Boolean(row.is_active && row.facebook_enabled),
        });
        if (row.instagram_account_id) {
          next.push({
            key: `instagram:${row.instagram_account_id}`,
            sourceId: row.id,
            platform: 'instagram',
            name: `${row.page_name} · Instagram`,
            subtitle: `Instagram Business vinculado a ${row.page_name}`,
            avatar: row.picture_url,
            active: Boolean(row.is_active && row.instagram_enabled),
          });
        }
      }
      for (const row of (threads || []) as any[]) {
        next.push({
          key: `threads:${row.id}`,
          sourceId: row.id,
          platform: 'threads',
          name: row.username ? `@${row.username}` : row.threads_user_id,
          subtitle: 'Perfil do Threads',
          active: Boolean(row.is_active),
        });
      }

      setAccounts(next);
      setSelected((current) => current.filter((key) => next.some((account) => account.key === key && account.active)));
    } catch (e: any) {
      toast({ title: 'Erro ao carregar contas', description: e.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const loadThreadsMetrics = async (silent = false) => {
    if (!user) return;
    setLoadingThreadsMetrics(true);
    try {
      const { data, error } = await supabase.functions.invoke('fetch-threads-metrics', {
        body: { userId: user.id },
      });
      if (error) throw error;
      setThreadsMetrics(data?.accounts || []);
      if (!silent && (data?.accounts || []).length > 0) {
        toast({ title: 'Métricas atualizadas', description: 'Os dados das contas Threads foram atualizados.' });
      }
    } catch (e: any) {
      if (!silent) toast({ title: 'Métricas do Threads indisponíveis', description: e.message, variant: 'destructive' });
    } finally {
      setLoadingThreadsMetrics(false);
    }
  };

  useEffect(() => {
    if (!user) return;
    loadAccounts();
    loadThreadsMetrics(true);
  }, [user]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const threads = params.get('threads');
    if (threads === 'connected') {
      toast({ title: 'Threads conectado', description: 'Conta autorizada com segurança. Sua senha não foi armazenada no PostWP.' });
      loadAccounts();
      loadThreadsMetrics(true);
      window.history.replaceState({}, '', '/social');
    } else if (threads === 'error') {
      toast({ title: 'Falha ao conectar Threads', description: params.get('message') || 'Verifique o app da Meta.', variant: 'destructive' });
      window.history.replaceState({}, '', '/social');
    }
  }, []);

  const selectedAccounts = useMemo(() => accounts.filter((account) => selected.includes(account.key)), [accounts, selected]);
  const threadsConnectedCount = accounts.filter((account) => account.platform === 'threads' && account.active).length;

  const toggle = (account: SocialAccount) => {
    if (!account.active) return;
    setSelected((current) => current.includes(account.key) ? current.filter((key) => key !== account.key) : [...current, account.key]);
  };

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
    setConnectingThreads(true);
    try {
      const { data, error } = await supabase.functions.invoke('threads-oauth-start', {
        body: { returnUrl: `${window.location.origin}/social` },
      });
      if (error || !data?.authUrl) {
        toast({ title: 'Falha ao iniciar Threads', description: error?.message || data?.error || 'OAuth indisponível', variant: 'destructive' });
        return;
      }
      window.location.href = data.authUrl;
    } finally {
      setConnectingThreads(false);
    }
  };

  const disconnectAccount = async (account: SocialAccount) => {
    if (!account.active || !user) return;
    if (!window.confirm(`Desconectar ${account.name}? A conexão continuará salva no banco e poderá ser reativada ao conectar novamente.`)) return;

    try {
      if (account.platform === 'threads') {
        const { error } = await supabase
          .from('threads_accounts' as any)
          .update({ is_active: false, disconnected_at: new Date().toISOString() } as any)
          .eq('id', account.sourceId)
          .eq('user_id', user.id);
        if (error) throw error;
      } else {
        const patch = account.platform === 'facebook'
          ? { facebook_enabled: false, disconnected_at: new Date().toISOString() }
          : { instagram_enabled: false, disconnected_at: new Date().toISOString() };
        const { error } = await supabase
          .from('facebook_accounts')
          .update(patch as any)
          .eq('id', account.sourceId)
          .eq('user_id', user.id);
        if (error) throw error;
      }
      setSelected((current) => current.filter((key) => key !== account.key));
      toast({ title: 'Desconectado', description: 'A conexão foi preservada no banco e não será usada até ser reconectada.' });
      await loadAccounts();
      if (account.platform === 'threads') await loadThreadsMetrics(true);
    } catch (e: any) {
      toast({ title: 'Erro ao desconectar', description: e.message, variant: 'destructive' });
    }
  };

  const publish = async () => {
    if (!user) return;
    if (!caption.trim()) return toast({ title: 'Escreva uma legenda', variant: 'destructive' });
    if (selected.length === 0) return toast({ title: 'Selecione ao menos uma conta conectada', variant: 'destructive' });

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
      if (data?.success && selectedAccounts.some((account) => account.platform === 'threads')) {
        loadThreadsMetrics(true);
      }
    } catch (e: any) {
      toast({ title: 'Erro ao publicar', description: e.message, variant: 'destructive' });
    } finally {
      setPublishing(false);
    }
  };

  const iconFor = (platform: SocialAccount['platform']) => platform === 'facebook' ? Facebook : platform === 'instagram' ? Instagram : MessageSquareText;
  const activeCount = accounts.filter((account) => account.active).length;

  const metricCards = (item: ThreadsMetricsAccount) => [
    { label: 'Visualizações', value: item.metrics?.views, icon: Eye },
    { label: 'Curtidas', value: item.metrics?.likes, icon: Heart },
    { label: 'Respostas', value: item.metrics?.replies, icon: MessageCircle },
    { label: 'Reposts', value: item.metrics?.reposts, icon: Repeat2 },
    { label: 'Citações', value: item.metrics?.quotes, icon: Quote },
    { label: 'Seguidores', value: item.metrics?.followers_count, icon: Users },
    { label: 'Posts recentes', value: item.metrics?.recent_posts, icon: FileText },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between border-b border-border/60 pb-5">
        <div>
          <p className="text-[11px] uppercase tracking-[0.2em] font-semibold text-muted-foreground">Social Publisher</p>
          <h1 className="text-2xl font-semibold tracking-tight mt-1">Publicação independente em redes sociais</h1>
          <p className="text-sm text-muted-foreground mt-2 max-w-2xl">As conexões ficam salvas no banco e permanecem ativas entre sessões até você clicar em Desconectar.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={loadAccounts} disabled={loading}><RefreshCw className={loading ? 'animate-spin' : ''} />Atualizar</Button>
          <Button variant="outline" onClick={connectMeta}><Plus />Adicionar Meta</Button>
          <Button onClick={connectThreads} disabled={connectingThreads}>
            {connectingThreads ? <RefreshCw className="animate-spin" /> : <LogIn />}
            Entrar com Threads
          </Button>
        </div>
      </div>

      <Card className="border-border/60 bg-card/70 shadow-sm overflow-hidden">
        <CardContent className="p-0">
          <div className="grid gap-0 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="p-5 border-b lg:border-b-0 lg:border-r border-border/60">
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-lg border border-border/60 bg-background flex items-center justify-center shrink-0">
                  <MessageSquareText className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-semibold">Conectar conta Threads</h2>
                    <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-500">Seguro</span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
                    Clique em “Entrar com Threads”. O login e a senha são digitados somente na página oficial do Threads. O PostWP não recebe nem armazena sua senha; salva apenas a autorização necessária para publicar e ler métricas.
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1.5 rounded-md border border-border/60 px-2 py-1"><Send className="h-3 w-3" />Publicação</span>
                    <span className="inline-flex items-center gap-1.5 rounded-md border border-border/60 px-2 py-1"><BarChart3 className="h-3 w-3" />Métricas</span>
                    <span className="inline-flex items-center gap-1.5 rounded-md border border-border/60 px-2 py-1"><ShieldCheck className="h-3 w-3" />Senha não armazenada</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="p-5 flex items-center justify-between gap-4 bg-muted/10">
              <div>
                <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold">Threads</p>
                <p className="text-2xl font-semibold mt-1">{threadsConnectedCount}</p>
                <p className="text-xs text-muted-foreground">conta(s) conectada(s)</p>
              </div>
              <Button onClick={connectThreads} disabled={connectingThreads}>
                {connectingThreads ? <RefreshCw className="animate-spin" /> : <LogIn />}
                {threadsConnectedCount > 0 ? 'Adicionar outra conta' : 'Entrar'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="rounded-lg border border-border/60 bg-card/50 px-4 py-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2.5 w-2.5">
            {activeCount > 0 && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />}
            <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${activeCount > 0 ? 'bg-emerald-500' : 'bg-muted-foreground/40'}`} />
          </span>
          <span className="text-sm font-semibold">{activeCount > 0 ? 'Conexões ativas' : 'Nenhuma conexão ativa'}</span>
        </div>
        <span className="text-xs text-muted-foreground">{activeCount} conectada(s)</span>
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <Card className="border-border/60 bg-card/70 shadow-sm">
          <CardHeader><CardTitle className="text-base font-semibold">Contas salvas</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {accounts.length === 0 && !loading && <div className="rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground text-center">Nenhuma conta salva. Use “Adicionar Meta” ou “Entrar com Threads”.</div>}
            {accounts.map((account) => {
              const Icon = iconFor(account.platform);
              const checked = selected.includes(account.key);
              return (
                <div key={account.key} className={`flex items-center gap-3 rounded-lg border p-3 transition-colors ${checked ? 'border-primary bg-primary/5' : 'border-border/60 bg-background/35'} ${account.active ? 'hover:bg-muted/40' : 'opacity-65'}`}>
                  <button onClick={() => toggle(account)} className="flex min-w-0 flex-1 items-center gap-3 text-left" disabled={!account.active}>
                    <div className="h-10 w-10 rounded-lg border border-border/60 bg-background flex items-center justify-center overflow-hidden shrink-0">{account.avatar ? <img src={account.avatar} alt="" className="h-full w-full object-cover" /> : <Icon className="h-4 w-4" />}</div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold truncate">{account.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{account.subtitle}</p>
                      <div className="mt-1 flex items-center gap-1.5">
                        <span className="relative flex h-2 w-2">
                          {account.active && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />}
                          <span className={`relative inline-flex h-2 w-2 rounded-full ${account.active ? 'bg-emerald-500' : 'bg-muted-foreground/40'}`} />
                        </span>
                        <span className={`text-[10px] font-bold uppercase tracking-[0.14em] ${account.active ? 'text-emerald-500' : 'text-muted-foreground'}`}>{account.active ? 'Conectado' : 'Desconectado'}</span>
                      </div>
                    </div>
                    <div className={`h-5 w-5 rounded-full border flex items-center justify-center ${checked ? 'bg-primary border-primary text-primary-foreground' : 'border-border'}`}>{checked && <CheckCircle2 className="h-3.5 w-3.5" />}</div>
                  </button>
                  {account.active && (
                    <Button variant="ghost" size="sm" onClick={() => disconnectAccount(account)} className="text-destructive hover:bg-destructive hover:text-destructive-foreground" title="Desconectar">
                      <Power className="h-4 w-4" />
                      <span className="hidden sm:inline">Desconectar</span>
                    </Button>
                  )}
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
            <div className="rounded-lg border border-border/60 bg-muted/20 px-3 py-2 text-xs text-muted-foreground">Selecionadas: <strong className="text-foreground">{selectedAccounts.length}</strong> conta(s). Apenas contas com status Conectado podem ser selecionadas.</div>
            <Button className="w-full md:w-auto" onClick={publish} disabled={publishing}>{publishing ? <RefreshCw className="animate-spin" /> : <Send />}{publishing ? 'Publicando...' : 'Publicar nas contas selecionadas'}</Button>
          </CardContent>
        </Card>
      </div>

      <Card className="border-border/60 bg-card/70 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0">
          <div>
            <CardTitle className="text-base font-semibold flex items-center gap-2"><BarChart3 className="h-4 w-4" />Métricas do Threads</CardTitle>
            <p className="text-xs text-muted-foreground mt-1">Dados oficiais das contas autorizadas. Contas antigas podem precisar reconectar uma vez para liberar insights.</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => loadThreadsMetrics(false)} disabled={loadingThreadsMetrics || threadsConnectedCount === 0}>
            <RefreshCw className={loadingThreadsMetrics ? 'animate-spin' : ''} />Atualizar métricas
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {threadsConnectedCount === 0 && (
            <div className="rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground text-center">
              Conecte uma conta Threads para começar a acompanhar visualizações, curtidas, respostas, reposts, citações e seguidores.
            </div>
          )}

          {threadsConnectedCount > 0 && threadsMetrics.length === 0 && !loadingThreadsMetrics && (
            <div className="rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground text-center">
              Clique em “Atualizar métricas” para carregar os dados do Threads.
            </div>
          )}

          {threadsMetrics.map((item) => (
            <div key={item.id} className="rounded-xl border border-border/60 bg-background/30 overflow-hidden">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-border/60 p-4">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="h-11 w-11 rounded-lg border border-border/60 bg-background flex items-center justify-center overflow-hidden shrink-0">
                    {item.profile?.picture_url ? <img src={item.profile.picture_url} alt="" className="h-full w-full object-cover" /> : <MessageSquareText className="h-5 w-5" />}
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold truncate">@{item.profile?.username || item.username || item.threads_user_id}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-emerald-500"><CheckCircle2 className="h-3 w-3" />Conectado</span>
                      {item.updated_at && <span className="text-[10px] text-muted-foreground">Atualizado {new Date(item.updated_at).toLocaleString('pt-BR')}</span>}
                    </div>
                  </div>
                </div>
                {item.needs_reconnect && (
                  <Button size="sm" onClick={connectThreads}><RefreshCw className="h-4 w-4" />Reconectar para métricas</Button>
                )}
              </div>

              {item.error && !item.metrics ? (
                <div className="p-4">
                  <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                    <div><p className="font-medium">Métricas ainda não disponíveis</p><p className="text-muted-foreground text-xs mt-1">{item.error}</p></div>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-px bg-border/60">
                  {metricCards(item).map(({ label, value, icon: Icon }) => (
                    <div key={label} className="bg-card p-4 min-h-24 flex flex-col justify-between">
                      <div className="flex items-center gap-2 text-muted-foreground"><Icon className="h-3.5 w-3.5" /><span className="text-[10px] uppercase tracking-wider font-semibold">{label}</span></div>
                      <p className="text-xl font-semibold mt-3">{formatMetric(value)}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

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
