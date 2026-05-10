import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Plus } from 'lucide-react';
import { ImageUpload } from './ImageUpload';

interface ManualArticleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: string[];
  onSuccess: () => void;
}

export const ManualArticleDialog = ({ open, onOpenChange, categories, onSuccess }: ManualArticleDialogProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    category: '',
    seo_keyword: '',
    meta_description: '',
    featured_image_url: '',
  });

  const handleSave = async () => {
    if (!user) return;
    
    if (!formData.title || !formData.content || !formData.category) {
      toast({
        title: "Campos obrigatórios",
        description: "Título, conteúdo e categoria são obrigatórios.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.from('articles').insert({
        user_id: user.id,
        title: formData.title,
        content: formData.content,
        category: formData.category,
        seo_keyword: formData.seo_keyword,
        meta_description: formData.meta_description,
        featured_image_url: formData.featured_image_url,
        status: 'ready',
        slug: formData.title.toLowerCase().replace(/ /g, '-').replace(/[^\w-]+/g, ''),
      });

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Artigo criado manualmente com sucesso!",
      });
      
      onSuccess();
      onOpenChange(false);
      setFormData({
        title: '',
        content: '',
        category: '',
        seo_keyword: '',
        meta_description: '',
        featured_image_url: '',
      });
    } catch (error: any) {
      toast({
        title: "Erro ao criar artigo",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Adicionar Artigo Manualmente</DialogTitle>
        </DialogHeader>
        
        <div className="grid gap-6 py-4">
          <div className="grid gap-2">
            <Label htmlFor="title">Título do Artigo</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="Ex: As tendências do mercado de tecnologia em 2024"
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="content">Conteúdo (HTML ou Texto)</Label>
            <Textarea
              id="content"
              value={formData.content}
              onChange={(e) => setFormData({ ...formData, content: e.target.value })}
              placeholder="Escreva ou cole o conteúdo do artigo aqui..."
              className="min-h-[200px]"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="category">Categoria</Label>
              <Select
                value={formData.category}
                onValueChange={(value) => setFormData({ ...formData, category: value })}
              >
                <SelectTrigger id="category">
                  <SelectValue placeholder="Selecione uma categoria" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat.charAt(0).toUpperCase() + cat.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="grid gap-2">
              <Label htmlFor="seo_keyword">Palavra-chave em Foco</Label>
              <Input
                id="seo_keyword"
                value={formData.seo_keyword}
                onChange={(e) => setFormData({ ...formData, seo_keyword: e.target.value })}
                placeholder="Ex: tecnologia, 2024, tendências"
              />
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="meta_description">Meta Descrição</Label>
            <Textarea
              id="meta_description"
              value={formData.meta_description}
              onChange={(e) => setFormData({ ...formData, meta_description: e.target.value })}
              placeholder="Resumo para motores de busca..."
              rows={3}
            />
          </div>

          <div className="grid gap-2">
            <Label>Imagem Destacada</Label>
            <ImageUpload
              articleId="new" // Temporal ID for manual creation if needed, though ImageUpload usually expects existing article
              currentImageUrl={formData.featured_image_url}
              onUploadSuccess={(url) => setFormData({ ...formData, featured_image_url: url })}
            />
            <p className="text-[10px] text-muted-foreground italic">
              * Você pode fazer upload ou colar uma URL de imagem.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={loading} className="gap-2">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Criar Artigo
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
