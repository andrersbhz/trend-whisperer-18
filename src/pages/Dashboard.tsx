import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { FileText, TrendingUp, CheckCircle, Clock, Sparkles, RefreshCw, Save, Loader2, PenTool } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { getErrorMessage, runBackendQuery, runBackendMutation } from '@/lib/backend';

const DEFAULT_WRITER_PROMPT = `Você é um jornalista digital brasileiro experiente. Escreva artigos informativos, com linguagem clara e acessível, otimizados para SEO. Use dados e fatos reais. Tom autoritativo mas acessível. Foque em entregar valor ao leitor com informações práticas e atualizadas.`;

const Dashboard = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [stats, setStats] = useState({ total: 0, published: 0, pending: 0, trending: 0, failed: 0 });
  const [recentArticles, setRecentArticles] = useState<any[]>([]);
  const [generating, setGenerating] = useState(false);
  const [writerPrompt, setWriterPrompt] = useState(DEFAULT_WRITER_PROMPT);
  const [savingPrompt, setSavingPrompt] = useState(false);
  const [promptLoaded, setPromptLoaded] = useState(false);

  const fetchStats = async () => {
    if (!user) return;

    try {
      const [articles, trendingTopics, recent, settings] = await Promise.all([
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
            .select('writer_prompt')
            .eq('user_id', user.id)
            .maybeSingle(),
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

      if (settings?.writer_prompt) {
        setWriterPrompt(settings.writer_prompt);
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
  }, [user]);

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
    setGenerating(true);
    try {
      const data = await runBackendQuery(() =>
        supabase.functions.invoke('generate-articles', {
          body: { userId: user?.id },
        }),
      );
      toast({ title: 'Geração iniciada!', description: data?.message || 'Artigos sendo gerados...' });
      setTimeout(fetchStats, 5000);
    } catch (error) {
      toast({ title: 'Erro', description: getErrorMessage(error), variant: 'destructive' });
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
    <div className="space-y-6">
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
            <CardContent className="p-5">
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
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-3 w-3 rounded-full bg-destructive animate-pulse-dot" />
            <p className="text-sm text-destructive">{stats.failed} artigo(s) falharam na publicação. Vá em Artigos para tentar novamente.</p>
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
                <div key={article.id} className="flex items-center justify-between p-3 rounded-lg bg-secondary/30 hover:bg-secondary/50 transition-colors">
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
