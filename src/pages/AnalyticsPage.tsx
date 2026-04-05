import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  Eye,
  MousePointerClick,
  Users,
  Lightbulb,
  RefreshCw,
  Loader2,
  Globe,
  Clock,
  ArrowUpRight,
  Percent,
  FileText,
  Smartphone,
  Monitor,
  Tablet,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  Legend,
} from 'recharts';

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

interface AiTip {
  category: string;
  tip: string;
  priority: 'alta' | 'média' | 'baixa';
}

const CHART_COLORS = [
  'hsl(var(--primary))',
  'hsl(var(--accent))',
  'hsl(142, 76%, 36%)',
  'hsl(38, 92%, 50%)',
  'hsl(var(--destructive))',
  'hsl(262, 83%, 58%)',
];

const AnalyticsPage = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [tips, setTips] = useState<AiTip[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingTips, setLoadingTips] = useState(false);
  const [gaConnected, setGaConnected] = useState(false);
  const [articleStats, setArticleStats] = useState({ total: 0, published: 0, failed: 0 });

  useEffect(() => {
    if (!user) return;
    checkGaConnection();
    fetchArticleStats();
  }, [user]);

  const fetchArticleStats = async () => {
    if (!user) return;
    const { data } = await supabase.from('articles').select('status').eq('user_id', user.id);
    if (data) {
      setArticleStats({
        total: data.length,
        published: data.filter((a) => a.status === 'published').length,
        failed: data.filter((a) => a.status === 'failed').length,
      });
    }
  };

  const checkGaConnection = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('user_settings')
      .select('google_analytics_property_id')
      .eq('user_id', user.id)
      .maybeSingle();

    const connected = !!(data as any)?.google_analytics_property_id;
    setGaConnected(connected);

    if (connected) {
      fetchAnalytics();
    } else {
      setLoading(false);
    }
  };

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('fetch-analytics', {
        body: { userId: user?.id },
      });
      if (error) throw error;
      if (data?.analytics) {
        setAnalytics(data.analytics);
      }
    } catch (e: any) {
      toast({ title: 'Erro', description: e.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const generateTips = async () => {
    if (!analytics) return;
    setLoadingTips(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-analytics-tips', {
        body: { userId: user?.id, analytics },
      });
      if (error) throw error;
      setTips(data?.tips || []);
    } catch (e: any) {
      toast({ title: 'Erro', description: e.message, variant: 'destructive' });
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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!gaConnected) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Analytics</h1>
          <p className="text-muted-foreground text-sm mt-1">Métricas e insights do seu blog</p>
        </div>
        <Card className="shadow-card">
          <CardContent className="py-16 text-center">
            <BarChart3 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-foreground font-medium">Google Analytics não conectado</p>
            <p className="text-sm text-muted-foreground mt-1">
              Vá em Configurações e conecte seu Google Analytics para ver as métricas
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const statCards = [
    { icon: Eye, label: 'Pageviews', value: analytics?.pageviews?.toLocaleString() || '0', color: 'text-primary', change: '+12%', up: true },
    { icon: Users, label: 'Usuários', value: analytics?.users?.toLocaleString() || '0', color: 'text-accent', change: '+8%', up: true },
    { icon: MousePointerClick, label: 'Sessões', value: analytics?.sessions?.toLocaleString() || '0', color: 'text-success', change: '+5%', up: true },
    { icon: Percent, label: 'Taxa de Rejeição', value: `${analytics?.bounceRate || 0}%`, color: 'text-warning', change: '-3%', up: false },
    { icon: Clock, label: 'Duração Média', value: analytics?.avgSessionDuration || '0:00', color: 'text-primary', change: '+15s', up: true },
    { icon: ArrowUpRight, label: 'Págs/Sessão', value: analytics?.pagesPerSession?.toFixed(1) || '0', color: 'text-accent', change: '+0.3', up: true },
    { icon: Users, label: 'Novos Usuários', value: analytics?.newUsers?.toLocaleString() || '0', color: 'text-success', change: '+10%', up: true },
    { icon: FileText, label: 'Artigos Publicados', value: String(articleStats.published), color: 'text-primary', change: `${articleStats.total} total`, up: true },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Analytics</h1>
          <p className="text-muted-foreground text-sm mt-1">Métricas completas e insights do seu blog</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={generateTips} disabled={loadingTips || !analytics}>
            {loadingTips ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Lightbulb className="h-4 w-4 mr-2" />}
            Gerar Dicas IA
          </Button>
          <Button onClick={fetchAnalytics} className="gradient-primary">
            <RefreshCw className="h-4 w-4 mr-2" />
            Atualizar
          </Button>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {statCards.map((stat) => (
          <Card key={stat.label} className="shadow-card">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <stat.icon className={`h-5 w-5 ${stat.color} opacity-80`} />
                <span className={`text-xs flex items-center gap-0.5 ${stat.up ? 'text-success' : 'text-destructive'}`}>
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

      {/* Main Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Daily Views + Users + Sessions */}
        {analytics?.dailyViews && analytics.dailyViews.length > 0 && (
          <Card className="shadow-card lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-lg">Tráfego dos Últimos 30 Dias</CardTitle>
              <CardDescription>Visualizações, usuários e sessões diárias</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={analytics.dailyViews}>
                  <defs>
                    <linearGradient id="colorViews" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(220, 90%, 56%)" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(220, 90%, 56%)" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorUsers" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(142, 76%, 36%)" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(142, 76%, 36%)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 13%, 91%)" />
                  <XAxis dataKey="date" fontSize={11} stroke="hsl(220, 10%, 46%)" />
                  <YAxis fontSize={11} stroke="hsl(220, 10%, 46%)" />
                  <Tooltip />
                  <Legend />
                  <Area type="monotone" dataKey="views" name="Views" stroke="hsl(220, 90%, 56%)" fill="url(#colorViews)" strokeWidth={2} />
                  <Area type="monotone" dataKey="users" name="Usuários" stroke="hsl(142, 76%, 36%)" fill="url(#colorUsers)" strokeWidth={2} />
                  <Line type="monotone" dataKey="sessions" name="Sessões" stroke="hsl(38, 92%, 50%)" strokeWidth={2} dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {/* Top Pages */}
        {analytics?.topPages && analytics.topPages.length > 0 && (
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="text-lg">Páginas Mais Visitadas</CardTitle>
              <CardDescription>Top 10 páginas por visualizações</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {analytics.topPages.slice(0, 10).map((page, i) => (
                  <div key={i} className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <span className="text-xs font-bold text-muted-foreground w-5">{i + 1}</span>
                      <span className="text-sm text-foreground truncate">{page.page}</span>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-xs text-muted-foreground">{page.avgTime}</span>
                      <Badge variant="secondary" className="text-xs">{page.views}</Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Traffic Sources Pie */}
        {analytics?.trafficSources && analytics.trafficSources.length > 0 && (
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="text-lg">Fontes de Tráfego</CardTitle>
              <CardDescription>De onde vêm seus visitantes</CardDescription>
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
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {/* Devices */}
        {analytics?.devices && analytics.devices.length > 0 && (
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="text-lg">Dispositivos</CardTitle>
              <CardDescription>Distribuição por tipo de dispositivo</CardDescription>
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
                      <div className="h-2 rounded-full bg-muted overflow-hidden">
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

        {/* Hourly Traffic */}
        {analytics?.hourlyTraffic && analytics.hourlyTraffic.length > 0 && (
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="text-lg">Tráfego por Hora</CardTitle>
              <CardDescription>Horários de pico do seu blog</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={analytics.hourlyTraffic}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 13%, 91%)" />
                  <XAxis dataKey="hour" fontSize={10} stroke="hsl(220, 10%, 46%)" />
                  <YAxis fontSize={10} stroke="hsl(220, 10%, 46%)" />
                  <Tooltip />
                  <Bar dataKey="views" fill="hsl(262, 83%, 58%)" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {/* Top Referrers */}
        {analytics?.topReferrers && analytics.topReferrers.length > 0 && (
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="text-lg">Principais Referências</CardTitle>
              <CardDescription>Sites que enviam tráfego para você</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {analytics.topReferrers.map((ref, i) => (
                  <div key={i} className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50">
                    <div className="flex items-center gap-2">
                      <Globe className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm text-foreground">{ref.referrer}</span>
                    </div>
                    <Badge variant="secondary">{ref.visits}</Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Countries */}
        {analytics?.countries && analytics.countries.length > 0 && (
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="text-lg">Países</CardTitle>
              <CardDescription>Origem geográfica dos visitantes</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {analytics.countries.map((c, i) => (
                  <div key={i} className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50">
                    <span className="text-sm text-foreground">{c.country}</span>
                    <Badge variant="secondary">{c.users} usuários</Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* AI Tips */}
      {tips.length > 0 && (
        <Card className="shadow-card">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Lightbulb className="h-5 w-5 text-warning" />
              <CardTitle className="text-lg">Dicas da IA para Melhorar</CardTitle>
            </div>
            <CardDescription>Sugestões personalizadas baseadas nos seus dados de analytics</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {tips.map((tip, index) => (
                <div key={index} className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
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
