import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Clock, Calendar } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const SchedulePage = () => {
  const { user } = useAuth();
  const [articles, setArticles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const fetch = async () => {
      try {
        const { data, error } = await supabase
          .from('articles')
          .select('id, title, category, scheduled_at, status')
          .eq('user_id', user.id)
          .not('scheduled_at', 'is', null)
          .order('scheduled_at', { ascending: true });

        if (error) throw error;
        setArticles(data || []);
      } finally {
        setLoading(false);
      }
    };

    fetch();
  }, [user]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Agendamentos</h1>
        <p className="text-muted-foreground text-sm mt-1">Artigos agendados para publicação</p>
      </div>

      {articles.length === 0 ? (
        <Card className="shadow-card">
          <CardContent className="py-16 text-center">
            <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">Nenhum agendamento.</p>
            <p className="text-sm text-muted-foreground mt-1">Artigos gerados serão agendados automaticamente</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {articles.map((article) => (
            <Card key={article.id} className="shadow-card">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-foreground">{article.title}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="secondary">{article.category}</Badge>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {article.scheduled_at &&
                          format(new Date(article.scheduled_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                      </div>
                    </div>
                  </div>
                  <Badge
                    className={
                      article.status === 'published'
                        ? 'bg-success/20 text-success'
                        : 'bg-primary/20 text-primary'
                    }
                    variant="secondary"
                  >
                    {article.status === 'published' ? 'Publicado' : 'Agendado'}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default SchedulePage;
