import { useState } from 'react';
import { Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { AI_IMAGE_FORMATS, type AIImageFormat } from '../../../supabase/functions/_shared/image-formats';
export { type AIImageFormat } from '../../../supabase/functions/_shared/image-formats';

const mainFormats: AIImageFormat[] = ['instagram_square', 'instagram_portrait', 'landscape', 'instagram_story', 'facebook_post', 'linkedin_post'];
export function AIImageFormatPicker({ value, onChange, disabled = false }: {
  value: AIImageFormat | null; onChange: (format: AIImageFormat) => void; disabled?: boolean;
}) {
  return <div className="grid grid-cols-2 sm:grid-cols-3 gap-2" role="group" aria-label="Formato para geração com IA">
    {mainFormats.map(key => {
      const format = AI_IMAGE_FORMATS[key];
      return <Button key={key} type="button" variant={value === key ? 'default' : 'outline'}
        disabled={disabled} aria-pressed={value === key} onClick={() => onChange(key)}
        className="h-16 flex-col gap-1 whitespace-normal">
        <span>{format.label}</span>
        <span className="text-xs opacity-70">{format.width} × {format.height}</span>
      </Button>;
    })}
  </div>;
}
export function AIImageFormatDialog({ open, onOpenChange, onGenerate }: {
  open: boolean; onOpenChange: (open: boolean) => void; onGenerate: (format: AIImageFormat) => void;
}) {
  const [selected, setSelected] = useState<AIImageFormat | null>(null);
  return <Dialog open={open} onOpenChange={value => { if (!value) setSelected(null); onOpenChange(value); }}>
    <DialogContent className="max-w-lg">
      <DialogHeader><DialogTitle>Formato da imagem</DialogTitle>
        <DialogDescription>Escolha o formato da nova imagem.</DialogDescription></DialogHeader>
      <AIImageFormatPicker value={selected} onChange={setSelected} />
      <DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
        <Button disabled={!selected} onClick={() => { if (!selected) return; onGenerate(selected); setSelected(null); onOpenChange(false); }}>
          <Sparkles className="mr-2 h-4 w-4" />Gerar imagem
        </Button></DialogFooter>
    </DialogContent>
  </Dialog>;
}