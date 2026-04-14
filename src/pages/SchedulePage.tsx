import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Clock, Calendar, Save } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';
import { getErrorMessage, runBackendMutation, runBackendQuery } from '@/lib/backend';

const SchedulePage = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [articles, setArticles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;

    const fetchData = async () => {
      try {
        const data = await runBackendQuery(() =>
          supabase
            .from('articles')
            .select('id, title, category, scheduled_at, status')
            .eq('user_id', user.id)
            .not('scheduled_at', 'is', null)
            .order('scheduled_at', { ascending: true }),
        );

        const sorted = (data || []).sort((a: any, b: any) => {
          const aPub = a.status === 'published';
          const bPub = b.status === 'published';
          if (aPub !== bPub) return aPub ? 1 : -1;
          return new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime();
        });
        setArticles(sorted);
      } catch (error) {
        setArticles([]);
        toast({ title: 'Erro ao carregar agendamentos', description: getErrorMessage(error), variant: 'destructive' });
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [toast, user]);

  const handleEdit = (article: any) => {
    setEditingId(article.id);
    // Format to datetime-local input format
    const d = new Date(article.scheduled_at);
    setEditValue(format(d, "yyyy-MM-dd'T'HH:mm"));
  };

  const handleSave = async (articleId: string) => {
    if (!editValue) return;
    setSaving(true);
    try {
      const newDate = new Date(editValue).toISOString();
      await runBackendMutation(() =>
        supabase.from('articles').update({ scheduled_at: newDate }).eq('id', articleId),
      );
      setArticles(prev => prev.map(a => a.id === articleId ? { ...a, scheduled_at: newDate } : a));
      setEditingId(null);
      toast({ title: 'Agendamento atualizado!' });
    } catch (error) {
      toast({ title: 'Erro', description: getErrorMessage(error), variant: 'destructive' });
    } finally {
      setSaving(false);
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
      <div>
        <h1 className="text-2xl font-bold text-foreground">Agendamentos</h1>
        <p className="text-muted-foreground text-sm mt-1">Artigos agendados para publicação — clique na data para editar</p>
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
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-foreground truncate">{article.title}</p>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <Badge variant="secondary">{article.category}</Badge>
                      {editingId === article.id ? (
                        <div className="flex items-center gap-1.5">
                          <Input
                            type="datetime-local"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            className="h-7 text-xs w-auto"
                          />
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2 text-primary"
                            onClick={() => handleSave(article.id)}
                            disabled={saving}
                          >
                            {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2 text-muted-foreground"
                            onClick={() => setEditingId(null)}
                          >
                            ✕
                          </Button>
                        </div>
                      ) : (
                        <button
                          onClick={() => handleEdit(article)}
                          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors cursor-pointer"
                          title="Clique para editar data/hora"
                        >
                          <Clock className="h-3 w-3" />
                          {article.scheduled_at &&
                            format(new Date(article.scheduled_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                        </button>
                      )}
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
