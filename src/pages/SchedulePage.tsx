import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, Clock, Calendar, Save, Bot, Trash2, CheckCircle, XCircle, Trash, Eye, FileEdit, Send, Image as ImageIcon, ImagePlus, ChevronDown } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';
import { getErrorMessage, runBackendMutation, runBackendQuery } from '@/lib/backend';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ImageUpload } from '@/components/articles/ImageUpload';

const SchedulePage = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [articles, setArticles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [articlesPerDay, setArticlesPerDay] = useState(10);
  const [autoPublish, setAutoPublish] = useState(false);
  const [savingAuto, setSavingAuto] = useState(false);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [batchActionLoading, setBatchActionLoading] = useState(false);
  const [preview, setPreview] = useState<any | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [userCategories, setUserCategories] = useState<string[]>([]);

  useEffect(() => {
    if (!user) return;

    const fetchData = async () => {
      try {
        const [data, settings] = await Promise.all([
          runBackendQuery(() =>
            supabase
              .from('articles')
              .select('id, title, category, scheduled_at, status, is_approved, featured_image_url')
              .eq('user_id', user.id)
              .not('scheduled_at', 'is', null)
              .order('scheduled_at', { ascending: true }),
          ),
          runBackendQuery(() =>
            supabase
              .from('user_settings')
              .select('articles_per_day, auto_publish')
              .eq('user_id', user.id)
              .maybeSingle(),
          ),
        ]);

        const sorted = (data || []).sort((a: any, b: any) => {
          const aPub = a.status === 'published';
          const bPub = b.status === 'published';
          if (aPub !== bPub) return aPub ? 1 : -1;
          return new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime();
        });
        setArticles(sorted);
        if (settings?.articles_per_day) setArticlesPerDay(settings.articles_per_day);
        if (settings?.auto_publish !== null && settings?.auto_publish !== undefined) {
          setAutoPublish(settings.auto_publish);
        }
        setSettingsLoaded(true);
      } catch (error) {
        setArticles([]);
        toast({ title: 'Erro ao carregar agendamentos', description: getErrorMessage(error), variant: 'destructive' });
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    fetchCategories();
  }, [toast, user]);

  const fetchCategories = async () => {
    if (!user) return;
    try {
      const { data } = await supabase.from('user_settings').select('categories').eq('user_id', user.id).maybeSingle();
      setUserCategories(data?.categories || ['esportes', 'politica', 'policia', 'saude', 'celebridades', 'financas']);
    } catch (e) {
      console.error('Error fetching categories', e);
    }
  };

  const handleUpdateCategory = async (articleId: string, newCategory: string) => {
    try {
      const { error } = await supabase
        .from('articles')
        .update({ category: newCategory })
        .eq('id', articleId);

      if (error) throw error;

      setArticles(prev => prev.map(a => a.id === articleId ? { ...a, category: newCategory } : a));
      if (preview?.id === articleId) {
        setPreview(prev => ({ ...prev, category: newCategory }));
      }
      toast({ title: 'Categoria atualizada', description: `Artigo movido para ${newCategory}` });
    } catch (error) {
      toast({ title: 'Erro ao atualizar categoria', description: getErrorMessage(error), variant: 'destructive' });
    }
  };

  const handleSaveAutomation = async () => {
    if (!user) return;
    setSavingAuto(true);
    try {
      await runBackendMutation(() =>
        supabase
          .from('user_settings')
          .upsert({ 
            user_id: user.id, 
            articles_per_day: articlesPerDay, 
            auto_publish: autoPublish 
          } as any, { onConflict: 'user_id' }),
      );
      toast({ title: 'Automação salva!', description: `${articlesPerDay} artigos/dia. Publicação automática: ${autoPublish ? 'Ativada' : 'Desativada'}.` });
    } catch (error) {
      toast({ title: 'Erro', description: getErrorMessage(error), variant: 'destructive' });
    } finally {
      setSavingAuto(false);
    }
  };

  const handleEdit = (article: any) => {
    setEditingId(article.id);
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

  const handleDelete = async (articleId: string) => {
    if (!window.confirm('Tem certeza que deseja excluir este agendamento?')) return;
    try {
      await runBackendMutation(() =>
        supabase.from('articles').delete().eq('id', articleId),
      );
      setArticles(prev => prev.filter(a => a.id !== articleId));
      
      await supabase.from('audit_logs').insert({
        user_id: user?.id,
        action: 'delete_article',
        details: { article_id: articleId }
      });

      toast({ title: 'Agendamento excluído!' });
    } catch (error) {
      toast({ title: 'Erro ao excluir', description: getErrorMessage(error), variant: 'destructive' });
    }
  };

  const handleToggleApproval = async (articleId: string, currentApproved: boolean) => {
    try {
      const newApproved = !currentApproved;
      await runBackendMutation(() =>
        supabase.from('articles').update({ is_approved: newApproved }).eq('id', articleId),
      );
      setArticles(prev => prev.map(a => a.id === articleId ? { ...a, is_approved: newApproved } : a));
      
      await supabase.from('audit_logs').insert({
        user_id: user?.id,
        action: newApproved ? 'approve_article' : 'unapprove_article',
        details: { article_id: articleId }
      });

      toast({ 
        title: newApproved ? 'Artigo aprovado!' : 'Artigo pausado', 
        description: newApproved ? 'Ele será postado no horário agendado.' : 'Ele não será postado automaticamente.' 
      });
    } catch (error) {
      toast({ title: 'Erro', description: getErrorMessage(error), variant: 'destructive' });
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(articles.map(a => a.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelectOne = (articleId: string, checked: boolean) => {
    if (checked) {
      setSelectedIds(prev => [...prev, articleId]);
    } else {
      setSelectedIds(prev => prev.filter(id => id !== articleId));
    }
  };

  const handleBatchDelete = async () => {
    if (!selectedIds.length) return;
    if (!window.confirm(`Tem certeza que deseja excluir ${selectedIds.length} agendamentos?`)) return;
    
    setBatchActionLoading(true);
    try {
      await runBackendMutation(() =>
        supabase.from('articles').delete().in('id', selectedIds),
      );
      setArticles(prev => prev.filter(a => !selectedIds.includes(a.id)));
      
      await supabase.from('audit_logs').insert({
        user_id: user?.id,
        action: 'delete_multiple_articles',
        details: { article_ids: selectedIds }
      });

      toast({ title: `${selectedIds.length} agendamentos excluídos!` });
      setSelectedIds([]);
    } catch (error) {
      toast({ title: 'Erro ao excluir em lote', description: getErrorMessage(error), variant: 'destructive' });
    } finally {
      setBatchActionLoading(false);
    }
  };

  const handleBatchApproval = async (newApproved: boolean) => {
    if (!selectedIds.length) return;
    
    setBatchActionLoading(true);
    try {
      await runBackendMutation(() =>
        supabase.from('articles').update({ is_approved: newApproved }).in('id', selectedIds),
      );
      setArticles(prev => prev.map(a => selectedIds.includes(a.id) ? { ...a, is_approved: newApproved } : a));
      
      await supabase.from('audit_logs').insert({
        user_id: user?.id,
        action: newApproved ? 'approve_multiple_articles' : 'unapprove_multiple_articles',
        details: { article_ids: selectedIds }
      });

      toast({ title: `${selectedIds.length} artigos ${newApproved ? 'aprovados' : 'pausados'}!` });
      setSelectedIds([]);
    } catch (error) {
      toast({ title: 'Erro ao atualizar em lote', description: getErrorMessage(error), variant: 'destructive' });
    } finally {
      setBatchActionLoading(false);
    }
  };

  const handlePreview = async (articleId: string) => {
    setPreviewOpen(true);
    setPreviewLoading(true);

    try {
      const { data, error } = await supabase
        .from('articles')
        .select('*')
        .eq('id', articleId)
        .maybeSingle();

      if (error) throw error;
      setPreview(data);
    } catch (error) {
      setPreviewOpen(false);
      toast({ title: 'Erro ao carregar prévia', description: getErrorMessage(error), variant: 'destructive' });
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleUpdateArticle = async (articleId: string, updates: any) => {
    try {
      setPreviewLoading(true);
      const { error } = await supabase.from('articles').update(updates).eq('id', articleId);
      if (error) throw error;
      
      setArticles(prev => prev.map(a => a.id === articleId ? { ...a, ...updates } : a));
      setPreview(prev => ({ ...prev, ...updates }));
      toast({ title: 'Artigo atualizado!' });
    } catch (error) {
      toast({ title: 'Erro ao atualizar', description: getErrorMessage(error), variant: 'destructive' });
    } finally {
      setPreviewLoading(false);
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
        <p className="text-sm mt-1">Artigos agendados para publicação automática — clique na data para editar</p>
      </div>

      <Card className="glass-card neon-border-pink">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Bot className="h-5 w-5 text-accent" />
            <CardTitle className="text-lg text-foreground">Robô de Publicação Automática</CardTitle>
          </div>
          <p className="text-sm text-muted-foreground">
            Configure quantas postagens o robô deve fazer por dia e se deve publicar automaticamente no WordPress.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="articles-per-day">Postagens por dia</Label>
              <Input
                id="articles-per-day"
                type="number"
                min={1}
                max={50}
                value={articlesPerDay}
                onChange={(e) => setArticlesPerDay(parseInt(e.target.value) || 10)}
                disabled={!settingsLoaded}
              />
              <p className="text-xs text-muted-foreground">Quantidade de artigos gerados a cada ciclo (máx. 50)</p>
            </div>
            <div className="flex items-center justify-between p-[25px] rounded-lg bg-muted/50 h-fit mt-auto">
              <div>
                <p className="text-sm font-medium text-foreground">Publicação automática</p>
                <p className="text-xs text-muted-foreground">Publicar no WordPress automaticamente</p>
              </div>
              <Switch
                checked={autoPublish}
                onCheckedChange={setAutoPublish}
                disabled={!settingsLoaded}
              />
            </div>
          </div>
          <Button
            onClick={handleSaveAutomation}
            disabled={savingAuto || !settingsLoaded}
            className="gradient-primary w-full sm:w-auto"
          >
            {savingAuto ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            Salvar Automação
          </Button>
        </CardContent>
      </Card>

      {articles.length === 0 ? (
        <Card className="shadow-card">
          <CardContent className="py-16 text-center">
            <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">Nenhum agendamento.</p>
            <p className="text-sm text-muted-foreground mt-1">Artigos gerados serão agendados automaticamente</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4 bg-muted/30 p-4 rounded-lg border border-border">
            <div className="flex items-center gap-3">
              <Checkbox 
                id="select-all" 
                checked={selectedIds.length === articles.length && articles.length > 0}
                onCheckedChange={(checked) => handleSelectAll(!!checked)}
              />
              <Label htmlFor="select-all" className="text-sm font-medium cursor-pointer">
                Selecionar todos ({articles.length})
              </Label>
            </div>
            
            {selectedIds.length > 0 && (
              <div className="flex items-center gap-2 animate-in fade-in slide-in-from-right-2">
                <span className="text-xs text-muted-foreground mr-2">
                  {selectedIds.length} selecionado{selectedIds.length > 1 ? 's' : ''}
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 px-3 text-success hover:text-success/80"
                  onClick={() => handleBatchApproval(true)}
                  disabled={batchActionLoading}
                >
                  {batchActionLoading ? <Loader2 className="h-3 w-3 mr-2 animate-spin" /> : <CheckCircle className="h-3 w-3 mr-2" />}
                  Postar
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 px-3 text-muted-foreground hover:text-foreground"
                  onClick={() => handleBatchApproval(false)}
                  disabled={batchActionLoading}
                >
                  {batchActionLoading ? <Loader2 className="h-3 w-3 mr-2 animate-spin" /> : <XCircle className="h-3 w-3 mr-2" />}
                  Pausar
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 px-3 text-destructive hover:text-destructive/80"
                  onClick={handleBatchDelete}
                  disabled={batchActionLoading}
                >
                  {batchActionLoading ? <Loader2 className="h-3 w-3 mr-2 animate-spin" /> : <Trash className="h-3 w-3 mr-2" />}
                  Excluir
                </Button>
              </div>
            )}
          </div>

          <div className="grid gap-3">
            {articles.map((article) => (
              <Card key={article.id} className={`shadow-card transition-colors ${selectedIds.includes(article.id) ? 'bg-primary/5 ring-1 ring-primary/20' : ''}`}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <Checkbox 
                      checked={selectedIds.includes(article.id)}
                      onCheckedChange={(checked) => handleSelectOne(article.id, !!checked)}
                    />
                    <div className="min-w-0 flex-1 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div 
                          className="relative w-12 h-12 shrink-0 bg-secondary/40 rounded overflow-hidden hidden sm:flex items-center justify-center group cursor-pointer"
                          onClick={() => handlePreview(article.id)}
                        >
                          {article.featured_image_url ? (
                            <img
                              key={article.featured_image_url}
                              src={article.featured_image_url}
                              alt=""
                              className="absolute inset-0 w-full h-full object-cover transition-transform group-hover:scale-110"
                            />
                          ) : (
                            <ImageIcon className="h-4 w-4 text-muted-foreground/40" />
                          )}
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <ImagePlus className="h-4 w-4 text-white" />
                          </div>
                        </div>
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
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 px-2 text-primary hover:text-primary/80"
                          onClick={() => handlePreview(article.id)}
                          title="Upload de Imagem"
                        >
                          <ImageIcon className="h-4 w-4" />
                          <span className="ml-1 text-[10px] hidden sm:inline">Upload</span>
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 px-2 text-primary hover:text-primary/80"
                          onClick={() => handlePreview(article.id)}
                          title="Visualizar e Editar Artigo"
                        >
                          <Eye className="h-4 w-4" />
                          <span className="ml-1 text-[10px] hidden sm:inline">Visualizar</span>
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className={`h-8 px-2 ${article.is_approved ? 'text-success hover:text-success/80' : 'text-muted-foreground hover:text-foreground'}`}
                          onClick={() => handleToggleApproval(article.id, !!article.is_approved)}
                          title={article.is_approved ? 'Clique para não postar' : 'Clique para postar'}
                        >
                          {article.is_approved ? <CheckCircle className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                          <span className="ml-1 text-[10px] hidden sm:inline">{article.is_approved ? 'Postar' : 'Não Postar'}</span>
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 px-2 text-destructive hover:text-destructive/80"
                          onClick={() => handleDelete(article.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                        <Badge
                          className={
                            article.status === 'published'
                              ? 'bg-success/20 text-success'
                              : article.is_approved === false
                                ? 'bg-muted text-muted-foreground'
                                : 'bg-primary/20 text-primary'
                          }
                          variant="secondary"
                        >
                          {article.status === 'published' ? 'Publicado' : article.is_approved === false ? 'Pausado' : 'Agendado'}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
      <Dialog
        open={previewOpen}
        onOpenChange={(open) => {
          setPreviewOpen(open);
          if (!open) setPreview(null);
        }}
      >
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto glass-card border-border p-0">
          <div className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b p-4 flex items-center justify-between">
            <DialogHeader className="p-0">
              <DialogTitle className="text-lg font-bold">Editar Agendamento</DialogTitle>
            </DialogHeader>
            <Button 
              onClick={() => handleUpdateArticle(preview.id, { 
                title: preview.title, 
                content: preview.content,
                meta_description: preview.meta_description,
                seo_keyword: preview.seo_keyword
              })}
              disabled={previewLoading}
              className="gradient-primary"
            >
              {previewLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
              Salvar Alterações
            </Button>
          </div>
          
          {previewLoading && !preview ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-10 w-10 animate-spin text-primary" />
            </div>
          ) : (
            <div className="p-6 space-y-6">
              <div className="space-y-4">
                <Label className="text-xs font-bold uppercase text-muted-foreground block">Imagem de Destaque</Label>
                <ImageUpload 
                  articleId={preview?.id} 
                  currentImageUrl={preview?.featured_image_url} 
                  onUploadSuccess={(url) => {
                    setPreview(prev => ({ ...prev, featured_image_url: url }));
                    setArticles(prev => prev.map(a => a.id === preview.id ? { ...a, featured_image_url: url } : a));
                  }}
                />
              </div>
              <div className="space-y-4">
                <div>
                  <Label className="text-xs font-bold uppercase text-muted-foreground mb-1 block">Título</Label>
                  <Input 
                    value={preview?.title || ''} 
                    onChange={(e) => setPreview({...preview, title: e.target.value})}
                  />
                </div>
                
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs font-bold uppercase text-muted-foreground mb-1 block">Palavra-Chave Foco</Label>
                    <Input 
                      value={preview?.seo_keyword || ''} 
                      onChange={(e) => setPreview({...preview, seo_keyword: e.target.value})}
                    />
                  </div>
                  <div>
                    <Label className="text-xs font-bold uppercase text-muted-foreground mb-1 block">Categoria</Label>
                    <Badge variant="outline" className="h-10 px-4 w-full justify-start capitalize">
                      {preview?.category}
                    </Badge>
                  </div>
                </div>

                <div>
                  <Label className="text-xs font-bold uppercase text-muted-foreground mb-1 block">Meta Descrição</Label>
                  <textarea 
                    className="w-full min-h-[80px] rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm"
                    value={preview?.meta_description || ''} 
                    onChange={(e) => setPreview({...preview, meta_description: e.target.value})}
                  />
                </div>

                <div>
                  <Label className="text-xs font-bold uppercase text-muted-foreground mb-1 block">Conteúdo (HTML)</Label>
                  <textarea 
                    className="w-full min-h-[300px] rounded-md border border-input bg-background px-3 py-2 text-sm font-mono shadow-sm"
                    value={preview?.content || ''} 
                    onChange={(e) => setPreview({...preview, content: e.target.value})}
                  />
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SchedulePage;
