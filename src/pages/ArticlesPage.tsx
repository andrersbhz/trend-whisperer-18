import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Send, Eye, Trash2, Loader2, FileText, RotateCcw, ImagePlus, Sparkles, Database, Layers } from 'lucide-react';
import { getErrorMessage, runBackendMutation, runBackendQuery } from '@/lib/backend';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

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
  const [totalCount, setTotalCount] = useState<number>(0);
  const [cleaningUp, setCleaningUp] = useState(false);
  const [userCategories, setUserCategories] = useState<string[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(false);
  const [errorState, setErrorState] = useState<string | null>(null);

  const PAGE_SIZE = 20;

  const fetchArticles = async (options?: { append?: boolean }) => {
    if (!user) return;

    const append = options?.append ?? false;
    const from = append ? articles.length : 0;
    const to = from + PAGE_SIZE - 1;

    try {
      setErrorState(null);
      
      // Parallelize article fetch and total count for speed
      const [articlesResult, countResult] = await Promise.all([
        supabase
          .from('articles')
          .select('id, title, status, category, seo_keyword, meta_description, featured_image_url')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .range(from, to),
        supabase
          .from('articles')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', user.id)
      ]);

      if (articlesResult.error) throw articlesResult.error;

      const data = articlesResult.data;
      setHasMore((data || []).length === PAGE_SIZE);
      setArticles((current) => (append ? [...current, ...(data || [])] : data || []));
      setTotalCount(countResult.count ?? 0);
    } catch (error: any) {
      console.error('[ArticlesPage] fetchArticles error:', error);
      setErrorState(getErrorMessage(error));
      toast({ title: 'Erro ao carregar artigos', description: getErrorMessage(error), variant: 'destructive' });
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    if (user) {
      setLoading(true);
      // Fetch everything in parallel
      Promise.all([fetchArticles(), fetchCategories()]);
    }
  }, [user]);

  const fetchCategories = async () => {
    if (!user) return;
    setLoadingCategories(true);
    try {
      const { data } = await supabase.from('user_settings').select('categories').eq('user_id', user.id).maybeSingle();
      setUserCategories(data?.categories || ['esportes', 'politica', 'policia', 'saude', 'celebridades', 'financas']);
    } catch (e) {
      console.error('Error fetching categories', e);
    } finally {
      setLoadingCategories(false);
    }
  };

  const handleGenerateByCategory = async (category: string) => {
    if (!user) return;
    setGenerating(true);
    try {
      // First update trends before generating, as requested
      await supabase.functions.invoke('fetch-trends', {
        body: { userId: user.id },
      });

      const { data, error } = await supabase.functions.invoke('generate-articles', {
        body: { userId: user.id, forceCategory: category },
      });
      if (error) throw error;
      toast({
        title: data?.success ? 'Artigo sendo gerado!' : 'Atenção',
        description: `Iniciada geração para a categoria: ${category}. ${data?.message || ''}`,
        variant: data?.success ? 'default' : 'destructive',
      });
      fetchArticles();
    } catch (error) {
      toast({ title: 'Erro ao gerar', description: getErrorMessage(error), variant: 'destructive' });
    } finally {
      setGenerating(false);
    }
  };

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
    if (!confirm('Tem certeza que deseja excluir este artigo?')) return;
    
    // Optimistic update for immediate speed
    const previousArticles = [...articles];
    setArticles(prev => prev.filter(a => a.id !== articleId));
    setTotalCount(prev => Math.max(0, prev - 1));

    try {
      const { error } = await supabase.from('articles').delete().eq('id', articleId);
      if (error) throw error;
      toast({ title: 'Excluído', description: 'Artigo removido.' });
    } catch (error) {
      // Rollback on error
      setArticles(previousArticles);
      setTotalCount(previousArticles.length);
      console.error('[ArticlesPage] Error deleting article:', error);
      toast({ title: 'Erro ao excluir', description: getErrorMessage(error), variant: 'destructive' });
    }
  };

  const handlePreview = async (articleId: string) => {
    setPreviewOpen(true);
    setPreviewLoading(true);

    try {
      const data = await runBackendQuery(() =>
        supabase
          .from('articles')
          .select('id, title, category, seo_keyword, meta_description, content, featured_image_url, slug, seo_title, status')
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

  const handleCleanupOld = async () => {
    if (!user) return;
    if (!confirm('Apagar TODOS os artigos com mais de 3 dias? Esta ação não pode ser desfeita.')) return;
    setCleaningUp(true);
    try {
      const data = await runBackendQuery(() =>
        supabase.functions.invoke('cleanup-old-articles', {
          body: { userId: user.id },
        }),
      );
      const deleted = Number(data?.deleted ?? 0);
      toast({
        title: deleted > 0 ? 'Limpeza concluída' : 'Nada para apagar',
        description: data?.message || `${deleted} artigos removidos.`,
      });
      fetchArticles();
    } catch (error) {
      toast({ title: 'Erro', description: getErrorMessage(error), variant: 'destructive' });
    } finally {
      setCleaningUp(false);
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
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Carregando seus artigos...</p>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={() => fetchArticles()} className="text-xs">
            Tentar carregar novamente
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setLoading(false)} className="text-xs">
            Pular carregamento
          </Button>
        </div>
      </div>
    );
  }

  if (errorState) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <div className="text-destructive font-medium">Erro ao carregar dados</div>
        <p className="text-sm text-muted-foreground">{errorState}</p>
        <Button onClick={() => fetchArticles()} variant="outline">
          Tentar Novamente
        </Button>
      </div>
    );
  }

  const ArticleCard = ({ article, idx }: { article: any, idx: number }) => (
    <Card
      key={article.id}
      className={`glass-card hover-lift overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-300 ${article.status === 'failed' ? 'border-destructive/30' : ''}`}
      style={{ animationDelay: `${Math.min(idx, 5) * 50}ms` }}
    >
      <CardContent className="p-0">
        <div className="flex items-stretch min-h-[80px]">
          <div className="relative w-20 sm:w-28 shrink-0 bg-secondary/40 overflow-hidden">
            {article.featured_image_url ? (
              <img
                src={article.featured_image_url}
                alt={article.title}
                className="absolute inset-0 w-full h-full object-cover transition-opacity duration-300 opacity-0"
                onLoad={(e) => (e.currentTarget.style.opacity = "1")}
                loading="lazy"
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-primary/10 to-accent/10">
                <FileText className="h-6 w-6 text-muted-foreground/60" />
              </div>
            )}
          </div>

          <div className="flex-1 min-w-0 p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                <Badge className={`${statusColors[article.status] || ''} text-[10px] sm:text-xs font-bold`} variant="secondary">
                  {statusLabels[article.status] || article.status}
                </Badge>
                {article.status === 'published' && (
                  <Badge variant="outline" className="text-[10px] sm:text-xs bg-success/10 text-success border-success/30 font-bold">
                    WP: ✅ | FB: ✅ | IG: ✅
                  </Badge>
                )}
                <span className="text-[10px] sm:text-xs text-muted-foreground capitalize">{article.category}</span>
              </div>
              <h3 className="font-semibold text-foreground text-sm sm:text-base line-clamp-2 sm:truncate leading-snug">{article.title}</h3>
              {article.seo_keyword && (
                <p className="text-[11px] sm:text-xs text-muted-foreground mt-1 truncate">
                  🔑 <span className="text-primary">{article.seo_keyword}</span>
                </p>
              )}
            </div>

            <div className="flex gap-1.5 shrink-0 self-end sm:self-auto items-center">
              <Button 
                size="sm" 
                variant="outline" 
                onClick={() => handlePreview(article.id)} 
                className="h-8 gap-2 text-xs font-semibold border-primary/30 text-primary hover:bg-primary/10 shadow-sm"
              >
                <Eye className="h-3.5 w-3.5" />
                Revisar
              </Button>
              {article.status === 'failed' && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 w-8 p-0 text-warning hover:text-warning hover:bg-warning/10 transition-colors"
                  onClick={() => handleRetry(article.id)}
                  disabled={retrying === article.id}
                  title="Tentar novamente"
                >
                  {retrying === article.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
                </Button>
              )}
              {(article.status === 'ready' || article.status === 'draft') && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 w-8 p-0 text-primary hover:text-primary hover:bg-primary/10 transition-colors"
                  onClick={() => handlePublish(article.id)}
                  disabled={publishing === article.id}
                  title="Publicar agora"
                >
                  {publishing === article.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </Button>
              )}
              <Button 
                size="sm" 
                variant="ghost" 
                className="h-8 w-8 p-0 text-destructive/70 hover:text-destructive hover:bg-destructive/10 transition-colors" 
                onClick={() => handleDelete(article.id)} 
                title="Excluir"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold neon-text-lilac">Artigos</h1>
          <p className="text-muted-foreground text-sm mt-1">
            <span className="tabular-nums">{articles.length}</span> carregados de{' '}
            <span className="tabular-nums text-foreground font-medium">{totalCount}</span> no banco
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button
            onClick={handleCleanupOld}
            disabled={cleaningUp}
            variant="outline"
            size="sm"
            className="gap-2 border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
            title="Apagar artigos com mais de 3 dias"
          >
            {cleaningUp ? <Loader2 className="h-4 w-4 animate-spin" /> : <Database className="h-4 w-4" />}
            <span className="hidden sm:inline">Apagar antigos</span>
            <span className="sm:hidden">Limpar</span>
          </Button>
          {articles.filter(a => !a.featured_image_url && a.status !== 'generating').length > 0 && (
            <Button
              onClick={handleRegenerateImages}
              disabled={regeneratingImages}
              variant="outline"
              size="sm"
              className="gap-2"
            >
              {regeneratingImages ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
              <span className="hidden sm:inline">{regeneratingImages ? 'Gerando...' : `Gerar imagens (${articles.filter(a => !a.featured_image_url && a.status !== 'generating').length})`}</span>
              <span className="sm:hidden">Imgs</span>
            </Button>
          )}
          <Button
            onClick={handleGenerate}
            disabled={generating}
            className="gradient-primary gap-2 shadow-neon-lilac hover:scale-[1.02] transition-transform"
          >
            {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {generating ? 'Gerando...' : 'Gerar Artigos'}
          </Button>
        </div>
      </div>

      <Tabs defaultValue="prontos" className="w-full">
        <TabsList className="mb-6 grid w-full max-w-md grid-cols-3 bg-secondary/50 p-1">
          <TabsTrigger value="prontos" className="data-[state=active]:bg-background data-[state=active]:shadow-sm">Posts Prontos</TabsTrigger>
          <TabsTrigger value="todos" className="data-[state=active]:bg-background data-[state=active]:shadow-sm">Todos</TabsTrigger>
          <TabsTrigger value="categorias" className="data-[state=active]:bg-background data-[state=active]:shadow-sm">Categorias</TabsTrigger>
        </TabsList>

        <TabsContent value="todos">
          {articles.length === 0 ? (
            <Card className="glass-card">
              <CardContent className="py-16 text-center">
                <div className="mx-auto w-16 h-16 rounded-full gradient-primary/20 flex items-center justify-center mb-4 bg-primary/10">
                  <FileText className="h-8 w-8 text-primary" />
                </div>
                <p className="text-foreground font-medium">Nenhum artigo encontrado</p>
                <p className="text-sm text-muted-foreground mt-1">Clique em "Gerar Artigos" acima para começar</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-3 sm:gap-4">
              {articles.map((article, idx) => (
                <ArticleCard key={article.id} article={article} idx={idx} />
              ))}
              {articles.length > 0 && hasMore && (
                <div className="flex justify-center mt-4">
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
            </div>
          )}
        </TabsContent>

        <TabsContent value="prontos">
          {articles.filter(a => a.status === 'ready').length === 0 ? (
            <Card className="glass-card">
              <CardContent className="py-16 text-center">
                <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-foreground font-medium">Nenhum artigo pronto para publicar</p>
                <p className="text-sm text-muted-foreground mt-1">Gere novos artigos ou aprove os rascunhos</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {articles.filter(a => a.status === 'ready').map((article, idx) => (
                <ArticleCard key={article.id} article={article} idx={idx} />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="categorias">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {userCategories.map((category) => (
              <Card key={category} className="glass-card hover-lift">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <Layers className="h-5 w-5 text-primary" />
                      <h3 className="font-bold capitalize">{category}</h3>
                    </div>
                    <Badge variant="outline">{articles.filter(a => a.category === category).length} posts</Badge>
                  </div>
                  <Button 
                    className="w-full gradient-primary" 
                    onClick={() => handleGenerateByCategory(category)}
                    disabled={generating}
                  >
                    {generating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
                    Gerar para {category}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      <Dialog
        open={previewOpen}
        onOpenChange={(open) => {
          setPreviewOpen(open);
          if (!open) setPreview(null);
        }}
      >
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto glass-card border-border p-0">
          <div className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b p-4 flex items-center justify-between">
            <DialogHeader className="p-0">
              <DialogTitle className="text-lg font-bold">Revisão do Artigo</DialogTitle>
            </DialogHeader>
            {(preview?.status === 'ready' || preview?.status === 'draft') && (
              <div className="flex flex-col items-end gap-1">
                <Button 
                  onClick={() => {
                    handlePublish(preview.id);
                    setPreviewOpen(false);
                  }}
                  disabled={publishing === preview.id}
                  className="gradient-primary shadow-neon-lilac"
                >
                  {publishing === preview.id ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
                  Confirmar e Publicar Agora
                </Button>
                <div className="flex items-center gap-1.5 mt-1">
                  <Badge variant="outline" className="text-[10px] bg-success/10 text-success border-success/30 font-bold px-1.5 py-0 h-4">
                    WP: ✅ | FB: ✅ | IG: ✅
                  </Badge>
                  <p className="text-[10px] text-muted-foreground italic">Envia para todas as redes conectadas</p>
                </div>
              </div>
            )}
          </div>
          
          {previewLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-10 w-10 animate-spin text-primary" />
            </div>
          ) : (
            <div className="p-6 space-y-6">
              {/* Top Section: Title & Image */}
              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1 block">Título do Post</label>
                    <h2 className="text-xl font-bold leading-tight">{preview?.title}</h2>
                  </div>
                  
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1 block">Slug (URL)</label>
                    <code className="text-xs bg-secondary/50 px-2 py-1 rounded block truncate border border-border/50">
                      /{preview?.slug || preview?.seo_keyword?.toLowerCase().replace(/[^a-z0-9]+/g, '-')}
                    </code>
                  </div>

                  <div className="flex gap-2 flex-wrap">
                    <Badge variant="secondary" className="bg-primary/10 text-primary capitalize">{preview?.category}</Badge>
                    {preview?.status && (
                      <Badge className={`${statusColors[preview.status]} border-none`}>
                        {statusLabels[preview.status]}
                      </Badge>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1 block">Imagem Destacada</label>
                  {preview?.featured_image_url ? (
                    <div className="relative aspect-video rounded-lg overflow-hidden border shadow-sm">
                      <img src={preview.featured_image_url} alt={preview.title} className="w-full h-full object-cover" />
                    </div>
                  ) : (
                    <div className="aspect-video rounded-lg bg-secondary/30 flex items-center justify-center border border-dashed">
                      <ImagePlus className="h-8 w-8 text-muted-foreground/40" />
                    </div>
                  )}
                </div>
              </div>

              {/* SEO Details */}
              <div className="grid md:grid-cols-2 gap-4">
                <Card className="bg-secondary/20 border-border/50">
                  <CardContent className="p-4">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2 block">Otimização SEO</label>
                    <div className="space-y-3">
                      <div>
                        <p className="text-[11px] font-medium text-muted-foreground">Palavra-Chave Foco</p>
                        <p className="text-sm font-semibold text-primary">🔑 {preview?.seo_keyword || 'Não definida'}</p>
                      </div>
                      <div>
                        <p className="text-[11px] font-medium text-muted-foreground">SEO Title</p>
                        <p className="text-sm line-clamp-1">{preview?.seo_title || preview?.title}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-secondary/20 border-border/50">
                  <CardContent className="p-4">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2 block">Meta Descrição</label>
                    <p className="text-xs text-foreground leading-relaxed italic">
                      {preview?.meta_description || 'Nenhuma descrição gerada.'}
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Content Preview */}
              <div className="space-y-3 border-t pt-6">
                <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2 block">Conteúdo do Artigo</label>
                <div
                  className="prose prose-sm prose-invert max-w-none text-foreground bg-card/30 p-4 rounded-lg border border-border/50"
                  dangerouslySetInnerHTML={{ __html: preview?.content || '' }}
                />
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ArticlesPage;
