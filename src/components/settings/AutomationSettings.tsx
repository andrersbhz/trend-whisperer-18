import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Settings, PenTool } from 'lucide-react';
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

      {/* Automation Settings */}
      <Card className="shadow-card">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Settings className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">Automação</CardTitle>
          </div>
          <CardDescription>Configure como os artigos devem ser gerados</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label>Artigos por dia</Label>
            <Input
              type="number"
              min={1}
              max={20}
              value={settings.articles_per_day}
              onChange={(e) => onChange({ articles_per_day: parseInt(e.target.value) || 10 })}
            />
          </div>

          <div className="space-y-3">
            <Label>Categorias ativas</Label>
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

          <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
            <div>
              <p className="text-sm font-medium text-foreground">Publicação automática</p>
              <p className="text-xs text-muted-foreground">Publicar artigos automaticamente após geração</p>
            </div>
            <Switch
              checked={settings.auto_publish}
              onCheckedChange={(checked) => onChange({ auto_publish: checked })}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
});

AutomationSettings.displayName = 'AutomationSettings';

export default AutomationSettings;
