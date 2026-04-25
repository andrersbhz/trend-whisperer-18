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
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [refreshInterval, setRefreshInterval] = useState(30); // minutos

  const fetchTopics = async () => {
    if (!user) return;

    try {
      // Buscar configurações para saber o intervalo e última atualização
      const { data: settings } = await supabase
        .from('user_settings')
        .select('last_trends_fetch, trends_refresh_interval')
        .eq('user_id', user.id)
        .single();

      if (settings) {
        if (settings.last_trends_fetch) setLastUpdate(new Date(settings.last_trends_fetch));
        if (settings.trends_refresh_interval) setRefreshInterval(settings.trends_refresh_interval);

        // Lógica de atualização automática se o tempo expirou
        const now = new Date();
        const last = settings.last_trends_fetch ? new Date(settings.last_trends_fetch) : new Date(0);
        const diffMinutes = (now.getTime() - last.getTime()) / (1000 * 60);

        if (diffMinutes >= (settings.trends_refresh_interval || 30)) {
          console.log("Intervalo de atualização atingido, buscando novas tendências...");
          handleFetchTrends();
          return; // handleFetchTrends chamará fetchTopics ao terminar
        }
      }

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

    // Setup de um timer para verificar periodicamente enquanto a página está aberta
    const timer = setInterval(() => {
      fetchTopics();
    }, 60000); // verifica a cada minuto

    return () => clearInterval(timer);
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
          search_volume: t.search_volume,
          context: t.context
        }));
        
        // Se houver tópicos selecionados, vamos garantir que a função use APENAS essas categorias
        const uniqueCategories = Array.from(new Set(topicsToUse.map(t => t.category)));
        if (uniqueCategories.length === 1) {
          body.forceCategory = uniqueCategories[0];
        }
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

  const selectAllFiltered = () => {
    const availableTopicIds = topics.filter(t => !t.used).map(t => t.id);
    if (selectedTopics.length === availableTopicIds.length) {
      setSelectedTopics([]);
    } else {
      setSelectedTopics(availableTopicIds);
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
          <Button onClick={handleFetchTrends} disabled={fetching || generating} variant="outline" size="sm" className="shadow-sm">
            {fetching ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
            {fetching ? "Atualizando..." : "Atualizar"}
          </Button>
          <Button onClick={() => handleGenerate()} disabled={generating || fetching} className="gradient-primary shadow-neon-lilac hover:scale-[1.02] transition-transform">
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
          <div className="flex items-center gap-2 mb-2 px-1">
            <Checkbox 
              id="select-all"
              checked={selectedTopics.length > 0 && selectedTopics.length === topics.filter(t => !t.used).length}
              onCheckedChange={selectAllFiltered}
            />
            <label htmlFor="select-all" className="text-sm font-medium cursor-pointer select-none">
              Selecionar todos disponíveis
            </label>
          </div>
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
                    {topic.context && (
                      <p className="text-xs text-muted-foreground mt-0.5 italic line-clamp-1">{topic.context}</p>
                    )}
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
