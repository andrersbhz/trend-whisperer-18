import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, RefreshCw, MessageSquare, Bot, UserCheck, ExternalLink, History, ThumbsUp, AtSign } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { getErrorMessage } from '@/lib/backend';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

const SocialRobotPage = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [interactions, setInteractions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);

  const fetchInteractions = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data } = await supabase
        .from('social_interactions')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);
      setInteractions(data || []);
    } catch (error) {
      console.error('Interactions error:', error);
      toast({ title: 'Erro ao carregar interações', description: getErrorMessage(error), variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleProcessInteractions = async () => {
    if (!user) return;
    setProcessing(true);
    try {
      // Step 1: Fetch new ones from API
      await supabase.functions.invoke('handle-social-interactions', { body: { userId: user.id } });
      // Step 2: Generate AI replies
      const { data } = await supabase.functions.invoke('process-social-replies', { body: { userId: user.id } });
      
      toast({ 
        title: 'Sucesso', 
        description: `${data?.replied || 0} novas respostas humanas geradas.` 
      });
      fetchInteractions();
    } catch (error) {
      toast({ title: 'Erro no processamento', description: getErrorMessage(error), variant: 'destructive' });
    } finally {
      setProcessing(false);
    }
  };

  useEffect(() => {
    fetchInteractions();
  }, [user]);

  return (
    <div className="space-y-6 lg:space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold neon-text-lilac uppercase tracking-tighter flex items-center gap-3">
            <Bot className="h-8 w-8 text-primary" />
            Robô Social Humano
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Interaja com seu público de forma orgânica e automática</p>
        </div>
        <Button
          onClick={handleProcessInteractions}
          disabled={processing}
          size="lg"
          className="gradient-primary text-primary-foreground shadow-neon-lilac hover:scale-[1.02] transition-transform rounded-none font-bold uppercase tracking-widest text-xs"
        >
          {processing ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <UserCheck className="h-4 w-4 mr-2" />}
          Sincronizar e Responder Agora
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-6">
        <Card className="glass-card neon-border-lilac overflow-hidden">
          <CardHeader className="pb-3 border-b border-white/5 flex flex-row items-center justify-between">
            <div className="flex items-center gap-2">
              <History className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg uppercase tracking-tighter">Histórico de Interações</CardTitle>
            </div>
            <Badge variant="outline" className="border-primary/20 text-primary">
              {interactions.length} Interações
            </Badge>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-white/5">
              {loading ? (
                <div className="p-20 flex flex-col items-center gap-4">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  <p className="text-xs text-muted-foreground uppercase tracking-widest">Escaneando redes sociais...</p>
                </div>
              ) : interactions.length > 0 ? (
                interactions.map((item) => (
                  <div key={item.id} className="p-6 hover:bg-white/5 transition-all group">
                    <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
                      <div className="flex gap-4 min-w-0 flex-1">
                        <div className="relative shrink-0">
                          <div className="h-12 w-12 rounded-none border-2 border-primary/20 bg-background overflow-hidden shadow-neon-lilac/20">
                            {item.author_avatar ? (
                              <img src={item.author_avatar} alt={item.author_name} className="h-full w-full object-cover" />
                            ) : (
                              <div className="h-full w-full flex items-center justify-center bg-primary/10 text-primary text-lg font-black">
                                {item.author_name?.substring(0, 1).toUpperCase()}
                              </div>
                            )}
                          </div>
                          {item.page_avatar && (
                            <div className="absolute -top-2 -right-2 h-6 w-6 rounded-full border border-primary/40 bg-background overflow-hidden shadow-sm z-10">
                              <img src={item.page_avatar} alt="Página" className="h-full w-full object-cover" />
                            </div>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-3 mb-2 flex-wrap">
                            <span className="text-sm font-black text-primary uppercase tracking-tight">{item.author_name}</span>
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="text-[10px] h-4 px-2 border-primary/20 text-primary bg-primary/5">
                                {item.platform}
                              </Badge>
                              <Badge variant="secondary" className={cn(
                                "text-[9px] h-4 px-2 border-none font-bold",
                                item.interaction_type === 'reaction' ? "bg-blue-500/20 text-blue-400" : 
                                item.interaction_type === 'mention' ? "bg-purple-500/20 text-purple-400" : 
                                "bg-lilac-500/20 text-lilac-400"
                              )}>
                                {item.interaction_type === 'reaction' ? <ThumbsUp className="h-2 w-2 mr-1" /> : 
                                 item.interaction_type === 'mention' ? <AtSign className="h-2 w-2 mr-1" /> : 
                                 <MessageSquare className="h-2 w-2 mr-1" />}
                                {item.interaction_type === 'reaction' ? 'Curtida' : 
                                 item.interaction_type === 'mention' ? 'Menção' : 'Comentário'}
                              </Badge>
                            </div>
                            <span className="text-[10px] text-muted-foreground font-medium uppercase">
                              {format(new Date(item.created_at), "dd/MM 'às' HH:mm", { locale: ptBR })}
                            </span>
                            {item.original_link && (
                              <a 
                                href={item.original_link} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="text-[10px] text-primary hover:underline flex items-center gap-1 font-bold uppercase"
                              >
                                Ver Original <ExternalLink className="h-2 w-2" />
                              </a>
                            )}
                          </div>
                          <div className="bg-white/5 p-4 border-l-4 border-white/10 mb-4">
                            <p className="text-sm text-foreground italic leading-relaxed">"{item.content}"</p>
                          </div>
                          
                          {item.ai_response && (
                            <div className="mt-4 flex gap-4 items-start bg-primary/5 p-4 border-l-4 border-primary shadow-neon-lilac/5">
                              <MessageSquare className="h-4 w-4 text-primary mt-1 shrink-0" />
                              <div className="space-y-1">
                                <p className="text-[10px] font-black text-primary uppercase tracking-widest mb-1">Resposta da IA</p>
                                <p className="text-sm text-foreground leading-relaxed font-medium">{item.ai_response}</p>
                                {item.processed_at && (
                                  <p className="text-[9px] text-muted-foreground italic mt-2">
                                    Processado em {format(new Date(item.processed_at), "dd/MM HH:mm", { locale: ptBR })}
                                  </p>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-row md:flex-col items-center md:items-end gap-3">
                        <Badge 
                          variant="secondary" 
                          className={cn(
                            "text-[10px] uppercase font-black px-3 py-1 tracking-widest",
                            item.status === 'replied' ? "bg-success/20 text-success border border-success/30" : 
                            item.status === 'processed' ? "bg-blue-500/20 text-blue-400 border border-blue-500/30" :
                            "bg-warning/20 text-warning border border-warning/30"
                          )}
                        >
                          {item.status === 'replied' ? 'Respondido ✓' : 
                           item.status === 'processed' ? 'Analisado ✓' : 
                           'Pendente'}
                        </Badge>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-20 text-center space-y-4">
                  <div className="mx-auto w-16 h-16 rounded-full bg-primary/5 flex items-center justify-center border border-primary/10">
                    <Bot className="h-8 w-8 text-primary/40" />
                  </div>
                  <div className="max-w-xs mx-auto">
                    <p className="text-sm text-foreground font-bold uppercase tracking-widest">Silêncio no Vortex</p>
                    <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
                      Nenhuma interação recente encontrada nas suas páginas conectadas. Clique em sincronizar para buscar novos comentários.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default SocialRobotPage;