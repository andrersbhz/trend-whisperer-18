import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FileText, TrendingUp, CheckCircle, Clock, Sparkles, RefreshCw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const Dashboard = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [stats, setStats] = useState({ total: 0, published: 0, pending: 0, trending: 0 });
  const [recentArticles, setRecentArticles] = useState<any[]>([]);
  const [generating, setGenerating] = useState(false);

  const fetchStats = async () => {
    if (!user) return;

    const [articlesRes, trendingRes] = await Promise.all([
      supabase.from('articles').select('id, status').eq('user_id', user.id),
      supabase.from('trending_topics').select('id').eq('user_id', user.id).eq('used', false),
    ]);

    const articles = articlesRes.data || [];
    setStats({
      total: articles.length,
      published: articles.filter((a) => a.status === 'published').length,
      pending: articles.filter((a) => a.status === 'ready' || a.status === 'draft').length,
      trending: trendingRes.data?.length || 0,
    });

    const { data: recent } = await supabase
      .from('articles')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(5);

    setRecentArticles(recent || []);
  };

  useEffect(() => {
    fetchStats();
  }, [user]);

  const handleGenerateArticles = async () => {
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-articles', {
        body: { userId: user?.id },
      });
      if (error) throw error;
      toast({ title: 'Geração iniciada!', description: data?.message || 'Artigos sendo gerados...' });
      setTimeout(fetchStats, 5000);
    } catch (e: any) {
      toast({ title: 'Erro', description: e.message, variant: 'destructive' });
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
    { icon: FileText, label: 'Total Artigos', value: stats.total, color: 'text-primary' },
    { icon: CheckCircle, label: 'Publicados', value: stats.published, color: 'text-success' },
    { icon: Clock, label: 'Pendentes', value: stats.pending, color: 'text-warning' },
    { icon: TrendingUp, label: 'Tendências', value: stats.trending, color: 'text-accent' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Painel</h1>
          <p className="text-muted-foreground text-sm mt-1">Gerencie sua automação de blog</p>
        </div>
        <Button onClick={handleGenerateArticles} disabled={generating} className="gradient-primary">
          {generating ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
          Gerar Artigos
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((stat) => (
          <Card key={stat.label} className="shadow-card">
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

      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="text-lg">Artigos Recentes</CardTitle>
        </CardHeader>
        <CardContent>
          {recentArticles.length === 0 ? (
            <p className="text-muted-foreground text-sm py-8 text-center">
              Nenhum artigo ainda. Clique em "Gerar Artigos" para começar!
            </p>
          ) : (
            <div className="space-y-3">
              {recentArticles.map((article) => (
                <div key={article.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
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
