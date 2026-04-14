import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  FileText, TrendingUp, CheckCircle, Clock, Sparkles, RefreshCw, Save, Loader2,
  PenTool, Bot, Facebook, Instagram, Users, Heart, MessageCircle, Share2, Eye, ThumbsUp,
} from 'lucide-react';
import AIProvidersPanel from '@/components/dashboard/AIProvidersPanel';
import { useToast } from '@/hooks/use-toast';
import { getErrorMessage, runBackendQuery, runBackendMutation } from '@/lib/backend';

const DEFAULT_WRITER_PROMPT = `Você é um jornalista digital brasileiro experiente. Escreva artigos informativos, com linguagem clara e acessível, otimizados para SEO. Use dados e fatos reais. Tom autoritativo mas acessível. Foque em entregar valor ao leitor com informações práticas e atualizadas.`;

const Dashboard = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [stats, setStats] = useState({ total: 0, published: 0, pending: 0, trending: 0, failed: 0 });
  const [recentArticles, setRecentArticles] = useState<any[]>([]);
  const [recentErrors, setRecentErrors] = useState<any[]>([]);
  const [generating, setGenerating] = useState(false);
  const [writerPrompt, setWriterPrompt] = useState(DEFAULT_WRITER_PROMPT);
  const [savingPrompt, setSavingPrompt] = useState(false);
  const [promptLoaded, setPromptLoaded] = useState(false);
  const [articlesPerDay, setArticlesPerDay] = useState(10);
  const [autoPublish, setAutoPublish] = useState(false);
  const [savingAuto, setSavingAuto] = useState(false);
  const [metaMetrics, setMetaMetrics] = useState<any[] | null>(null);
  const [loadingMeta, setLoadingMeta] = useState(false);

  const fetchStats = async () => {
    if (!user) return;

    try {
      const [articles, trendingTopics, recent, settings, errors] = await Promise.all([
        runBackendQuery(() => supabase.from('articles').select('id, status').eq('user_id', user.id)),
        runBackendQuery(() => supabase.from('trending_topics').select('id').eq('user_id', user.id).eq('used', false)),
        runBackendQuery(() =>
          supabase
            .from('articles')
            .select('id, title, category, seo_keyword, status')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(5),
        ),
        runBackendQuery(() =>
          supabase
            .from('user_settings')
            .select('writer_prompt, articles_per_day, auto_publish')
            .eq('user_id', user.id)
            .maybeSingle(),
        ),
        runBackendQuery(() =>
          supabase
            .from('publish_log')
            .select('id, article_id, error_message, created_at, status')
            .eq('user_id', user.id)
            .eq('status', 'failed')
            .order('created_at', { ascending: false })
            .limit(5),
        ),
      ]);

      setStats({
        total: articles?.length || 0,
        published: (articles || []).filter((a) => a.status === 'published').length,
        pending: (articles || []).filter((a) => a.status === 'ready' || a.status === 'draft').length,
        trending: trendingTopics?.length || 0,
        failed: (articles || []).filter((a) => a.status === 'failed').length,
      });
      setRecentArticles(recent || []);
      setRecentErrors(errors || []);
      if (settings?.writer_prompt) {
        setWriterPrompt(settings.writer_prompt);
      }
      if (settings?.articles_per_day) {
        setArticlesPerDay(settings.articles_per_day);
      }
      if (settings?.auto_publish !== null && settings?.auto_publish !== undefined) {
        setAutoPublish(settings.auto_publish);
      }
      setPromptLoaded(true);
    } catch (error) {
      setStats({ total: 0, published: 0, pending: 0, trending: 0, failed: 0 });
      setRecentArticles([]);
      toast({ title: 'Erro ao carregar painel', description: getErrorMessage(error), variant: 'destructive' });
    }
  };

  useEffect(() => {
    fetchStats();
    fetchMetaMetrics();
  }, [user]);

  const fetchMetaMetrics = async () => {
    if (!user) return;
    setLoadingMeta(true);
    try {
      const data = await runBackendQuery(() =>
        supabase.functions.invoke('fetch-meta-metrics', { body: { userId: user.id } }),
      );
      if (data?.pages) {
        const validPages = (data.pages as any[]).filter((pg: any) => {
          const hasFbData = pg.facebook && !pg.facebook.error && (pg.facebook.fan_count || pg.facebook.followers_count);
          const hasIgData = pg.instagram && !pg.instagram.error && (pg.instagram.followers_count || pg.instagram.media_count);
          return hasFbData || hasIgData;
        });
        setMetaMetrics(validPages.length > 0 ? validPages : null);
      }
    } catch {
      setMetaMetrics(null);
    } finally {
      setLoadingMeta(false);
    }
  };

  const getFunctionErrorMessage = async (error: unknown) => {
    const response = typeof error === 'object' && error && 'context' in error
      ? (error as { context?: Response }).context
      : undefined;

    if (response) {
      try {
        const payload = await response.clone().json();
        if (typeof payload?.error === 'string' && payload.error.trim()) {
          return payload.error;
        }
        if (typeof payload?.message === 'string' && payload.message.trim()) {
          return payload.message;
        }
      } catch {
        // ignore body parse errors and fall back below
      }

      if (response.status === 402) {
        return 'O Lovable AI está sem créditos para gerar artigos agora.';
      }

      if (response.status === 429) {
        return 'A geração atingiu o limite da IA configurada.';
      }
    }

    return getErrorMessage(error);
  };

  const handleSavePrompt = async () => {
    if (!user) return;
    setSavingPrompt(true);
    try {
      await runBackendMutation(() =>
        supabase
          .from('user_settings')
          .update({ writer_prompt: writerPrompt } as any)
          .eq('user_id', user.id),
      );
      toast({ title: 'Prompt salvo!', description: 'O perfil do escritor foi atualizado.' });
    } catch (error) {
      toast({ title: 'Erro', description: getErrorMessage(error), variant: 'destructive' });
    } finally {
      setSavingPrompt(false);
    }
  };

  const handleSaveAutomation = async () => {
    if (!user) return;
    setSavingAuto(true);
    try {
      await runBackendMutation(() =>
        supabase
          .from('user_settings')
          .update({ articles_per_day: articlesPerDay, auto_publish: autoPublish } as any)
          .eq('user_id', user.id),
      );
      toast({ title: 'Automação salva!', description: `${articlesPerDay} artigos/dia. Publicação automática: ${autoPublish ? 'Ativada' : 'Desativada'}.` });
    } catch (error) {
      toast({ title: 'Erro', description: getErrorMessage(error), variant: 'destructive' });
    } finally {
      setSavingAuto(false);
    }
  };

  const handleGenerateArticles = async () => {
    if (!user) return;

    setGenerating(true);
    try {
      const data = await runBackendQuery(() =>
        supabase.functions.invoke('generate-articles', {
          body: { userId: user.id },
        }),
      );
      toast({ title: 'Geração iniciada!', description: data?.message || 'Artigos sendo gerados...' });
      setTimeout(fetchStats, 5000);
    } catch (error) {
      toast({ title: 'Erro ao gerar artigos', description: await getFunctionErrorMessage(error), variant: 'destructive' });
    } finally {
      setGenerating(false);
    }
  };

  const statusColors: Record<string, string> = {
    draft: 'bg-muted text-muted-foreground',
    generating: 'bg-warning/20 text-warning',
    ready: 'bg-primary/20 text-primary',
    published: 'bg-success/20 text-success',
    failed: 'bg-destructive/20 text-destructive',
  };

  const categoryLabels: Record<string, string> = {
    esportes: '⚽ Esportes',
    politica: '🏛️ Política',
    policia: '🚔 Polícia',
    saude: '💚 Saúde',
    celebridades: '⭐ Celebridades',
    financas: '💰 Finanças',
  };

  const statCards = [
    { icon: FileText, label: 'Total Artigos', value: stats.total, color: 'text-primary', glow: 'neon-border-lilac' },
    { icon: CheckCircle, label: 'Publicados', value: stats.published, color: 'text-primary', glow: 'neon-border-lilac' },
    { icon: Clock, label: 'Pendentes', value: stats.pending, color: 'text-warning', glow: '' },
    { icon: TrendingUp, label: 'Tendências', value: stats.trending, color: 'text-accent', glow: 'neon-border-pink' },
  ];

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold neon-text-lilac">Painel</h1>
          <p className="text-muted-foreground text-sm mt-1">Gerencie sua automação de blog</p>
        </div>
        <Button onClick={handleGenerateArticles} disabled={generating} className="gradient-primary text-primary-foreground shadow-neon-lilac hover:shadow-neon-lilac">
          {generating ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
          Gerar Artigos
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((stat) => (
          <Card key={stat.label} className={`glass-card ${stat.glow}`}>
            <CardContent className="p-[25px]">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{stat.label}</p>
                  <p className="text-2xl font-bold text-foreground mt-1">{stat.value}</p>
                </div>
                <stat.icon className={`h-8 w-8 ${stat.color} opacity-80`} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Meta Social Cards */}
      {loadingMeta && (
        <div className="flex items-center gap-2 text-muted-foreground text-sm">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando métricas das redes sociais...
        </div>
      )}
      {metaMetrics && metaMetrics.length > 0 && (
        <div className="space-y-4">
          {metaMetrics.map((pg: any, idx: number) => (
            <Card key={idx} className="glass-card neon-border-pink overflow-hidden">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-3">
                  {pg.facebook?.picture?.data?.url ? (
                    <img src={pg.facebook.picture.data.url} alt={pg.page_name} className="w-10 h-10 rounded-full border-2 border-accent/30" />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-accent/20 flex items-center justify-center">
                      <Facebook className="h-5 w-5 text-accent" />
                    </div>
                  )}
                  <div>
                    <CardTitle className="text-base text-foreground">{pg.page_name || 'Página'}</CardTitle>
                    {pg.facebook?.category && (
                      <p className="text-xs text-muted-foreground">{pg.facebook.category}</p>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Facebook Metrics */}
                {pg.facebook && !pg.facebook.error && (
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <Facebook className="h-4 w-4 text-accent" />
                      <span className="text-sm font-semibold text-foreground">Facebook</span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {[
                        { icon: Users, label: 'Seguidores', value: pg.facebook.followers_count || pg.facebook.fan_count || 0, color: 'text-accent' },
                        { icon: ThumbsUp, label: 'Curtidas', value: pg.facebook.fan_count || 0, color: 'text-primary' },
                        { icon: MessageCircle, label: 'Falando sobre', value: pg.facebook.talking_about_count || 0, color: 'text-warning' },
                        { icon: Eye, label: 'Check-ins', value: pg.facebook.were_here_count || 0, color: 'text-muted-foreground' },
                      ].map((m) => (
                         <div key={m.label} className="p-[25px] rounded-xl bg-secondary/40 border border-border/50">
                          <div className="flex items-center gap-1.5 mb-1">
                            <m.icon className={`h-3.5 w-3.5 ${m.color}`} />
                            <span className="text-[11px] text-muted-foreground">{m.label}</span>
                          </div>
                          <p className="text-xl font-bold text-foreground">{(m.value || 0).toLocaleString('pt-BR')}</p>
                        </div>
                      ))}
                    </div>
                    {pg.facebook.post_stats && (
                       <div className="mt-3 p-[25px] rounded-xl bg-secondary/20 border border-border/30">
                        <p className="text-xs font-medium text-muted-foreground mb-2">Últimos {pg.facebook.post_stats.total_posts} posts</p>
                        <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 text-center">
                          {[
                            { label: 'Curtidas', value: pg.facebook.post_stats.total_likes },
                            { label: 'Comentários', value: pg.facebook.post_stats.total_comments },
                            { label: 'Reações', value: pg.facebook.post_stats.total_reactions },
                            { label: 'Compartilh.', value: pg.facebook.post_stats.total_shares },
                            { label: 'Eng. Médio', value: pg.facebook.post_stats.avg_engagement },
                          ].map((s) => (
                            <div key={s.label}>
                              <p className="text-sm font-bold text-foreground">{(s.value || 0).toLocaleString('pt-BR')}</p>
                              <p className="text-[10px] text-muted-foreground">{s.label}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Instagram Metrics */}
                {pg.instagram && !pg.instagram.error && (
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <Instagram className="h-4 w-4 text-primary" />
                      <span className="text-sm font-semibold text-foreground">
                        Instagram {pg.instagram.username ? `@${pg.instagram.username}` : ''}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {[
                        { icon: Users, label: 'Seguidores', value: pg.instagram.followers_count || 0, color: 'text-primary' },
                        { icon: Users, label: 'Seguindo', value: pg.instagram.follows_count || 0, color: 'text-muted-foreground' },
                        { icon: FileText, label: 'Publicações', value: pg.instagram.media_count || 0, color: 'text-accent' },
                        { icon: Heart, label: 'Eng. Médio', value: pg.instagram.post_stats?.avg_engagement || 0, color: 'text-destructive' },
                      ].map((m) => (
                        <div key={m.label} className="p-[25px] rounded-xl bg-secondary/40 border border-border/50">
                          <div className="flex items-center gap-1.5 mb-1">
                            <m.icon className={`h-3.5 w-3.5 ${m.color}`} />
                            <span className="text-[11px] text-muted-foreground">{m.label}</span>
                          </div>
                          <p className="text-xl font-bold text-foreground">{(m.value || 0).toLocaleString('pt-BR')}</p>
                        </div>
                      ))}
                    </div>
                    {pg.instagram.post_stats && (
                      <div className="mt-3 p-[25px] rounded-xl bg-secondary/20 border border-border/30">
                        <p className="text-xs font-medium text-muted-foreground mb-2">Últimos {pg.instagram.post_stats.total_posts} posts</p>
                        <div className="grid grid-cols-3 gap-2 text-center">
                          {[
                            { label: 'Curtidas', value: pg.instagram.post_stats.total_likes },
                            { label: 'Comentários', value: pg.instagram.post_stats.total_comments },
                            { label: 'Eng. Médio', value: pg.instagram.post_stats.avg_engagement },
                          ].map((s) => (
                            <div key={s.label}>
                              <p className="text-sm font-bold text-foreground">{(s.value || 0).toLocaleString('pt-BR')}</p>
                              <p className="text-[10px] text-muted-foreground">{s.label}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}


      {/* Automation Robot */}
      <Card className="glass-card neon-border-pink">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Bot className="h-5 w-5 text-accent" />
            <CardTitle className="text-lg text-foreground">Robô de Publicação Automática</CardTitle>
          </div>
          <p className="text-sm text-muted-foreground">
            Configure quantas postagens o robô deve fazer por dia e se deve publicar automaticamente no WordPress.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="articles-per-day">Postagens por dia</Label>
              <Input
                id="articles-per-day"
                type="number"
                min={1}
                max={50}
                value={articlesPerDay}
                onChange={(e) => setArticlesPerDay(parseInt(e.target.value) || 10)}
                disabled={!promptLoaded}
              />
              <p className="text-xs text-muted-foreground">Quantidade de artigos gerados a cada ciclo (máx. 50)</p>
            </div>
            <div className="flex items-center justify-between p-[25px] rounded-lg bg-muted/50 h-fit mt-auto">
              <div>
                <p className="text-sm font-medium text-foreground">Publicação automática</p>
                <p className="text-xs text-muted-foreground">Publicar no WordPress automaticamente</p>
              </div>
              <Switch
                checked={autoPublish}
                onCheckedChange={setAutoPublish}
                disabled={!promptLoaded}
              />
            </div>
          </div>
          <Button
            onClick={handleSaveAutomation}
            disabled={savingAuto || !promptLoaded}
            className="gradient-primary w-full sm:w-auto"
          >
            {savingAuto ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            Salvar Automação
          </Button>
        </CardContent>
      </Card>

      {/* Writer Profile Prompt */}
      <Card className="glass-card neon-border-lilac">
        <CardHeader>
          <div className="flex items-center gap-2">
            <PenTool className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg text-foreground">Perfil do Escritor</CardTitle>
          </div>
          <p className="text-sm text-muted-foreground">
            Defina como a IA deve escrever seus artigos. Este prompt será usado em toda geração automática para garantir consistência de estilo e máxima otimização SEO.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="writer-prompt">Prompt de estilo e SEO</Label>
            <Textarea
              id="writer-prompt"
              value={writerPrompt}
              onChange={(e) => setWriterPrompt(e.target.value)}
              placeholder="Ex: Sou um jornalista especializado em tecnologia. Escreva artigos com tom informal mas informativo, use listas e subtítulos, otimize para SEO com keywords de cauda longa..."
              className="min-h-[160px] text-sm"
              disabled={!promptLoaded}
            />
            <p className="text-xs text-muted-foreground">
              Dica: Inclua seu nicho, tom de voz desejado, público-alvo, técnicas de SEO preferidas (cauda longa, LSI keywords, featured snippets, etc.)
            </p>
          </div>
          <Button
            onClick={handleSavePrompt}
            disabled={savingPrompt || !promptLoaded}
            variant="outline"
            className="w-full sm:w-auto"
          >
            {savingPrompt ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            Salvar Perfil
          </Button>
        </CardContent>
      </Card>

      {stats.failed > 0 && (
        <Card className="glass-card border-destructive/30">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full bg-destructive animate-pulse-dot" />
              <CardTitle className="text-sm text-destructive">{stats.failed} artigo(s) falharam na publicação</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {recentErrors.length > 0 ? (
              recentErrors.map((err) => (
                <div key={err.id} className="p-[25px] rounded bg-destructive/5 border border-destructive/10">
                  <p className="text-xs text-destructive font-medium truncate">{err.error_message || 'Erro desconhecido'}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{new Date(err.created_at).toLocaleString('pt-BR')}</p>
                </div>
              ))
            ) : (
              <p className="text-xs text-muted-foreground">Vá em Artigos para tentar novamente.</p>
            )}
          </CardContent>
        </Card>
      )}

      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="text-lg text-foreground">Artigos Recentes</CardTitle>
        </CardHeader>
        <CardContent>
          {recentArticles.length === 0 ? (
            <p className="text-muted-foreground text-sm py-8 text-center">
              Nenhum artigo ainda. Clique em "Gerar Artigos" para começar!
            </p>
          ) : (
            <div className="space-y-3">
              {recentArticles.map((article) => (
                <div key={article.id} className="flex items-center justify-between p-[25px] rounded-lg bg-secondary/30 hover:bg-secondary/50 transition-colors">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-foreground truncate">{article.title}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-muted-foreground">
                        {categoryLabels[article.category] || article.category}
                      </span>
                      {article.seo_keyword && (
                        <span className="text-xs text-muted-foreground">• {article.seo_keyword}</span>
                      )}
                    </div>
                  </div>
                  <Badge className={statusColors[article.status] || ''} variant="secondary">
                    {article.status}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Dashboard;
