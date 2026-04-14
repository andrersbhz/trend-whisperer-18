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
  FileText, Smartphone, Monitor, Tablet, Facebook, Instagram, Heart, Share2,
  Twitter, Linkedin, Send,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell, AreaChart, Area, Legend,
} from 'recharts';
import { getErrorMessage, runBackendQuery } from '@/lib/backend';

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
    facebook: { total: number; success: number; failed: number };
    instagram: { total: number; success: number; failed: number };
  };
  jetpack: {
    posts_with_sharing: number;
    total_shares: number;
    shares_by_network: Record<string, number>;
  };
  summary: {
    total_published_wp: number;
    total_shared_social: number;
    total_facebook: number;
    total_instagram: number;
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
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [socialMetrics, setSocialMetrics] = useState<SocialMetrics | null>(null);
  const [tips, setTips] = useState<AiTip[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingTips, setLoadingTips] = useState(false);
  const [gaConnected, setGaConnected] = useState(false);
  const [articleStats, setArticleStats] = useState({ total: 0, published: 0, failed: 0 });
  const [metaMetrics, setMetaMetrics] = useState<any[] | null>(null);
  const [loadingMeta, setLoadingMeta] = useState(false);
  const [jetpackStats, setJetpackStats] = useState<JetpackStats | null>(null);
  const [loadingJetpack, setLoadingJetpack] = useState(false);

  useEffect(() => {
    if (!user) return;
    checkGaConnection();
    fetchArticleStats();
    fetchSocialMetrics();
    fetchMetaMetrics();
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

  const fetchMetaMetrics = async () => {
    if (!user) return;
    setLoadingMeta(true);
    try {
      const data = await runBackendQuery(() =>
        supabase.functions.invoke('fetch-meta-metrics', {
          body: { userId: user.id },
        }),
      );
      if (data?.pages) {
        // Filter out pages that only have errors (expired token, etc.)
        const validPages = (data.pages as any[]).filter((pg: any) => {
          const hasFbError = pg.facebook?.error;
          const hasFbData = pg.facebook && !pg.facebook.error && (pg.facebook.fan_count || pg.facebook.followers_count);
          const hasIgData = pg.instagram && !pg.instagram.error && (pg.instagram.followers_count || pg.instagram.media_count);
          return hasFbData || hasIgData;
        });
        setMetaMetrics(validPages.length > 0 ? validPages : null);
      }
    } catch (error) {
      console.error('Meta metrics error:', error);
      setMetaMetrics(null);
    } finally {
      setLoadingMeta(false);
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
          { icon: Facebook, label: 'Facebook', value: sm?.total_facebook || 0, color: 'text-accent' },
          { icon: Instagram, label: 'Instagram', value: sm?.total_instagram || 0, color: 'text-primary' },
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
            { label: 'Facebook', total: pl.facebook.total, success: pl.facebook.success, failed: pl.facebook.failed, color: 'text-accent' },
            { label: 'Instagram', total: pl.instagram.total, success: pl.instagram.success, failed: pl.instagram.failed, color: 'text-primary' },
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

      {/* === META API METRICS === */}
      {loadingMeta && (
        <div className="flex items-center gap-2 text-muted-foreground text-sm">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando métricas do Meta...
        </div>
      )}
      {metaMetrics && metaMetrics.length > 0 && metaMetrics.map((pg: any, idx: number) => (
        <div key={idx} className="space-y-3">
          <h3 className="text-md font-semibold text-foreground flex items-center gap-2">
            <Facebook className="h-4 w-4 text-accent" /> {pg.page_name || 'Página'}
          </h3>
          {pg.facebook && !pg.facebook.error && (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: 'Seguidores', value: pg.facebook.followers_count || pg.facebook.fan_count || 0 },
                  { label: 'Curtidas', value: pg.facebook.fan_count || 0 },
                  { label: 'Falando sobre', value: pg.facebook.talking_about_count || 0 },
                  { label: 'Check-ins', value: pg.facebook.were_here_count || 0 },
                ].map((s: any) => (
                  <Card key={s.label} className="glass-card"><CardContent className="p-3">
                    <p className="text-lg font-bold text-foreground">{(s.value || 0).toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground">{s.label}</p>
                  </CardContent></Card>
                ))}
              </div>
              {pg.facebook.insights && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { label: 'Impressões (28d)', value: pg.facebook.insights.page_impressions?.total || 0 },
                    { label: 'Alcance Único', value: pg.facebook.insights.page_impressions_unique?.total || 0 },
                    { label: 'Engajamento', value: pg.facebook.insights.page_post_engagements?.total || 0 },
                    { label: 'Engajados', value: pg.facebook.insights.page_engaged_users?.total || 0 },
                    { label: 'Views Página', value: pg.facebook.insights.page_views_total?.total || 0 },
                    { label: 'Novos Fãs', value: pg.facebook.insights.page_fan_adds?.total || 0 },
                    { label: 'Fãs Perdidos', value: pg.facebook.insights.page_fan_removes?.total || 0 },
                    { label: 'Feedback Neg.', value: pg.facebook.insights.page_negative_feedback?.total || 0 },
                  ].map((s: any) => (
                    <Card key={s.label} className="glass-card"><CardContent className="p-3">
                      <p className="text-lg font-bold text-foreground">{(s.value || 0).toLocaleString()}</p>
                      <p className="text-xs text-muted-foreground">{s.label}</p>
                    </CardContent></Card>
                  ))}
                </div>
              )}
              {pg.facebook.post_stats && (
                <Card className="glass-card"><CardContent className="p-4">
                  <p className="text-sm font-medium text-foreground mb-3">📊 Últimos {pg.facebook.post_stats.total_posts} Posts</p>
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-center">
                    {[
                      { label: 'Curtidas', value: pg.facebook.post_stats.total_likes },
                      { label: 'Comentários', value: pg.facebook.post_stats.total_comments },
                      { label: 'Reações', value: pg.facebook.post_stats.total_reactions },
                      { label: 'Compartilh.', value: pg.facebook.post_stats.total_shares },
                      { label: 'Eng. Médio', value: pg.facebook.post_stats.avg_engagement },
                    ].map((s: any) => (
                      <div key={s.label}>
                        <p className="text-lg font-bold text-foreground">{(s.value || 0).toLocaleString()}</p>
                        <p className="text-xs text-muted-foreground">{s.label}</p>
                      </div>
                    ))}
                  </div>
                </CardContent></Card>
              )}
              {pg.facebook.insights?.page_impressions?.daily?.length > 0 && (
                <Card className="glass-card"><CardHeader><CardTitle className="text-sm text-foreground">Impressões FB (28d)</CardTitle></CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={200}>
                      <AreaChart data={pg.facebook.insights.page_impressions.daily}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(260, 20%, 18%)" />
                        <XAxis dataKey="date" fontSize={10} stroke="hsl(260, 10%, 45%)" />
                        <YAxis fontSize={10} stroke="hsl(260, 10%, 45%)" />
                        <Tooltip contentStyle={customTooltipStyle} />
                        <Area type="monotone" dataKey="value" name="Impressões" stroke="hsl(220, 80%, 55%)" fill="hsl(220, 80%, 55%, 0.15)" strokeWidth={2} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              )}
            </>
          )}
          {/* Error messages are hidden - only show when there's valid data */}
          {pg.instagram && (
            <>
              <h3 className="text-md font-semibold text-foreground flex items-center gap-2 mt-4">
                <Instagram className="h-4 w-4 text-primary" /> Instagram {pg.instagram.username ? `@${pg.instagram.username}` : ''}
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: 'Seguidores', value: pg.instagram.followers_count || 0 },
                  { label: 'Seguindo', value: pg.instagram.follows_count || 0 },
                  { label: 'Publicações', value: pg.instagram.media_count || 0 },
                  { label: 'Eng. Médio', value: pg.instagram.post_stats?.avg_engagement || 0 },
                ].map((s: any) => (
                  <Card key={s.label} className="glass-card"><CardContent className="p-3">
                    <p className="text-lg font-bold text-foreground">{(s.value || 0).toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground">{s.label}</p>
                  </CardContent></Card>
                ))}
              </div>
              {pg.instagram.insights && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { label: 'Impressões (28d)', value: pg.instagram.insights.impressions?.total || 0 },
                    { label: 'Alcance (28d)', value: pg.instagram.insights.reach?.total || 0 },
                    { label: 'Visitas Perfil', value: pg.instagram.insights.profile_views?.total || 0 },
                    { label: 'Cliques Site', value: pg.instagram.insights.website_clicks?.total || 0 },
                  ].map((s: any) => (
                    <Card key={s.label} className="glass-card"><CardContent className="p-3">
                      <p className="text-lg font-bold text-foreground">{(s.value || 0).toLocaleString()}</p>
                      <p className="text-xs text-muted-foreground">{s.label}</p>
                    </CardContent></Card>
                  ))}
                </div>
              )}
              {pg.instagram.post_stats && (
                <Card className="glass-card"><CardContent className="p-4">
                  <p className="text-sm font-medium text-foreground mb-3">📸 Últimos {pg.instagram.post_stats.total_posts} Posts</p>
                  <div className="grid grid-cols-3 gap-3 text-center">
                    {[
                      { label: 'Curtidas', value: pg.instagram.post_stats.total_likes },
                      { label: 'Comentários', value: pg.instagram.post_stats.total_comments },
                      { label: 'Eng. Médio', value: pg.instagram.post_stats.avg_engagement },
                    ].map((s: any) => (
                      <div key={s.label}>
                        <p className="text-lg font-bold text-foreground">{(s.value || 0).toLocaleString()}</p>
                        <p className="text-xs text-muted-foreground">{s.label}</p>
                      </div>
                    ))}
                  </div>
                </CardContent></Card>
              )}
              {pg.instagram.demographics?.audience_country && (
                <Card className="glass-card"><CardHeader><CardTitle className="text-sm text-foreground">Audiência por País</CardTitle></CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {Object.entries(pg.instagram.demographics.audience_country as Record<string, number>)
                        .sort(([, a], [, b]) => (b as number) - (a as number)).slice(0, 10)
                        .map(([country, count]) => (
                          <div key={country} className="flex items-center justify-between p-2 rounded-lg hover:bg-secondary/30">
                            <span className="text-sm text-foreground">{country}</span>
                            <Badge variant="secondary" className="text-xs">{(count as number).toLocaleString()}</Badge>
                          </div>
                        ))}
                    </div>
                  </CardContent>
                </Card>
              )}
              {pg.instagram.insights?.reach?.daily?.length > 0 && (
                <Card className="glass-card"><CardHeader><CardTitle className="text-sm text-foreground">Alcance IG (28d)</CardTitle></CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={200}>
                      <AreaChart data={pg.instagram.insights.reach.daily}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(260, 20%, 18%)" />
                        <XAxis dataKey="date" fontSize={10} stroke="hsl(260, 10%, 45%)" />
                        <YAxis fontSize={10} stroke="hsl(260, 10%, 45%)" />
                        <Tooltip contentStyle={customTooltipStyle} />
                        <Area type="monotone" dataKey="value" name="Alcance" stroke="hsl(320, 80%, 55%)" fill="hsl(320, 80%, 55%, 0.15)" strokeWidth={2} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </div>
      ))}
      {!loadingMeta && (!metaMetrics || metaMetrics.length === 0) && (
        <Card className="glass-card"><CardContent className="p-4 text-center text-sm text-muted-foreground">
          <Facebook className="h-8 w-8 mx-auto mb-2 opacity-50" />
          Conecte sua página do Facebook em Configurações para ver métricas do Meta
        </CardContent></Card>
      )}
    </div>
  );

  if (!gaConnected) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold neon-text-lilac">Analytics</h1>
          <p className="text-muted-foreground text-sm mt-1">Métricas e insights do seu blog</p>
        </div>
        {socialSection}
        <Card className="glass-card">
          <CardContent className="py-16 text-center">
            <BarChart3 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-foreground font-medium">Google Analytics não conectado</p>
            <p className="text-sm text-muted-foreground mt-1">
              Vá em Configurações e conecte seu Google Analytics para ver as métricas completas
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const statCards = [
    { icon: Eye, label: 'Pageviews', value: analytics?.pageviews?.toLocaleString() || '0', color: 'text-primary', change: '+12%', up: true },
    { icon: Users, label: 'Usuários', value: analytics?.users?.toLocaleString() || '0', color: 'text-accent', change: '+8%', up: true },
    { icon: MousePointerClick, label: 'Sessões', value: analytics?.sessions?.toLocaleString() || '0', color: 'text-primary', change: '+5%', up: true },
    { icon: Percent, label: 'Taxa de Rejeição', value: `${analytics?.bounceRate || 0}%`, color: 'text-warning', change: '-3%', up: false },
    { icon: Clock, label: 'Duração Média', value: analytics?.avgSessionDuration || '0:00', color: 'text-primary', change: '+15s', up: true },
    { icon: ArrowUpRight, label: 'Págs/Sessão', value: analytics?.pagesPerSession?.toFixed(1) || '0', color: 'text-accent', change: '+0.3', up: true },
    { icon: Users, label: 'Novos Usuários', value: analytics?.newUsers?.toLocaleString() || '0', color: 'text-primary', change: '+10%', up: true },
    { icon: FileText, label: 'Artigos Publicados', value: String(articleStats.published), color: 'text-accent', change: `${articleStats.total} total`, up: true },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold neon-text-lilac">Analytics</h1>
          <p className="text-muted-foreground text-sm mt-1">Métricas completas e insights do seu blog</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={generateTips} disabled={loadingTips || !analytics} className="border-accent/30 hover:bg-accent/10 text-accent">
            {loadingTips ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Lightbulb className="h-4 w-4 mr-2" />}
            Dicas IA
          </Button>
          <Button onClick={fetchAnalytics} className="gradient-primary text-primary-foreground shadow-neon-lilac">
            <RefreshCw className="h-4 w-4 mr-2" />
            Atualizar
          </Button>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {statCards.map((stat) => (
          <Card key={stat.label} className="glass-card">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <stat.icon className={`h-5 w-5 ${stat.color} opacity-80`} />
                <span className={`text-xs flex items-center gap-0.5 ${stat.up ? 'text-primary' : 'text-destructive'}`}>
                  {stat.up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                  {stat.change}
                </span>
              </div>
              <p className="text-xl font-bold text-foreground">{stat.value}</p>
              <p className="text-xs text-muted-foreground">{stat.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Social Metrics */}
      {socialSection}

      {/* Main Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {analytics?.dailyViews && analytics.dailyViews.length > 0 && (
          <Card className="glass-card lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-lg text-foreground">Tráfego dos Últimos 30 Dias</CardTitle>
              <CardDescription>Visualizações, usuários e sessões diárias</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={analytics.dailyViews}>
                  <defs>
                    <linearGradient id="colorViews" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(145, 80%, 45%)" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(145, 80%, 45%)" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorUsers" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(320, 80%, 55%)" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(320, 80%, 55%)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(260, 20%, 18%)" />
                  <XAxis dataKey="date" fontSize={11} stroke="hsl(260, 10%, 45%)" />
                  <YAxis fontSize={11} stroke="hsl(260, 10%, 45%)" />
                  <Tooltip contentStyle={customTooltipStyle} />
                  <Legend />
                  <Area type="monotone" dataKey="views" name="Views" stroke="hsl(145, 80%, 45%)" fill="url(#colorViews)" strokeWidth={2} />
                  <Area type="monotone" dataKey="users" name="Usuários" stroke="hsl(320, 80%, 55%)" fill="url(#colorUsers)" strokeWidth={2} />
                  <Line type="monotone" dataKey="sessions" name="Sessões" stroke="hsl(275, 70%, 50%)" strokeWidth={2} dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {analytics?.topPages && analytics.topPages.length > 0 && (
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="text-lg text-foreground">Páginas Mais Visitadas</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {analytics.topPages.slice(0, 10).map((page, i) => (
                  <div key={i} className="flex items-center justify-between p-2 rounded-lg hover:bg-secondary/30 transition-colors">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <span className="text-xs font-bold text-primary w-5">{i + 1}</span>
                      <span className="text-sm text-foreground truncate">{page.page}</span>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-xs text-muted-foreground">{page.avgTime}</span>
                      <Badge variant="secondary" className="text-xs bg-primary/10 text-primary">{page.views}</Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {analytics?.trafficSources && analytics.trafficSources.length > 0 && (
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="text-lg text-foreground">Fontes de Tráfego</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={analytics.trafficSources}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    dataKey="value"
                    nameKey="source"
                    label={({ source, percent }) => `${source} ${(percent * 100).toFixed(0)}%`}
                  >
                    {analytics.trafficSources.map((_, index) => (
                      <Cell key={index} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={customTooltipStyle} />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {analytics?.devices && analytics.devices.length > 0 && (
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="text-lg text-foreground">Dispositivos</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {analytics.devices.map((d, i) => {
                  const Icon = deviceIcons[d.device] || Monitor;
                  const total = analytics.devices.reduce((s, x) => s + x.value, 0);
                  const pct = total > 0 ? ((d.value / total) * 100).toFixed(1) : '0';
                  return (
                    <div key={i} className="space-y-1">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Icon className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm text-foreground">{d.device}</span>
                        </div>
                        <span className="text-sm font-medium text-foreground">{pct}%</span>
                      </div>
                      <div className="h-2 rounded-full bg-secondary overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{ width: `${pct}%`, backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {analytics?.hourlyTraffic && analytics.hourlyTraffic.length > 0 && (
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="text-lg text-foreground">Tráfego por Hora</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={analytics.hourlyTraffic}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(260, 20%, 18%)" />
                  <XAxis dataKey="hour" fontSize={10} stroke="hsl(260, 10%, 45%)" />
                  <YAxis fontSize={10} stroke="hsl(260, 10%, 45%)" />
                  <Tooltip contentStyle={customTooltipStyle} />
                  <Bar dataKey="views" fill="hsl(320, 80%, 55%)" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {analytics?.topReferrers && analytics.topReferrers.length > 0 && (
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="text-lg text-foreground">Principais Referências</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {analytics.topReferrers.map((ref, i) => (
                  <div key={i} className="flex items-center justify-between p-2 rounded-lg hover:bg-secondary/30 transition-colors">
                    <div className="flex items-center gap-2">
                      <Globe className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm text-foreground">{ref.referrer}</span>
                    </div>
                    <Badge variant="secondary" className="bg-accent/10 text-accent">{ref.visits}</Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {analytics?.countries && analytics.countries.length > 0 && (
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="text-lg text-foreground">Países</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {analytics.countries.map((c, i) => (
                  <div key={i} className="flex items-center justify-between p-2 rounded-lg hover:bg-secondary/30 transition-colors">
                    <span className="text-sm text-foreground">{c.country}</span>
                    <Badge variant="secondary" className="bg-primary/10 text-primary">{c.users} usuários</Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* AI Tips */}
      {tips.length > 0 && (
        <Card className="glass-card neon-border-lilac">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Lightbulb className="h-5 w-5 text-warning" />
              <CardTitle className="text-lg text-foreground">Dicas da IA para Melhorar</CardTitle>
            </div>
            <CardDescription>Sugestões personalizadas baseadas nos dados de analytics e redes sociais</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {tips.map((tip, index) => (
                <div key={index} className="flex items-start gap-3 p-3 rounded-lg bg-secondary/30">
                  <Badge className={priorityColors[tip.priority]} variant="secondary">
                    {tip.priority}
                  </Badge>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-0.5">{tip.category}</p>
                    <p className="text-sm text-foreground">{tip.tip}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default AnalyticsPage;
