import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Save } from 'lucide-react';

interface Props {
  articleId: string | null;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}

const FIELDS = ['title', 'excerpt', 'content', 'category', 'focus_keyword', 'seo_title', 'meta_description'] as const;
type Form = Record<(typeof FIELDS)[number], string>;
const empty: Form = { title: '', excerpt: '', content: '', category: '', focus_keyword: '', seo_title: '', meta_description: '' };

export function EditArticleDialog({ articleId, onOpenChange, onSaved }: Props) {
  const { toast } = useToast();
  const [form, setForm] = useState<Form>(empty);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!articleId) return;
    setLoading(true);
    supabase.from('articles').select(FIELDS.join(',')).eq('id', articleId).maybeSingle().then(({ data, error }) => {
      if (error) toast({ title: 'Erro ao carregar', description: error.message, variant: 'destructive' });
      const d: any = data || {};
      setForm(Object.fromEntries(FIELDS.map((f) => [f, d[f] ?? ''])) as Form);
      setLoading(false);
    });
  }, [articleId]);

  const set = (k: keyof Form) => (e: any) => setForm((s) => ({ ...s, [k]: e.target.value }));

  const save = async () => {
    if (!articleId || !form.title.trim()) return;
    setSaving(true);
    const { error } = await supabase.from('articles').update({
      ...form,
      seo_keyword: form.focus_keyword,
      meta_title: form.seo_title,
      updated_at: new Date().toISOString(),
    }).eq('id', articleId);
    setSaving(false);
    if (error) return toast({ title: 'Erro ao salvar', description: error.message, variant: 'destructive' });
    toast({ title: 'Artigo atualizado' });
    onSaved();
    onOpenChange(false);
  };

  return (
    <Dialog open={!!articleId} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Editar artigo</DialogTitle></DialogHeader>
        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : (
          <div className="space-y-4">
            <div><Label>Título</Label><Input value={form.title} onChange={set('title')} /></div>
            <div className="grid md:grid-cols-2 gap-4">
              <div><Label>Categoria (ex.: world/sports)</Label><Input value={form.category} onChange={set('category')} /></div>
              <div><Label>Palavra-chave SEO</Label><Input value={form.focus_keyword} onChange={set('focus_keyword')} /></div>
            </div>
            <div><Label>Título SEO</Label><Input value={form.seo_title} onChange={set('seo_title')} /></div>
            <div><Label>Meta descrição</Label><Textarea rows={2} value={form.meta_description} onChange={set('meta_description')} /></div>
            <div><Label>Resumo</Label><Textarea rows={3} value={form.excerpt} onChange={set('excerpt')} /></div>
            <div><Label>Conteúdo (HTML)</Label><Textarea rows={16} className="font-mono text-xs" value={form.content} onChange={set('content')} /></div>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={save} disabled={saving || loading}>
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
