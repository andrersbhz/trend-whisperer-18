import { useEffect, useMemo, useState } from 'react';
import { CalendarClock, CheckCircle2, ExternalLink, Facebook, FileText, Globe2, Instagram, Link2, Loader2, Megaphone, MessageSquareText, RefreshCw, Rocket, Send } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

type SocialAccount = { key: string; platform: 'facebook'|'instagram'|'threads'; name: string; active: boolean; avatar?: string | null };
type Article = { id: string; title: string; excerpt?: string | null; meta_description?: string | null; featured_image_url?: string | null; wordpress_post_id?: string | null; status?: string | null };
type Campaign = { id: string; name: string; preset: string; base_url?: string | null; status: string; total_items: number; created_at: string };

const PRESET_COPY: Record<string, { label: string; detail: string }> = {
  light: { label: 'Leve', detail: '2 publicações · 7 dias' },
  normal: { label: 'Normal', detail: '4 publicações · 14 dias' },
  aggressive: { label: 'Agressiva', detail: '7 publicações · 21 dias' },
};

const DistributionHubPage = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [articles, setArticles] = useState<Article[]>([]);
  const [accounts, setAccounts] = useState<SocialAccount[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [selectedArticle, setSelectedArticle] = useState('');
  const [selectedTargets, setSelectedTargets] = useState<string[]>([]);
  const [sourceMode, setSourceMode] = useState<'article'|'custom'>('article');
  const [title, setTitle] = useState('');
  const [excerpt, setExcerpt] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [publishWordPress, setPublishWordPress] = useState(true);
  const [preset, setPreset] = useState('normal');
  const [utmCampaign, setUtmCampaign] = useState('autopostwp');
  const [startAt, setStartAt] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [articleRes, metaRes, threadsRes, campaignRes] = await Promise.all([
        supabase.from('articles').select('id,title,excerpt,meta_description,featured_image_url,wordpress_post_id,status').eq('user_id', user.id).order('created_at', { ascending: false }).limit(100),
        supabase.from('facebook_accounts').select('id,page_id,page_name,picture_url,instagram_account_id,is_active,facebook_enabled,instagram_enabled').eq('user_id', user.id),
        supabase.from('threads_accounts' as any).select('id,threads_user_id,username,is_active').eq('user_id', user.id),
        supabase.from('social_campaigns' as any).select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(20),
      ]);
      if (articleRes.error) throw articleRes.error;
      if (metaRes.error) throw metaRes.error;
      if (threadsRes.error) throw threadsRes.error;
      if (campaignRes.error) throw campaignRes.error;

      setArticles((articleRes.data || []) as any);
      const next: SocialAccount[] = [];
      for (const row of (metaRes.data || []) as any[]) {
        if (row.facebook_enabled !== false) next.push({ key: `facebook:${row.page_id}`, platform: 'facebook', name: row.page_name || row.page_id, avatar: row.picture_url, active: Boolean(row.is_active) });
        if (row.instagram_account_id && row.instagram_enabled !== false) next.push({ key: `instagram:${row.instagram_account_id}`, platform: 'instagram', name: `${row.page_name} · Instagram`, avatar: row.picture_url, active: Boolean(row.is_active) });
      }
      for (const row of (threadsRes.data || []) as any[]) next.push({ key: `threads:${row.id}`, platform: 'threads', name: row.username ? `@${row.username}` : row.threads_user_id, active: Boolean(row.is_active) });
      setAccounts(next);
      setCampaigns((campaignRes.data || []) as any);
    } catch (e: any) {
      toast({ title: 'Erro ao carregar Distribuição', description: e.message, variant: 'destructive' });
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [user]);

  const article = useMemo(() => articles.find((a) => a.id === selectedArticle), [articles, selectedArticle]);
  useEffect(() => {
    if (!article) return;
    setTitle(article.title || '');
    setExcerpt(article.excerpt || article.meta_description || '');
    setImageUrl(article.featured_image_url || '');
  }, [article?.id]);

  const toggleTarget = (key: string) => setSelectedTargets((current) => current.includes(key) ? current.filter((x) => x !== key) : [...current, key]);
  const iconFor = (p: SocialAccount['platform']) => p === 'facebook' ? Facebook : p === 'instagram' ? Instagram : MessageSquareText;

  const createCampaign = async () => {
    if (!user) return;
    if (!selectedTargets.length) return toast({ title: 'Selecione ao menos uma rede', variant: 'destructive' });
    if (sourceMode === 'article' && !selectedArticle) return toast({ title: 'Selecione um artigo', variant: 'destructive' });
    if (sourceMode === 'custom' && (!title.trim() || !baseUrl.trim())) return toast({ title: 'Título e URL são obrigatórios', variant: 'destructive' });

    setSubmitting(true);
    try {
      let resolvedUrl = baseUrl.trim();
      if (sourceMode === 'article' && publishWordPress) {
        const { data: wpData, error: wpError } = await supabase.functions.invoke('publish-article', { body: { articleId: selectedArticle, userId: user.id } });
        if (wpError) throw wpError;
        if (wpData?.success === false) throw new Error(wpData?.message || wpData?.error || 'Falha ao publicar no WordPress');
        resolvedUrl = wpData?.wpLink || resolvedUrl;
        if (!resolvedUrl && wpData?.skipped) {
          const { data: log } = await supabase.from('publish_log').select('published_url').eq('article_id', selectedArticle).eq('platform','wordpress').eq('status','success').order('created_at',{ascending:false}).limit(1).maybeSingle();
          resolvedUrl = log?.published_url || '';
        }
      }

      const { data, error } = await supabase.functions.invoke('create-social-campaign', {
        body: {
          articleId: sourceMode === 'article' ? selectedArticle : null,
          sourceType: sourceMode,
          title: title.trim(),
          excerpt: excerpt.trim(),
          imageUrl: imageUrl.trim() || null,
          baseUrl: resolvedUrl || baseUrl.trim(),
          targetKeys: selectedTargets,
          preset,
          publishWordPress: sourceMode === 'article' && publishWordPress,
          utmCampaign: utmCampaign.trim() || 'autopostwp',
          startAt: startAt ? new Date(startAt).toISOString() : new Date().toISOString(),
        },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Falha ao criar campanha');
      toast({ title: 'Campanha criada', description: data.message });
      setBaseUrl(resolvedUrl || baseUrl);
      await load();
    } catch (e: any) {
      toast({ title: 'Falha na distribuição', description: e.message, variant: 'destructive' });
    } finally { setSubmitting(false); }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between border-b border-border/60 pb-5">
        <div><p className="text-[11px] uppercase tracking-[0.2em] font-semibold text-muted-foreground">AutoPostWP 1.5</p><h1 className="text-2xl font-semibold tracking-tight mt-1">Central de Distribuição</h1><p className="text-sm text-muted-foreground mt-2 max-w-3xl">Crie uma vez e distribua direto para as redes. WordPress é opcional; quando usado, a URL canônica vira o destino das campanhas sociais com UTM individual por rede.</p></div>
        <Button variant="outline" onClick={load} disabled={loading}><RefreshCw className={loading ? 'animate-spin' : ''}/>Atualizar</Button>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.15fr_.85fr]">
        <Card className="border-border/60"><CardHeader><CardTitle className="text-base flex items-center gap-2"><Rocket className="h-4 w-4"/>Nova distribuição</CardTitle></CardHeader><CardContent className="space-y-5">
          <Tabs value={sourceMode} onValueChange={(v)=>setSourceMode(v as any)}><TabsList><TabsTrigger value="article"><FileText className="h-4 w-4 mr-1.5"/>Artigo do sistema</TabsTrigger><TabsTrigger value="custom"><Megaphone className="h-4 w-4 mr-1.5"/>Post direto</TabsTrigger></TabsList>
            <TabsContent value="article" className="space-y-4 mt-4"><div className="space-y-2"><Label>Artigo</Label><select className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm" value={selectedArticle} onChange={(e)=>setSelectedArticle(e.target.value)}><option value="">Selecione...</option>{articles.map((a)=><option key={a.id} value={a.id}>{a.title}</option>)}</select></div>
              <button type="button" onClick={()=>setPublishWordPress(!publishWordPress)} className={`w-full rounded-lg border p-3 text-left transition-colors ${publishWordPress ? 'border-primary bg-primary/5' : 'border-border/60'}`}><div className="flex items-center gap-3"><Globe2 className="h-5 w-5"/><div className="flex-1"><p className="text-sm font-semibold">Publicar também no WordPress</p><p className="text-xs text-muted-foreground">Publica/obtém a URL canônica antes de montar os links sociais.</p></div><span className={`text-xs font-bold ${publishWordPress ? 'text-emerald-500' : 'text-muted-foreground'}`}>{publishWordPress ? 'ATIVO' : 'OPCIONAL'}</span></div></button>
            </TabsContent><TabsContent value="custom" className="space-y-4 mt-4"><div className="rounded-lg border border-dashed p-3 text-xs text-muted-foreground">Modo independente do WordPress. Informe uma URL do blog, landing page ou conteúdo externo e publique direto nas redes.</div></TabsContent></Tabs>

          <div className="grid gap-4 md:grid-cols-2"><div className="space-y-2"><Label>Título / gancho</Label><Input value={title} onChange={(e)=>setTitle(e.target.value)} placeholder="Título da publicação"/></div><div className="space-y-2"><Label>URL de destino</Label><Input value={baseUrl} onChange={(e)=>setBaseUrl(e.target.value)} placeholder={publishWordPress && sourceMode==='article' ? 'Obtida do WordPress automaticamente' : 'https://seublog.com.br/artigo'}/></div></div>
          <div className="space-y-2"><Label>Resumo</Label><Textarea value={excerpt} onChange={(e)=>setExcerpt(e.target.value)} className="min-h-24" placeholder="Resumo que será adaptado nas variações sociais"/></div>
          <div className="space-y-2"><Label>Imagem pública</Label><Input value={imageUrl} onChange={(e)=>setImageUrl(e.target.value)} placeholder="https://.../imagem.jpg"/></div>
          <div className="space-y-2"><Label>Contas de destino</Label><div className="grid gap-2 sm:grid-cols-2">{accounts.filter(a=>a.active).map((a)=>{const Icon=iconFor(a.platform); const selected=selectedTargets.includes(a.key); return <button type="button" key={a.key} onClick={()=>toggleTarget(a.key)} className={`flex items-center gap-3 rounded-lg border p-3 text-left ${selected?'border-primary bg-primary/5':'border-border/60 hover:bg-muted/30'}`}><div className="h-9 w-9 rounded-md border flex items-center justify-center overflow-hidden">{a.avatar?<img src={a.avatar} className="h-full w-full object-cover" alt=""/>:<Icon className="h-4 w-4"/>}</div><div className="min-w-0 flex-1"><p className="text-sm font-semibold truncate">{a.name}</p><p className="text-[10px] uppercase text-muted-foreground">{a.platform}</p></div>{selected&&<CheckCircle2 className="h-4 w-4 text-primary"/>}</button>})}</div>{!accounts.some(a=>a.active)&&<p className="text-xs text-muted-foreground">Nenhuma conta social ativa. Conecte contas no Publicador Social.</p>}</div>
          <div className="grid gap-4 md:grid-cols-3">{Object.entries(PRESET_COPY).map(([key,p])=><button type="button" key={key} onClick={()=>setPreset(key)} className={`rounded-lg border p-3 text-left ${preset===key?'border-primary bg-primary/5':'border-border/60'}`}><p className="text-sm font-semibold">{p.label}</p><p className="text-xs text-muted-foreground mt-1">{p.detail}</p></button>)}</div>
          <div className="grid gap-4 md:grid-cols-2"><div className="space-y-2"><Label>Campanha UTM</Label><Input value={utmCampaign} onChange={(e)=>setUtmCampaign(e.target.value)} placeholder="autopostwp"/></div><div className="space-y-2"><Label>Começar em</Label><Input type="datetime-local" value={startAt} onChange={(e)=>setStartAt(e.target.value)}/></div></div>
          <Button onClick={createCampaign} disabled={submitting} className="w-full sm:w-auto">{submitting?<Loader2 className="animate-spin"/>:<Send/>}{submitting?'Criando distribuição...':'Criar campanha e enviar para a fila'}</Button>
        </CardContent></Card>

        <div className="space-y-4"><Card><CardHeader><CardTitle className="text-base flex items-center gap-2"><Link2 className="h-4 w-4"/>Tráfego para o blog</CardTitle></CardHeader><CardContent className="space-y-3 text-sm"><p className="text-muted-foreground">Cada conta recebe uma URL própria com:</p><div className="rounded-lg border bg-muted/20 p-3 font-mono text-xs break-all">?utm_source=facebook&amp;utm_medium=social&amp;utm_campaign={utmCampaign || 'autopostwp'}&amp;utm_content=v1-facebook</div><p className="text-xs text-muted-foreground">Isso permite comparar Facebook, Instagram e Threads no Analytics sem alterar a URL canônica do artigo.</p></CardContent></Card>
          <Card><CardHeader><CardTitle className="text-base flex items-center gap-2"><CalendarClock className="h-4 w-4"/>Campanhas recentes</CardTitle></CardHeader><CardContent className="space-y-2">{!campaigns.length&&<p className="text-sm text-muted-foreground">Nenhuma campanha 1.5 criada.</p>}{campaigns.map((c)=><div key={c.id} className="rounded-lg border p-3"><div className="flex items-start gap-2"><div className="min-w-0 flex-1"><p className="text-sm font-semibold truncate">{c.name}</p><p className="text-xs text-muted-foreground mt-1">{PRESET_COPY[c.preset]?.label || c.preset} · {c.total_items} jobs · {new Date(c.created_at).toLocaleString('pt-BR')}</p>{c.base_url&&<a href={c.base_url} target="_blank" rel="noreferrer" className="text-xs text-primary inline-flex items-center gap-1 mt-2">Abrir destino <ExternalLink className="h-3 w-3"/></a>}</div><span className="text-[10px] font-bold uppercase text-emerald-500">{c.status}</span></div></div>)}</CardContent></Card>
        </div>
      </div>
    </div>
  );
};

export default DistributionHubPage;
