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
  Eye,
  MousePointerClick,
  Users,
  Lightbulb,
  RefreshCw,
  Loader2,
  ArrowUp,
  ArrowDown,
  Globe,
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
} from 'recharts';

interface AnalyticsData {
  pageviews: number;
  sessions: number;
  users: number;
  bounceRate: number;
  avgSessionDuration: string;
  topPages: { page: string; views: number }[];
  trafficSources: { source: string; value: number }[];
  dailyViews: { date: string; views: number }[];
}

interface AiTip {
  category: string;
  tip: string;
  priority: 'alta' | 'média' | 'baixa';
}

const CHART_COLORS = [
  'hsl(220, 90%, 56%)',
  'hsl(262, 83%, 58%)',
  'hsl(142, 76%, 36%)',
  'hsl(38, 92%, 50%)',
  'hsl(0, 84%, 60%)',
];

const AnalyticsPage = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [tips, setTips] = useState<AiTip[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingTips, setLoadingTips] = useState(false);
  const [gaConnected, setGaConnected] = useState(false);

  useEffect(() => {
    if (!user) return;
    checkGaConnection();
  }, [user]);

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
    { icon: Eye, label: 'Pageviews', value: analytics?.pageviews?.toLocaleString() || '0', color: 'text-primary' },
    { icon: Users, label: 'Usuários', value: analytics?.users?.toLocaleString() || '0', color: 'text-accent' },
    { icon: MousePointerClick, label: 'Sessões', value: analytics?.sessions?.toLocaleString() || '0', color: 'text-success' },
    { icon: TrendingUp, label: 'Taxa de Rejeição', value: `${analytics?.bounceRate || 0}%`, color: 'text-warning' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Analytics</h1>
          <p className="text-muted-foreground text-sm mt-1">Métricas e insights do seu blog</p>
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

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {analytics?.dailyViews && analytics.dailyViews.length > 0 && (
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="text-lg">Visualizações Diárias</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={analytics.dailyViews}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 13%, 91%)" />
                  <XAxis dataKey="date" fontSize={12} stroke="hsl(220, 10%, 46%)" />
                  <YAxis fontSize={12} stroke="hsl(220, 10%, 46%)" />
                  <Tooltip />
                  <Line type="monotone" dataKey="views" stroke="hsl(220, 90%, 56%)" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {analytics?.topPages && analytics.topPages.length > 0 && (
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="text-lg">Páginas Mais Visitadas</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={analytics.topPages.slice(0, 5)} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 13%, 91%)" />
                  <XAxis type="number" fontSize={12} stroke="hsl(220, 10%, 46%)" />
                  <YAxis dataKey="page" type="category" width={120} fontSize={11} stroke="hsl(220, 10%, 46%)" />
                  <Tooltip />
                  <Bar dataKey="views" fill="hsl(262, 83%, 58%)" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {analytics?.trafficSources && analytics.trafficSources.length > 0 && (
          <Card className="shadow-card lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-lg">Fontes de Tráfego</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-center">
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie
                      data={analytics.trafficSources}
                      cx="50%"
                      cy="50%"
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
            <CardDescription>Sugestões baseadas nos seus dados de analytics</CardDescription>
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
