import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FileText, TrendingUp, CheckCircle, Clock, Sparkles, RefreshCw, Facebook, Instagram } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const Dashboard = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [stats, setStats] = useState({ total: 0, published: 0, pending: 0, trending: 0, failed: 0 });
  const [recentArticles, setRecentArticles] = useState<any[]>([]);
  const [socialStats, setSocialStats] = useState({ fbPosts: 0, igPosts: 0, fbAccounts: 0 });
  const [generating, setGenerating] = useState(false);

  const fetchStats = async () => {
    if (!user) return;

    const [articlesRes, trendingRes, fbAccountsRes, publishLogRes] = await Promise.all([
      supabase.from('articles').select('id, status').eq('user_id', user.id),
      supabase.from('trending_topics').select('id').eq('user_id', user.id).eq('used', false),
      supabase.from('facebook_accounts').select('id').eq('user_id', user.id).eq('is_active', true),
      supabase.from('publish_log').select('platform, status').eq('user_id', user.id).eq('status', 'success'),
    ]);

    const articles = articlesRes.data || [];
    const logs = publishLogRes.data || [];
    setStats({
      total: articles.length,
      published: articles.filter((a) => a.status === 'published').length,
      pending: articles.filter((a) => a.status === 'ready' || a.status === 'draft').length,
      trending: trendingRes.data?.length || 0,
      failed: articles.filter((a) => a.status === 'failed').length,
    });
    setSocialStats({
      fbPosts: logs.filter((l) => l.platform === 'facebook').length,
      igPosts: logs.filter((l) => l.platform === 'instagram').length,
      fbAccounts: fbAccountsRes.data?.length || 0,
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
    { icon: FileText, label: 'Total Artigos', value: stats.total, color: 'text-primary', glow: 'neon-border-lilac' },
    { icon: CheckCircle, label: 'Publicados', value: stats.published, color: 'text-primary', glow: 'neon-border-lilac' },
    { icon: Clock, label: 'Pendentes', value: stats.pending, color: 'text-warning', glow: '' },
    { icon: TrendingUp, label: 'Tendências', value: stats.trending, color: 'text-accent', glow: 'neon-border-pink' },
    { icon: Facebook, label: 'Posts Facebook', value: socialStats.fbPosts, color: 'text-accent', glow: 'neon-border-pink' },
    { icon: Instagram, label: 'Posts Instagram', value: socialStats.igPosts, color: 'text-accent', glow: 'neon-border-pink' },
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

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
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
