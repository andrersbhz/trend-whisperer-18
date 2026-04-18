import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Send, Eye, Trash2, Loader2, FileText, RotateCcw, ImagePlus, Sparkles, Database } from 'lucide-react';
import { getErrorMessage, runBackendMutation, runBackendQuery } from '@/lib/backend';
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
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [regeneratingImages, setRegeneratingImages] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);

  const PAGE_SIZE = 20;

  const fetchArticles = async (options?: { append?: boolean }) => {
    if (!user) return;

    const append = options?.append ?? false;
    const from = append ? articles.length : 0;
    const to = from + PAGE_SIZE - 1;

    try {
      const data = await runBackendQuery(() =>
        supabase
          .from('articles')
          .select('id, title, status, category, seo_keyword, meta_description, featured_image_url')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .range(from, to),
      );

      setHasMore((data || []).length === PAGE_SIZE);
      setArticles((current) => (append ? [...current, ...(data || [])] : data || []));
    } catch (error) {
      console.error('[ArticlesPage] fetchArticles error:', error);
      if (!append) {
        setArticles([]);
      }
      toast({ title: 'Erro ao carregar artigos', description: getErrorMessage(error), variant: 'destructive' });
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    setLoadingMore(false);
    setHasMore(false);
    fetchArticles();
  }, [user]);

  const handleGenerate = async () => {
    if (!user) return;
    setGenerating(true);
    try {
      const data = await runBackendQuery(() =>
        supabase.functions.invoke('generate-articles', {
          body: { userId: user.id },
        }),
      );
      toast({
        title: data?.success ? 'Artigos gerados!' : 'Atenção',
        description: data?.message || data?.error || 'Verifique o resultado.',
        variant: data?.success ? 'default' : 'destructive',
      });
      fetchArticles();
    } catch (error) {
      toast({ title: 'Erro ao gerar artigos', description: getErrorMessage(error), variant: 'destructive' });
    } finally {
      setGenerating(false);
    }
  };

  const handlePublish = async (articleId: string) => {
    setPublishing(articleId);
    try {
      const data = await runBackendQuery(() =>
        supabase.functions.invoke('publish-article', {
          body: { articleId, userId: user?.id },
        }),
      );

      toast({ title: data?.success ? 'Publicado!' : 'Atenção', description: data?.message || 'Verifique o status.', variant: data?.success ? 'default' : 'destructive' });
      fetchArticles();
    } catch (error) {
      toast({ title: 'Erro', description: getErrorMessage(error), variant: 'destructive' });
    } finally {
      setPublishing(null);
    }
  };

  const handleRetry = async (articleId: string) => {
    setRetrying(articleId);
    try {
      await runBackendMutation(() => supabase.from('articles').update({ status: 'ready' }).eq('id', articleId));

      const data = await runBackendQuery(() =>
        supabase.functions.invoke('publish-article', {
          body: { articleId, userId: user?.id },
        }),
      );

      toast({ title: data?.success ? 'Publicado!' : 'Atenção', description: data?.message || 'Verifique o status.', variant: data?.success ? 'default' : 'destructive' });
      fetchArticles();
    } catch (error) {
      toast({ title: 'Erro', description: getErrorMessage(error), variant: 'destructive' });
    } finally {
      setRetrying(null);
    }
  };

  const handleDelete = async (articleId: string) => {
    try {
      await runBackendMutation(() => supabase.from('articles').delete().eq('id', articleId));
      toast({ title: 'Excluído', description: 'Artigo removido.' });
      fetchArticles();
    } catch (error) {
      toast({ title: 'Erro', description: getErrorMessage(error), variant: 'destructive' });
    }
  };

  const handlePreview = async (articleId: string) => {
    setPreviewOpen(true);
    setPreviewLoading(true);

    try {
      const data = await runBackendQuery(() =>
        supabase
          .from('articles')
          .select('id, title, category, seo_keyword, meta_description, content, featured_image_url')
          .eq('id', articleId)
          .maybeSingle(),
      );

      setPreview(data);
    } catch (error) {
      setPreviewOpen(false);
      toast({ title: 'Erro ao carregar prévia', description: getErrorMessage(error), variant: 'destructive' });
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleRegenerateImages = async () => {
    const withoutImage = articles.filter(a => !a.featured_image_url && a.status !== 'generating');
    if (!user || withoutImage.length === 0) return;
    setRegeneratingImages(true);
    try {
      const data = await runBackendQuery(() =>
        supabase.functions.invoke('regenerate-image', {
          body: { userId: user.id, articleIds: withoutImage.map(a => a.id) },
        }),
      );
      const updatedCount = Number(data?.updated ?? 0);
      toast({
        title: updatedCount > 0 ? 'Imagens geradas!' : 'Nenhuma imagem gerada',
        description: data?.message || `${updatedCount} imagens criadas.`,
        variant: updatedCount > 0 ? 'default' : 'destructive',
      });
      fetchArticles();
    } catch (error) {
      toast({ title: 'Erro', description: getErrorMessage(error), variant: 'destructive' });
    } finally {
      setRegeneratingImages(false);
    }
  };

  const statusColors: Record<string, string> = {
    draft: 'bg-muted text-muted-foreground',
    generating: 'bg-warning/20 text-warning',
    ready: 'bg-primary/20 text-primary',
    publishing: 'bg-accent/20 text-accent',
    published: 'bg-primary/20 text-primary',
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
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold neon-text-lilac">Artigos</h1>
          <p className="text-muted-foreground text-sm mt-1">{articles.length} artigos gerados</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button
            onClick={handleGenerate}
            disabled={generating}
            className="gradient-primary gap-2"
          >
            {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {generating ? 'Gerando artigos...' : 'Gerar Artigos'}
          </Button>
          {articles.filter(a => !a.featured_image_url && a.status !== 'generating').length > 0 && (
            <Button
              onClick={handleRegenerateImages}
              disabled={regeneratingImages}
              variant="outline"
              className="gap-2"
            >
              {regeneratingImages ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
              {regeneratingImages ? 'Gerando imagens...' : `Gerar imagens (${articles.filter(a => !a.featured_image_url && a.status !== 'generating').length})`}
            </Button>
          )}
        </div>
      </div>

      {articles.length === 0 ? (
        <Card className="glass-card">
          <CardContent className="py-16 text-center">
            <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">Nenhum artigo encontrado.</p>
            <p className="text-sm text-muted-foreground mt-1">Clique em "Gerar Artigos" acima para começar</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {articles.map((article) => (
            <Card key={article.id} className={`glass-card ${article.status === 'failed' ? 'border-destructive/30' : ''}`}>
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
                    <Button size="sm" variant="ghost" onClick={() => handlePreview(article.id)} className="text-muted-foreground hover:text-foreground">
                      <Eye className="h-4 w-4" />
                    </Button>
                    {article.status === 'failed' && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-warning hover:text-warning hover:bg-warning/10"
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
                        className="text-primary hover:text-primary hover:bg-primary/10"
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
                    <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => handleDelete(article.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {articles.length > 0 && hasMore && (
        <div className="flex justify-center">
          <Button
            variant="outline"
            onClick={() => {
              setLoadingMore(true);
              fetchArticles({ append: true });
            }}
            disabled={loadingMore}
            className="gap-2"
          >
            {loadingMore ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {loadingMore ? 'Carregando...' : 'Carregar mais'}
          </Button>
        </div>
      )}

      <Dialog
        open={previewOpen}
        onOpenChange={(open) => {
          setPreviewOpen(open);
          if (!open) setPreview(null);
        }}
      >
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto glass-card border-border">
          <DialogHeader>
            <DialogTitle className="text-foreground">{previewLoading ? 'Carregando prévia...' : preview?.title}</DialogTitle>
          </DialogHeader>
          {previewLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <div className="space-y-3 text-sm">
              {preview?.featured_image_url && (
                <img src={preview.featured_image_url} alt={preview.title} className="w-full rounded-lg" />
              )}
              <div className="flex gap-2 flex-wrap">
                <Badge variant="secondary" className="bg-primary/10 text-primary">{preview?.category}</Badge>
                {preview?.seo_keyword && <Badge variant="outline" className="border-accent/30 text-accent">🔑 {preview.seo_keyword}</Badge>}
              </div>
              {preview?.meta_description && (
                <div className="p-3 rounded-lg bg-secondary/30">
                  <p className="text-xs font-medium text-muted-foreground mb-1">Meta Description</p>
                  <p className="text-sm text-foreground">{preview?.meta_description}</p>
                </div>
              )}
              <div
                className="prose prose-sm prose-invert max-w-none text-foreground"
                dangerouslySetInnerHTML={{ __html: preview?.content || '' }}
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ArticlesPage;
