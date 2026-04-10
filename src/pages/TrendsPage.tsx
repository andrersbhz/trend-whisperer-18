import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { RefreshCw, TrendingUp, Loader2 } from 'lucide-react';
import { getErrorMessage, runBackendQuery } from '@/lib/backend';

const TrendsPage = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [topics, setTopics] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetching, setFetching] = useState(false);

  const fetchTopics = async () => {
    if (!user) return;

    try {
      const data = await runBackendQuery(() =>
        supabase
          .from('trending_topics')
          .select('*')
          .eq('user_id', user.id)
          .order('fetched_at', { ascending: false })
          .limit(50),
      );

      setTopics(data || []);
    } catch (error) {
      setTopics([]);
      toast({ title: 'Erro ao carregar tendências', description: getErrorMessage(error), variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTopics();
  }, [user]);

  const handleFetchTrends = async () => {
    setFetching(true);
    try {
      const data = await runBackendQuery(() =>
        supabase.functions.invoke('fetch-trends', {
          body: { userId: user?.id },
        }),
      );

      toast({ title: 'Tendências atualizadas!', description: data?.message });
      fetchTopics();
    } catch (error) {
      toast({ title: 'Erro', description: getErrorMessage(error), variant: 'destructive' });
    } finally {
      setFetching(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Tendências</h1>
          <p className="text-muted-foreground text-sm mt-1">Assuntos em alta no Brasil</p>
        </div>
        <Button onClick={handleFetchTrends} disabled={fetching} className="gradient-primary">
          {fetching ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
          Atualizar Tendências
        </Button>
      </div>

      {topics.length === 0 ? (
        <Card className="shadow-card">
          <CardContent className="py-16 text-center">
            <TrendingUp className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">Nenhuma tendência carregada.</p>
            <p className="text-sm text-muted-foreground mt-1">Clique em "Atualizar Tendências" para buscar</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {topics.map((topic) => (
            <Card key={topic.id} className="shadow-card">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="font-medium text-foreground">{topic.topic}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant="secondary">{topic.category}</Badge>
                    {topic.search_volume && (
                      <span className="text-xs text-muted-foreground">{topic.search_volume} buscas</span>
                    )}
                  </div>
                </div>
                {topic.used ? (
                  <Badge variant="outline" className="text-muted-foreground">Usado</Badge>
                ) : (
                  <Badge className="bg-success/20 text-success">Disponível</Badge>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default TrendsPage;
