import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Send, Eye, Trash2, Loader2, FileText, RotateCcw } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

const ArticlesPage = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [articles, setArticles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState<string | null>(null);
  const [retrying, setRetrying] = useState<string | null>(null);
  const [preview, setPreview] = useState<any | null>(null);

  const fetchArticles = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('articles')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    setArticles(data || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchArticles();
  }, [user]);

  const handlePublish = async (articleId: string) => {
    setPublishing(articleId);
    try {
      const { data, error } = await supabase.functions.invoke('publish-article', {
        body: { articleId, userId: user?.id },
      });
      if (error) throw error;
      toast({ title: 'Publicado!', description: data?.message || 'Artigo publicado com sucesso.' });
      fetchArticles();
    } catch (e: any) {
      toast({ title: 'Erro', description: e.message, variant: 'destructive' });
    } finally {
      setPublishing(null);
    }
  };

  const handleRetry = async (articleId: string) => {
    setRetrying(articleId);
    try {
      // Reset status to ready then publish
      await supabase.from('articles').update({ status: 'ready' }).eq('id', articleId);
      const { data, error } = await supabase.functions.invoke('publish-article', {
        body: { articleId, userId: user?.id },
      });
      if (error) throw error;
      toast({ title: 'Tentativa enviada!', description: data?.message || 'Artigo republicado.' });
      fetchArticles();
    } catch (e: any) {
      toast({ title: 'Erro', description: e.message, variant: 'destructive' });
    } finally {
      setRetrying(null);
    }
  };

  const handleDelete = async (articleId: string) => {
    try {
      await supabase.from('articles').delete().eq('id', articleId);
      toast({ title: 'Excluído', description: 'Artigo removido.' });
      fetchArticles();
    } catch (e: any) {
      toast({ title: 'Erro', description: e.message, variant: 'destructive' });
    }
  };

  const statusColors: Record<string, string> = {
    draft: 'bg-muted text-muted-foreground',
    generating: 'bg-warning/20 text-warning',
    ready: 'bg-primary/20 text-primary',
    publishing: 'bg-accent/20 text-accent',
    published: 'bg-success/20 text-success',
    failed: 'bg-destructive/20 text-destructive',
  };

  const statusLabels: Record<string, string> = {
    draft: 'Rascunho',
    generating: 'Gerando...',
    ready: 'Pronto',
    publishing: 'Publicando...',
    published: 'Publicado',
    failed: 'Falhou',
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
        <h1 className="text-2xl font-bold text-foreground">Artigos</h1>
        <p className="text-muted-foreground text-sm mt-1">{articles.length} artigos gerados</p>
      </div>

      {articles.length === 0 ? (
        <Card className="shadow-card">
          <CardContent className="py-16 text-center">
            <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">Nenhum artigo encontrado.</p>
            <p className="text-sm text-muted-foreground mt-1">Vá ao Dashboard e clique em "Gerar Artigos"</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {articles.map((article) => (
            <Card key={article.id} className="shadow-card">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge className={statusColors[article.status] || ''} variant="secondary">
                        {statusLabels[article.status] || article.status}
                      </Badge>
                      <span className="text-xs text-muted-foreground">{article.category}</span>
                    </div>
                    <h3 className="font-semibold text-foreground truncate">{article.title}</h3>
                    {article.seo_keyword && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Palavra-chave: <span className="text-primary">{article.seo_keyword}</span>
                      </p>
                    )}
                    {article.meta_description && (
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{article.meta_description}</p>
                    )}
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button size="sm" variant="ghost" onClick={() => setPreview(article)}>
                      <Eye className="h-4 w-4" />
                    </Button>
                    {article.status === 'failed' && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-warning"
                        onClick={() => handleRetry(article.id)}
                        disabled={retrying === article.id}
                        title="Tentar novamente"
                      >
                        {retrying === article.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <RotateCcw className="h-4 w-4" />
                        )}
                      </Button>
                    )}
                    {(article.status === 'ready' || article.status === 'draft') && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-primary"
                        onClick={() => handlePublish(article.id)}
                        disabled={publishing === article.id}
                      >
                        {publishing === article.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Send className="h-4 w-4" />
                        )}
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" className="text-destructive" onClick={() => handleDelete(article.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!preview} onOpenChange={() => setPreview(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{preview?.title}</DialogTitle>
          </DialogHeader>
          {preview?.featured_image_url && (
            <img src={preview.featured_image_url} alt={preview.title} className="w-full rounded-lg" />
          )}
          <div className="space-y-3 text-sm">
            <div className="flex gap-2 flex-wrap">
              <Badge variant="secondary">{preview?.category}</Badge>
              {preview?.seo_keyword && <Badge variant="outline">🔑 {preview.seo_keyword}</Badge>}
            </div>
            {preview?.meta_description && (
              <div className="p-3 rounded-lg bg-muted">
                <p className="text-xs font-medium text-muted-foreground mb-1">Meta Description</p>
                <p className="text-sm text-foreground">{preview?.meta_description}</p>
              </div>
            )}
            <div
              className="prose prose-sm max-w-none text-foreground"
              dangerouslySetInnerHTML={{ __html: preview?.content || '' }}
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ArticlesPage;
