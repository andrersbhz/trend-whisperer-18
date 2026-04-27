import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Settings, PenTool, Image } from 'lucide-react';
import type { UserSettings } from '@/pages/SettingsPage';
import { forwardRef } from 'react';

const allCategories = [
  { id: 'esportes', label: '⚽ Esportes' },
  { id: 'politica', label: '🏛️ Política' },
  { id: 'policia', label: '🚔 Polícia' },
  { id: 'saude', label: '💚 Saúde e Bem-Estar' },
  { id: 'celebridades', label: '⭐ Celebridades' },
  { id: 'financas', label: '💰 Finanças' },
];

interface Props {
  settings: UserSettings;
  onChange: (partial: Partial<UserSettings>) => void;
}

const AutomationSettings = forwardRef<HTMLDivElement, Props>(({ settings, onChange }, ref) => {
  const toggleCategory = (cat: string) => {
    const newCategories = settings.categories.includes(cat)
      ? settings.categories.filter((c) => c !== cat)
      : [...settings.categories, cat];
    onChange({ categories: newCategories });
  };

  return (
    <div ref={ref} className="space-y-6">
      {/* Writer Profile */}
      <Card className="shadow-card">
        <CardHeader>
          <div className="flex items-center gap-2">
            <PenTool className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">Perfil do Escritor</CardTitle>
          </div>
          <CardDescription>
            Defina como a IA deve escrever seus artigos. Este prompt será usado em toda geração para garantir consistência de estilo e máxima otimização SEO.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Label htmlFor="writer-prompt-settings">Prompt de estilo e SEO</Label>
          <Textarea
            id="writer-prompt-settings"
            value={settings.writer_prompt}
            onChange={(e) => onChange({ writer_prompt: e.target.value })}
            placeholder="Ex: Sou um jornalista especializado em tecnologia. Escreva artigos com tom informal mas informativo, use listas e subtítulos, otimize para SEO com keywords de cauda longa..."
            className="min-h-[140px] text-sm"
          />
          <p className="text-xs text-muted-foreground">
            Dica: Inclua seu nicho, tom de voz desejado, público-alvo, técnicas de SEO preferidas (cauda longa, LSI keywords, featured snippets, etc.)
          </p>
        </CardContent>
      </Card>
 
      {/* Image Prompt Profile */}
      <Card className="shadow-card">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Image className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">Prompt de Imagem</CardTitle>
          </div>
          <CardDescription>
            Defina como a IA deve gerar as imagens dos seus artigos. Descreva o estilo (ex: realismo fotográfico, Nikon D850), iluminação e o que evitar. Use <strong>{"{title}"}</strong> para inserir o título do artigo no prompt.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Label htmlFor="image-prompt-settings">Instruções para Imagens (DALL-E / Gemini)</Label>
          <Textarea
            id="image-prompt-settings"
            value={settings.image_prompt_template}
            onChange={(e) => onChange({ image_prompt_template: e.target.value })}
            placeholder="Ex: Realistic photography, RAW photo of {title}, shot on Nikon D850, 35mm lens, natural lighting, high skin texture detail, 8k resolution, authentic news style..."
            className="min-h-[140px] text-sm"
          />
          <p className="text-xs text-muted-foreground">
            Dica: Para imagens reais, peça texturas de pele, iluminação natural e evite termos como "3D render", "unreal engine" ou "smooth skin".
          </p>
        </CardContent>

      {/* Robô de Publicação */}
      <Card className="shadow-card">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Settings className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">🤖 Robô de Publicação Automática</CardTitle>
          </div>
          <CardDescription>
            Configure quantas postagens o robô deve fazer por dia e se deve publicar automaticamente no WordPress.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Postagens por dia */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold">Postagens por dia</Label>
            <p className="text-xs text-muted-foreground">
              Defina a quantidade de postagens a serem criadas e publicadas por dia. Os horários serão divididos em espaços iguais dentro de 24 horas.
            </p>
            <Input
              type="number"
              min={1}
              max={20}
              value={settings.articles_per_day}
              onChange={(e) => onChange({ articles_per_day: Math.max(1, Math.min(20, parseInt(e.target.value) || 3)) })}
            />
            {settings.articles_per_day > 0 && (
              <p className="text-xs text-muted-foreground bg-muted/50 p-2 rounded-md">
                ⏰ Intervalo entre postagens: <strong>~{Math.round(24 / settings.articles_per_day * 60)} minutos</strong> ({(24 / settings.articles_per_day).toFixed(1)}h)
              </p>
            )}
          </div>

          {/* Publicação automática */}
          <div className="flex items-center justify-between p-4 rounded-lg border border-primary/20 bg-primary/5">
            <div>
              <p className="text-sm font-semibold text-foreground">Publicação automática no WordPress</p>
              <p className="text-xs text-muted-foreground">Quando ativado, os artigos gerados serão publicados automaticamente no horário agendado</p>
            </div>
            <Switch
              checked={settings.auto_publish}
              onCheckedChange={(checked) => onChange({ auto_publish: checked })}
            />
          </div>

          {/* Categorias */}
          <div className="space-y-3">
            <Label className="text-sm font-semibold">Categorias ativas</Label>
            <p className="text-xs text-muted-foreground">Selecione os temas que o robô deve cobrir nas postagens</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {allCategories.map((cat) => (
                <label key={cat.id} className="flex items-center gap-2 p-2 rounded-lg hover:bg-muted/50 cursor-pointer">
                  <Checkbox
                    checked={settings.categories.includes(cat.id)}
                    onCheckedChange={() => toggleCategory(cat.id)}
                  />
                  <span className="text-sm text-foreground">{cat.label}</span>
                </label>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
});

AutomationSettings.displayName = 'AutomationSettings';

export default AutomationSettings;
