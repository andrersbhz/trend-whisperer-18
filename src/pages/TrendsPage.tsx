import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { RefreshCw, TrendingUp, Loader2, Sparkles } from 'lucide-react';
import { getErrorMessage, runBackendQuery } from '@/lib/backend';

const TrendsPage = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [topics, setTopics] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetching, setFetching] = useState(false);
  const [selectedTopics, setSelectedTopics] = useState<string[]>([]);
  const [generating, setGenerating] = useState(false);

  const fetchTopics = async () => {
    if (!user) return;

    try {
      const data = await runBackendQuery(() =>
        supabase
          .from('trending_topics')
          .select('*')
          .eq('user_id', user.id)
          .eq('used', false)
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
  
  const handleGenerate = async (topicsToUse?: any[]) => {
    if (!user) return;
    setGenerating(true);
    
    try {
      // Step 1: Atualizar tendências antes de gerar (conforme solicitado)
      setFetching(true);
      await supabase.functions.invoke('fetch-trends', {
        body: { userId: user.id },
      });
      setFetching(false);

      // Step 2: Gerar artigos
      const body: any = { userId: user.id };
      if (topicsToUse && topicsToUse.length > 0) {
        body.topics = topicsToUse.map(t => ({
          topic: t.topic,
          category: t.category,
          search_volume: t.search_volume
        }));
      }

      const { data, error } = await supabase.functions.invoke('generate-articles', {
        body
      });

      if (error) throw error;

      toast({ 
        title: data?.success ? 'Sucesso' : 'Atenção', 
        description: data?.message || 'Artigos sendo gerados.',
        variant: data?.success ? 'default' : 'destructive'
      });
      
      setSelectedTopics([]);
      fetchTopics();
    } catch (error) {
      toast({ title: 'Erro ao gerar', description: getErrorMessage(error), variant: 'destructive' });
    } finally {
      setGenerating(false);
      setFetching(false);
    }
  };

  const toggleTopic = (topicId: string) => {
    setSelectedTopics(prev => 
      prev.includes(topicId) 
        ? prev.filter(id => id !== topicId) 
        : [...prev, topicId]
    );
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
        <div className="flex gap-2">
          {selectedTopics.length > 0 && (
            <Button 
              onClick={() => handleGenerate(topics.filter(t => selectedTopics.includes(t.id)))} 
              disabled={generating || fetching}
              variant="outline"
              className="border-primary text-primary hover:bg-primary/10"
            >
              {generating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
              Gerar ({selectedTopics.length})
            </Button>
          )}
          <Button onClick={handleFetchTrends} disabled={fetching || generating} variant="outline" size="sm">
            {fetching ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
            {fetching ? "Atualizando..." : "Atualizar"}
          </Button>
          <Button onClick={() => handleGenerate()} disabled={generating || fetching} className="gradient-primary">
            {generating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
            Atualizar e Gerar Tudo
          </Button>
        </div>
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
              <CardContent className="p-4 flex items-center gap-4">
                <Checkbox 
                  checked={selectedTopics.includes(topic.id)}
                  onCheckedChange={() => toggleTopic(topic.id)}
                  disabled={topic.used}
                />
                <div className="flex-1 flex items-center justify-between">
                  <div>
                    <p className="font-medium text-foreground">{topic.topic}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="secondary">{topic.category}</Badge>
                      {topic.search_volume && (
                        <span className="text-xs text-muted-foreground">{topic.search_volume} buscas</span>
                      )}
                    </div>
                  </div>
                  <div>
                    {topic.used ? (
                      <Badge variant="outline" className="text-muted-foreground">Usado</Badge>
                    ) : (
                      <Badge className="bg-success/20 text-success">Disponível</Badge>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default TrendsPage;
