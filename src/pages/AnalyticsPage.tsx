import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import {
  BarChart3, TrendingUp, TrendingDown, Eye, MousePointerClick, Users,
  Lightbulb, RefreshCw, Loader2, Globe, Clock, ArrowUpRight, Percent,
  FileText, Smartphone, Monitor, Tablet, Heart, Share2,
  Twitter, Linkedin, Send,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell, AreaChart, Area, Legend,
} from 'recharts';
import { getErrorMessage, runBackendQuery } from '@/lib/backend';
import { useNavigate } from 'react-router-dom';

interface AnalyticsData {
  pageviews: number;
  sessions: number;
  users: number;
  newUsers: number;
  bounceRate: number;
  avgSessionDuration: string;
  pagesPerSession: number;
  topPages: { page: string; views: number; avgTime: string }[];
  trafficSources: { source: string; value: number }[];
  dailyViews: { date: string; views: number; users: number; sessions: number }[];
  devices: { device: string; value: number }[];
  countries: { country: string; users: number }[];
  topReferrers: { referrer: string; visits: number }[];
  hourlyTraffic: { hour: string; views: number }[];
}

interface SocialMetrics {
  publish_log: {
    wordpress: { total: number; success: number; failed: number; recent: { date: string; url: string }[] };
  };
  jetpack: {
    posts_with_sharing: number;
    total_shares: number;
    shares_by_network: Record<string, number>;
  };
  summary: {
    total_published_wp: number;
    total_shared_social: number;
    total_twitter: number;
    total_linkedin: number;
    total_tumblr: number;
  };
}

interface JetpackStats {
  available: boolean;
  summary?: {
    views: number; visitors: number; likes: number; comments: number;
    followers: number; shares: number; posts: number;
    views_today: number; views_yesterday: number;
    views_best_day: string | null; views_best_day_total: number;
  };
  topPosts?: { title: string; views: number; url: string }[];
  dailyViews?: { date: string; views: number }[];
  referrers?: { name: string; views: number }[];
  searchTerms?: { term: string; views: number }[];
  countries?: { country: string; views: number }[];
  publicizeConnections?: { service: string; external_name: string; status: string }[];
}

interface AiTip {
  category: string;
  tip: string;
  priority: 'alta' | 'média' | 'baixa';
}

const CHART_COLORS = [
  'hsl(145, 80%, 45%)',
  'hsl(320, 80%, 55%)',
  'hsl(275, 70%, 50%)',
  'hsl(38, 92%, 50%)',
  'hsl(0, 75%, 55%)',
  'hsl(200, 80%, 50%)',
];

const AnalyticsPage = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [socialMetrics, setSocialMetrics] = useState<SocialMetrics | null>(null);
  const [tips, setTips] = useState<AiTip[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingTips, setLoadingTips] = useState(false);
  const [gaConnected, setGaConnected] = useState(false);
  const [articleStats, setArticleStats] = useState({ total: 0, published: 0, failed: 0 });
  const [jetpackStats, setJetpackStats] = useState<JetpackStats | null>(null);
  const [loadingJetpack, setLoadingJetpack] = useState(false);

  useEffect(() => {
    if (!user) return;
    checkGaConnection();
    fetchArticleStats();
    fetchSocialMetrics();
    fetchJetpackStats();
  }, [user]);

  const fetchArticleStats = async () => {
    if (!user) return;

    try {
      const data = await runBackendQuery(() => supabase.from('articles').select('status').eq('user_id', user.id));

      setArticleStats({
        total: data?.length || 0,
        published: (data || []).filter((a) => a.status === 'published').length,
        failed: (data || []).filter((a) => a.status === 'failed').length,
      });
    } catch {
      setArticleStats({ total: 0, published: 0, failed: 0 });
    }
  };

  const fetchSocialMetrics = async () => {
    if (!user) return;

    try {
      const data = await runBackendQuery(() =>
        supabase.functions.invoke('fetch-social-metrics', {
          body: { userId: user.id },
        }),
      );

      if (data?.metrics) {
        setSocialMetrics(data.metrics);
      }
    } catch {
      setSocialMetrics(null);
    }
  };

  const fetchJetpackStats = async () => {
    if (!user) return;
    setLoadingJetpack(true);
    try {
      const data = await runBackendQuery(() =>
        supabase.functions.invoke('fetch-jetpack-stats', { body: { userId: user.id } }),
      );
      if (data?.jetpack?.available) {
        setJetpackStats(data.jetpack);
      } else {
        setJetpackStats(null);
      }
    } catch {
      setJetpackStats(null);
    } finally {
      setLoadingJetpack(false);
    }
  };

  const checkGaConnection = async () => {
    if (!user) return;

    try {
      const data = await runBackendQuery(() =>
        supabase
          .from('user_settings')
          .select('google_analytics_property_id')
          .eq('user_id', user.id)
          .maybeSingle(),
      );

      const connected = !!(data as any)?.google_analytics_property_id;
      setGaConnected(connected);

      if (connected) {
        fetchAnalytics();
      } else {
        setLoading(false);
      }
    } catch {
      setGaConnected(false);
      setLoading(false);
    }
  };

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      const data = await runBackendQuery(() =>
        supabase.functions.invoke('fetch-analytics', {
          body: { userId: user?.id },
        }),
      );

      if (data?.analytics) setAnalytics(data.analytics);
    } catch (error) {
      toast({ title: 'Erro', description: getErrorMessage(error), variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const generateTips = async () => {
    if (!analytics) return;
    setLoadingTips(true);
    try {
      const data = await runBackendQuery(() =>
        supabase.functions.invoke('generate-analytics-tips', {
          body: { userId: user?.id, analytics, socialMetrics },
        }),
      );

      setTips(data?.tips || []);
    } catch (error) {
      toast({ title: 'Erro', description: getErrorMessage(error), variant: 'destructive' });
    } finally {
      setLoadingTips(false);
    }
  };

  const priorityColors: Record<string, string> = {
    alta: 'bg-destructive/20 text-destructive',
    média: 'bg-warning/20 text-warning',
    baixa: 'bg-primary/20 text-primary',
  };

  const deviceIcons: Record<string, any> = {
    Desktop: Monitor,
    Mobile: Smartphone,
    Tablet: Tablet,
  };

  const customTooltipStyle = {
    backgroundColor: 'hsl(260, 15%, 12%)',
    border: '1px solid hsl(260, 20%, 22%)',
    borderRadius: '8px',
    color: 'hsl(0, 0%, 95%)',
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const sm = socialMetrics?.summary;
  const jp = socialMetrics?.jetpack;
  const pl = socialMetrics?.publish_log;

  const socialSection = (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold neon-text-pink flex items-center gap-2">
        <Share2 className="h-5 w-5" /> Redes Sociais
      </h2>

      {/* Main counters */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
        {[
          { icon: Globe, label: 'Publicados WP', value: sm?.total_published_wp || 0, color: 'text-primary' },
          { icon: Share2, label: 'Compartilhados', value: sm?.total_shared_social || 0, color: 'text-accent' },
          { icon: Twitter, label: 'Twitter/X', value: sm?.total_twitter || 0, color: 'text-muted-foreground' },
          { icon: Linkedin, label: 'LinkedIn', value: sm?.total_linkedin || 0, color: 'text-muted-foreground' },
        ].map((s) => (
          <Card key={s.label} className="glass-card neon-border-pink">
            <CardContent className="p-4">
              <s.icon className={`h-5 w-5 ${s.color} mb-2`} />
              <p className="text-xl font-bold text-foreground">{s.value.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Jetpack Publicize details */}
      {jp && jp.total_shares > 0 && (
        <Card className="glass-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <Send className="h-4 w-4 text-primary" />
              <p className="text-sm font-medium text-foreground">Jetpack Publicize</p>
              <Badge variant="secondary" className="ml-auto">{jp.total_shares} compartilhamentos</Badge>
            </div>
            {Object.keys(jp.shares_by_network).length > 0 && (
              <div className="flex flex-wrap gap-2">
                {Object.entries(jp.shares_by_network).map(([network, count]) => (
                  <Badge key={network} variant="outline" className="text-xs">
                    {network}: {count}
                  </Badge>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Publish log details */}
      {pl && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            { label: 'WordPress', total: pl.wordpress.total, success: pl.wordpress.success, failed: pl.wordpress.failed, color: 'text-primary' },
          ].map((p) => (
            <Card key={p.label} className="glass-card">
              <CardContent className="p-4">
                <p className={`text-sm font-medium ${p.color} mb-2`}>{p.label}</p>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span>Total: <strong className="text-foreground">{p.total}</strong></span>
                  <Badge variant="secondary" className="bg-primary/10 text-primary text-xs">{p.success} ✓</Badge>
                  {p.failed > 0 && <Badge variant="destructive" className="text-xs">{p.failed} ✗</Badge>}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold neon-text-lilac">Analytics</h1>
          <p className="text-muted-foreground text-sm mt-1">Desempenho dos seus artigos e tráfego</p>
        </div>
        <div className="flex items-center gap-2">
          {gaConnected && (
            <Button variant="outline" size="sm" onClick={fetchAnalytics} disabled={loading} className="gap-2">
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Sincronizar
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => navigate('/settings')} className="gap-2">
            Configurar GA4
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Artigos Totais', value: articleStats.total, icon: FileText, color: 'text-primary' },
          { label: 'Publicados WP', value: articleStats.published, icon: Globe, color: 'text-primary' },
          { label: 'Falhas Public.', value: articleStats.failed, icon: TrendingDown, color: 'text-destructive' },
          { label: 'Taxa Sucesso', value: articleStats.total > 0 ? `${((articleStats.published / articleStats.total) * 100).toFixed(0)}%` : '0%', icon: Percent, color: 'text-accent' },
        ].map((stat) => (
          <Card key={stat.label} className="glass-card hover-lift">
            <CardContent className="p-4">
              <stat.icon className={`h-4 w-4 ${stat.color} mb-2`} />
              <p className="text-lg sm:text-2xl font-bold text-foreground tabular-nums">{stat.value}</p>
              <p className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wider">{stat.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {!gaConnected ? (
        <Card className="glass-card border-primary/20 bg-primary/5">
          <CardContent className="py-12 text-center">
            <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <BarChart3 className="h-6 w-6 text-primary" />
            </div>
            <h3 className="text-lg font-semibold text-foreground">Google Analytics não conectado</h3>
            <p className="text-sm text-muted-foreground mt-2 max-w-md mx-auto">
              Conecte sua propriedade do GA4 nas configurações para visualizar dados de tráfego, usuários e visualizações de página em tempo real.
            </p>
            <Button onClick={() => navigate('/settings')} className="mt-6 gradient-primary">
              Ir para Configurações
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Main GA Metrics */}
          {analytics && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                { label: 'Pageviews', value: analytics.pageviews.toLocaleString(), icon: Eye, change: '+12%', trend: 'up' },
                { label: 'Usuários', value: analytics.users.toLocaleString(), icon: Users, change: '+8%', trend: 'up' },
                { label: 'Sessões', value: analytics.sessions.toLocaleString(), icon: MousePointerClick, change: '-3%', trend: 'down' },
                { label: 'Bounce Rate', value: `${(analytics.bounceRate * 100).toFixed(1)}%`, icon: TrendingDown, change: '+2%', trend: 'down' },
              ].map((stat) => (
                <Card key={stat.label} className="glass-card hover-lift">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <stat.icon className="h-4 w-4 text-primary" />
                      <Badge variant="outline" className={`text-[10px] ${stat.trend === 'up' ? 'text-success border-success/30' : 'text-destructive border-destructive/30'}`}>
                        {stat.change}
                      </Badge>
                    </div>
                    <p className="text-xl sm:text-2xl font-bold text-foreground tabular-nums">{stat.value}</p>
                    <p className="text-xs text-muted-foreground">{stat.label}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Jetpack Metrics */}
          {jetpackStats && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold neon-text-lilac flex items-center gap-2">
                <Globe className="h-5 w-5" /> Jetpack (WordPress.com)
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: 'Views Hoje', value: jetpackStats.summary?.views_today || 0, icon: Eye },
                  { label: 'Visitantes', value: jetpackStats.summary?.visitors || 0, icon: Users },
                  { label: 'Seguidores', value: jetpackStats.summary?.followers || 0, icon: Heart },
                  { label: 'Views Totais', value: jetpackStats.summary?.views || 0, icon: BarChart3 },
                ].map((s) => (
                  <Card key={s.label} className="glass-card"><CardContent className="p-4">
                    <s.icon className="h-4 w-4 text-primary mb-2" />
                    <p className="text-lg sm:text-xl font-bold text-foreground">{(s.value || 0).toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground">{s.label}</p>
                  </CardContent></Card>
                ))}
              </div>
            </div>
          )}

          {socialSection}

          {/* Tips Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold neon-text-lilac flex items-center gap-2">
                <Lightbulb className="h-5 w-5" /> Insights da IA
              </h2>
              <Button size="sm" onClick={generateTips} disabled={loadingTips || !analytics} variant="outline" className="gap-2">
                {loadingTips ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                Gerar Dicas
              </Button>
            </div>

            {tips.length > 0 ? (
              <div className="grid gap-3">
                {tips.map((tip, idx) => (
                  <Card key={idx} className="glass-card border-primary/20 bg-primary/5">
                    <CardContent className="p-4 flex gap-4">
                      <div className="h-10 w-10 shrink-0 rounded-full bg-primary/10 flex items-center justify-center">
                        <Sparkles className="h-5 w-5 text-primary" />
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium uppercase tracking-wider text-primary">{tip.category}</span>
                          <Badge className={priorityColors[tip.priority]}>{tip.priority}</Badge>
                        </div>
                        <p className="text-sm text-foreground leading-relaxed">{tip.tip}</p>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card className="glass-card border-dashed">
                <CardContent className="py-8 text-center text-muted-foreground">
                  <p className="text-sm italic">Clique em "Gerar Dicas" para receber sugestões personalizadas da IA.</p>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Charts Row */}
          {analytics?.dailyViews && (
            <div className="grid lg:grid-cols-2 gap-6">
              <Card className="glass-card">
                <CardHeader>
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-primary" /> Tendência de Visualizações
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={250}>
                    <AreaChart data={analytics.dailyViews}>
                      <defs>
                        <linearGradient id="colorViews" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="hsl(260, 80%, 55%)" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="hsl(260, 80%, 55%)" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(260, 20%, 18%)" vertical={false} />
                      <XAxis dataKey="date" fontSize={10} stroke="hsl(260, 10%, 45%)" tickFormatter={(v) => v.split('-').slice(2).join('/')} />
                      <YAxis fontSize={10} stroke="hsl(260, 10%, 45%)" />
                      <Tooltip contentStyle={customTooltipStyle} cursor={{ stroke: 'hsl(260, 80%, 55%)', strokeWidth: 1 }} />
                      <Area type="monotone" dataKey="views" name="Visualizações" stroke="hsl(260, 80%, 55%)" fillOpacity={1} fill="url(#colorViews)" strokeWidth={3} />
                    </AreaChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card className="glass-card">
                <CardHeader>
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Smartphone className="h-4 w-4 text-accent" /> Dispositivos
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={250}>
                    <PieChart>
                      <Pie data={analytics.devices} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value" nameKey="device">
                        {analytics.devices.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={customTooltipStyle} />
                      <Legend verticalAlign="bottom" height={36} />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Tables Row */}
          <div className="grid lg:grid-cols-2 gap-6">
            <Card className="glass-card">
              <CardHeader>
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <ArrowUpRight className="h-4 w-4 text-primary" /> Páginas Mais Vistas
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-white/5 text-muted-foreground text-[11px] uppercase tracking-wider">
                        <th className="px-4 py-3 text-left font-medium">Página</th>
                        <th className="px-4 py-3 text-right font-medium">Views</th>
                        <th className="px-4 py-3 text-right font-medium">Tempo Médio</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {analytics?.topPages.map((page, i) => (
                        <tr key={i} className="hover:bg-white/[0.02] transition-colors">
                          <td className="px-4 py-3 font-medium max-w-[200px] truncate">{page.page}</td>
                          <td className="px-4 py-3 text-right tabular-nums">{page.views.toLocaleString()}</td>
                          <td className="px-4 py-3 text-right text-muted-foreground">{page.avgTime}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            <Card className="glass-card">
              <CardHeader>
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Clock className="h-4 w-4 text-accent" /> Tráfego por Hora
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={analytics?.hourlyTraffic}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(260, 20%, 18%)" vertical={false} />
                    <XAxis dataKey="hour" fontSize={10} stroke="hsl(260, 10%, 45%)" />
                    <YAxis fontSize={10} stroke="hsl(260, 10%, 45%)" />
                    <Tooltip contentStyle={customTooltipStyle} />
                    <Bar dataKey="views" name="Visualizações" fill="hsl(145, 80%, 45%)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
};

export default AnalyticsPage;
