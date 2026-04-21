import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  FileText, TrendingUp, CheckCircle, Clock, Sparkles, RefreshCw, Save, Loader2,
  PenTool,
} from 'lucide-react';
import AIProvidersPanel from '@/components/dashboard/AIProvidersPanel';
import { useToast } from '@/hooks/use-toast';
import { getErrorMessage, runBackendQuery, runBackendMutation } from '@/lib/backend';
import AnalyticsPage from '@/pages/AnalyticsPage';

const DEFAULT_WRITER_PROMPT = `Você é um jornalista digital brasileiro experiente. Escreva artigos informativos, com linguagem clara e acessível, otimizados para SEO. Use dados e fatos reais. Tom autoritativo mas acessível. Foque em entregar valor ao leitor com informações práticas e atualizadas.`;

const Dashboard = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [stats, setStats] = useState({ total: 0, published: 0, pending: 0, trending: 0, failed: 0 });
  const [recentArticles, setRecentArticles] = useState<any[]>([]);
  const [recentErrors, setRecentErrors] = useState<any[]>([]);
  const [categoryStats, setCategoryStats] = useState<Array<{ category: string; total: number; published: number; pending: number; failed: number }>>([]);
  const [generating, setGenerating] = useState(false);
  const [writerPrompt, setWriterPrompt] = useState(DEFAULT_WRITER_PROMPT);
  const [savingPrompt, setSavingPrompt] = useState(false);
  const [promptLoaded, setPromptLoaded] = useState(false);

  const fetchStats = async () => {
    if (!user) return;

    try {
      const [articles, trendingTopics, recent, settings, errors] = await Promise.all([
        runBackendQuery(() => supabase.from('articles').select('id, status, category').eq('user_id', user.id)),
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
            .select('writer_prompt')
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

      // Aggregate by category
      const byCat: Record<string, { total: number; published: number; pending: number; failed: number }> = {};
      (articles || []).forEach((a: any) => {
        const cat = a.category || 'outros';
        if (!byCat[cat]) byCat[cat] = { total: 0, published: 0, pending: 0, failed: 0 };
        byCat[cat].total += 1;
        if (a.status === 'published') byCat[cat].published += 1;
        else if (a.status === 'failed') byCat[cat].failed += 1;
        else if (a.status === 'ready' || a.status === 'draft' || a.status === 'generating') byCat[cat].pending += 1;
      });
      setCategoryStats(
        Object.entries(byCat)
          .map(([category, v]) => ({ category, ...v }))
          .sort((a, b) => b.total - a.total),
      );

      setRecentArticles(recent || []);
      setRecentErrors(errors || []);
      if (settings?.writer_prompt) {
        setWriterPrompt(settings.writer_prompt);
      }
      setPromptLoaded(true);
    } catch (error) {
      setStats({ total: 0, published: 0, pending: 0, trending: 0, failed: 0 });
      setRecentArticles([]);
      setCategoryStats([]);
      toast({ title: 'Erro ao carregar painel', description: getErrorMessage(error), variant: 'destructive' });
    }
  };

  useEffect(() => {
    fetchStats();
  }, [user]);

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
        // ignore
      }

      if (response.status === 402) return 'O Lovable AI está sem créditos para gerar artigos agora.';
      if (response.status === 429) return 'A geração atingiu o limite da IA configurada.';
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
    { icon: FileText, label: 'Total Artigos', value: stats.total, color: 'text-primary', accent: 'from-primary/20 to-transparent', glow: 'neon-border-lilac' },
    { icon: CheckCircle, label: 'Publicados', value: stats.published, color: 'text-success', accent: 'from-success/20 to-transparent', glow: '' },
    { icon: Clock, label: 'Pendentes', value: stats.pending, color: 'text-warning', accent: 'from-warning/20 to-transparent', glow: '' },
    { icon: TrendingUp, label: 'Tendências', value: stats.trending, color: 'text-accent', accent: 'from-accent/20 to-transparent', glow: 'neon-border-pink' },
  ];

  return (
    <div className="space-y-6 lg:space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold neon-text-lilac">Painel</h1>
          <p className="text-muted-foreground text-sm mt-1">Visão geral, métricas e geração de conteúdo</p>
        </div>
        <Button
          onClick={handleGenerateArticles}
          disabled={generating}
          size="lg"
          className="gradient-primary text-primary-foreground shadow-neon-lilac hover:shadow-neon-lilac hover:scale-[1.02] transition-transform w-full sm:w-auto"
        >
          {generating ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
          Gerar Artigos
        </Button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {statCards.map((stat, i) => (
          <Card
            key={stat.label}
            className={`glass-card hover-lift ${stat.glow} relative overflow-hidden animate-float-up`}
            style={{ animationDelay: `${i * 60}ms` }}
          >
            <div className={`absolute inset-0 bg-gradient-to-br ${stat.accent} pointer-events-none opacity-50`} />
            <CardContent className="p-4 sm:p-5 relative">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[11px] sm:text-xs uppercase tracking-wider text-muted-foreground font-medium">{stat.label}</p>
                  <p className="text-2xl sm:text-3xl font-bold text-foreground mt-1.5 tabular-nums">{stat.value}</p>
                </div>
                <div className={`p-2 rounded-lg bg-background/40 ${stat.color}`}>
                  <stat.icon className="h-5 w-5" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* === ANALYTICS COMPLETO (logo abaixo dos cards) === */}
      <div className="pt-2">
        <AnalyticsPage />
      </div>

      <AIProvidersPanel />

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
              placeholder="Ex: Sou um jornalista especializado em tecnologia..."
              className="min-h-[160px] text-sm"
              disabled={!promptLoaded}
            />
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
            <div className="space-y-2.5">
              {recentArticles.map((article, idx) => (
                <div
                  key={article.id}
                  className="flex items-center justify-between gap-3 p-3 sm:p-4 rounded-lg bg-secondary/30 hover:bg-secondary/60 hover:translate-x-1 transition-all duration-200 animate-float-up"
                  style={{ animationDelay: `${idx * 40}ms` }}
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-foreground text-sm sm:text-base truncate">{article.title}</p>
                    <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                      <span className="text-[11px] sm:text-xs text-muted-foreground">
                        {categoryLabels[article.category] || article.category}
                      </span>
                      {article.seo_keyword && (
                        <span className="text-[11px] sm:text-xs text-muted-foreground truncate">• {article.seo_keyword}</span>
                      )}
                    </div>
                  </div>
                  <Badge className={`${statusColors[article.status] || ''} shrink-0 text-[10px] sm:text-xs`} variant="secondary">
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
