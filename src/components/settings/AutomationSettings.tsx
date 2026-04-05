import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Settings } from 'lucide-react';
import type { UserSettings } from '@/pages/SettingsPage';

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

const AutomationSettings = ({ settings, onChange }: Props) => {
  const toggleCategory = (cat: string) => {
    const newCategories = settings.categories.includes(cat)
      ? settings.categories.filter((c) => c !== cat)
      : [...settings.categories, cat];
    onChange({ categories: newCategories });
  };

  return (
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
  );
};

export default AutomationSettings;
