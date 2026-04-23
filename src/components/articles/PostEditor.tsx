import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Save, CheckCircle2, Eye, Layout, Search, Image as ImageIcon, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface PostEditorProps {
  article: any;
  onSave: (updatedArticle: any) => Promise<void>;
  onApprove: (articleId: string) => Promise<void>;
  isSaving?: boolean;
}

const PostEditor = ({ article, onSave, onApprove, isSaving }: PostEditorProps) => {
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    title: article.title || '',
    content: article.content || '',
    meta_title: article.meta_title || article.title || '',
    meta_description: article.meta_description || '',
    slug: article.slug || '',
    focus_keyword: article.focus_keyword || article.seo_keyword || '',
    featured_image_url: article.featured_image_url || '',
  });

  const [scores, setScores] = useState({
    title: 0,
    description: 0,
    slug: 0,
  });

  useEffect(() => {
    calculateScores();
  }, [formData]);

  const calculateScores = () => {
    const titleLen = formData.meta_title.length;
    const descLen = formData.meta_description.length;
    const slugLen = formData.slug.length;

    setScores({
      title: titleLen >= 40 && titleLen <= 60 ? 100 : (titleLen < 40 ? (titleLen / 40) * 100 : 70),
      description: descLen >= 140 && descLen <= 160 ? 100 : (descLen < 140 ? (descLen / 140) * 100 : 70),
      slug: slugLen > 3 && slugLen < 50 ? 100 : 50,
    });
  };

  const generateSEO = () => {
    const slug = formData.title
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
    
    setFormData(prev => ({
      ...prev,
      meta_title: prev.title.substring(0, 60),
      meta_description: prev.content.replace(/<[^>]*>/g, '').substring(0, 160),
      slug,
      focus_keyword: prev.title.split(' ')[0] || '',
    }));

    toast({ title: 'SEO Gerado', description: 'Campos preenchidos automaticamente.' });
  };

  const handleSave = () => {
    if (!formData.title) {
      toast({ title: 'Erro', description: 'O título é obrigatório.', variant: 'destructive' });
      return;
    }
    onSave({ ...article, ...formData });
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 space-y-6">
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Layout className="h-5 w-5 text-primary" />
              Conteúdo do Post
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Título</Label>
              <Input 
                value={formData.title} 
                onChange={e => setFormData({...formData, title: e.target.value})}
                placeholder="Título do artigo"
              />
            </div>
            <div className="space-y-2">
              <Label>Conteúdo (HTML)</Label>
              <Textarea 
                value={formData.content} 
                onChange={e => setFormData({...formData, content: e.target.value})}
                placeholder="Conteúdo do artigo..."
                className="min-h-[300px] font-mono text-sm"
              />
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <Search className="h-5 w-5 text-primary" />
              SEO & Metadados (Padrão WordPress)
            </CardTitle>
            <Button variant="outline" size="sm" onClick={generateSEO}>
              Gerar Auto
            </Button>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <div className="flex justify-between items-end">
                <Label>SEO Title ({formData.meta_title.length}/60)</Label>
                <Badge variant={scores.title === 100 ? 'success' : 'warning'} className="text-[10px]">
                  {scores.title === 100 ? 'Ideal' : 'Ajustar'}
                </Badge>
              </div>
              <Input 
                value={formData.meta_title} 
                onChange={e => setFormData({...formData, meta_title: e.target.value})}
                maxLength={70}
              />
              <Progress value={scores.title} className="h-1" />
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-end">
                <Label>Meta Description ({formData.meta_description.length}/160)</Label>
                <Badge variant={scores.description === 100 ? 'success' : 'warning'} className="text-[10px]">
                  {scores.description === 100 ? 'Ideal' : 'Ajustar'}
                </Badge>
              </div>
              <Textarea 
                value={formData.meta_description} 
                onChange={e => setFormData({...formData, meta_description: e.target.value})}
                maxLength={160}
                className="h-20"
              />
              <Progress value={scores.description} className="h-1" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Slug (URL)</Label>
                <Input 
                  value={formData.slug} 
                  onChange={e => setFormData({...formData, slug: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <Label>Palavra-Chave Foco</Label>
                <Input 
                  value={formData.focus_keyword} 
                  onChange={e => setFormData({...formData, focus_keyword: e.target.value})}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-6">
        <Card className="glass-card sticky top-6">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <ImageIcon className="h-5 w-5 text-primary" />
              Mídia & Ações
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label>Imagem Destacada (URL)</Label>
              <Input 
                value={formData.featured_image_url} 
                onChange={e => setFormData({...formData, featured_image_url: e.target.value})}
              />
              {formData.featured_image_url && (
                <div className="mt-2 rounded-lg overflow-hidden border border-border aspect-video bg-muted flex items-center justify-center">
                  <img src={formData.featured_image_url} alt="Preview" className="w-full h-full object-cover" />
                </div>
              )}
            </div>

            <div className="pt-4 border-t border-border space-y-3">
              <Button onClick={handleSave} disabled={isSaving} className="w-full gap-2">
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Atualizar Rascunho
              </Button>
              <Button 
                onClick={() => onApprove(article.id)} 
                variant="outline" 
                className={`w-full gap-2 border-primary/50 text-primary hover:bg-primary/10 ${article.is_approved ? 'bg-primary/10' : ''}`}
              >
                <CheckCircle2 className="h-4 w-4" />
                {article.is_approved ? 'Aprovado' : 'Aprovar para Envio'}
              </Button>
            </div>

            <div className="p-3 rounded-lg bg-primary/5 border border-primary/10">
              <div className="flex items-center gap-2 mb-2">
                <Eye className="h-4 w-4 text-primary" />
                <span className="text-xs font-semibold uppercase">Google Preview</span>
              </div>
              <div className="space-y-1">
                <p className="text-[#1a0dab] text-lg leading-tight hover:underline cursor-pointer truncate">
                  {formData.meta_title || 'Título do Artigo'}
                </p>
                <p className="text-[#006621] text-sm truncate">
                  meusite.com.br › {formData.slug || 'slug-do-post'}
                </p>
                <p className="text-[#545454] text-xs line-clamp-2">
                  {formData.meta_description || 'A descrição SEO aparecerá aqui nos resultados de busca...'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default PostEditor;
