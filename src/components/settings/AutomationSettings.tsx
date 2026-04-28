import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Settings, PenTool, Image as ImageIcon } from 'lucide-react';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import type { UserSettings } from '@/pages/SettingsPage';
import { forwardRef } from 'react';

import { useState, useMemo } from 'react';
import { Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

const defaultCategories = [
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
  const [newCategory, setNewCategory] = useState('');

  const availableCategories = useMemo(() => {
    // Current categories in settings + default ones not in settings
    const currentCategories = settings.categories.map(cat => {
      const def = defaultCategories.find(d => d.id === cat);
      return { id: cat, label: def ? def.label : cat };
    });
    
    return currentCategories;
  }, [settings.categories]);

  const toggleCategory = (catId: string) => {
    const newCategories = settings.categories.includes(catId)
      ? settings.categories.filter((c) => c !== catId)
      : [...settings.categories, catId];
    onChange({ categories: newCategories });
  };

  const addCustomCategory = () => {
    const trimmed = newCategory.trim().toLowerCase();
    if (!trimmed) return;
    
    if (!settings.categories.includes(trimmed)) {
      onChange({ categories: [...settings.categories, trimmed] });
    }
    setNewCategory('');
  };

  const removeCategory = (catId: string) => {
    onChange({ categories: settings.categories.filter(c => c !== catId) });
  };

  return (
    <div ref={ref} className="space-y-6">
      {/* Modo de Imagem */}
      <Card className="shadow-card">
        <CardHeader>
          <div className="flex items-center gap-2">
            <ImageIcon className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">Imagem Destacada</CardTitle>
          </div>
          <CardDescription>
            Escolha como as imagens dos artigos serão gerenciadas.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <RadioGroup
            value={settings.image_mode}
            onValueChange={(val: 'ai' | 'manual' | 'none') => onChange({ image_mode: val })}
            className="grid grid-cols-1 md:grid-cols-3 gap-4"
          >
            <div>
              <RadioGroupItem
                value="ai"
                id="mode-ai"
                className="peer sr-only"
              />
              <Label
                htmlFor="mode-ai"
                className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer"
              >
                <ImageIcon className="mb-3 h-6 w-6" />
                <span className="font-semibold">Gerada por IA</span>
                <span className="text-[10px] text-center text-muted-foreground mt-1">O robô gera uma imagem única para cada artigo</span>
              </Label>
            </div>

            <div>
              <RadioGroupItem
                value="manual"
                id="mode-manual"
                className="peer sr-only"
              />
              <Label
                htmlFor="mode-manual"
                className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer"
              >
                <PenTool className="mb-3 h-6 w-6" />
                <span className="font-semibold">Manual (Upload)</span>
                <span className="text-[10px] text-center text-muted-foreground mt-1">Você faz o upload da imagem após a geração</span>
              </Label>
            </div>

            <div>
              <RadioGroupItem
                value="none"
                id="mode-none"
                className="peer sr-only"
              />
              <Label
                htmlFor="mode-none"
                className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer"
              >
                <div className="mb-3 h-6 w-6 flex items-center justify-center font-bold text-lg">/</div>
                <span className="font-semibold">Nenhuma</span>
                <span className="text-[10px] text-center text-muted-foreground mt-1">Os artigos serão criados sem imagem destacada</span>
              </Label>
            </div>
          </RadioGroup>
        </CardContent>
      </Card>

      {/* Writer Profile */}
      <Card className="shadow-card">
        <CardHeader>
          <div className="flex items-center gap-2">
            <PenTool className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">Perfil do Escritor</CardTitle>
          </div>
          <CardDescription>
            Defina como a IA deve escrever seus artigos {settings.image_mode === 'ai' && <strong>e gerar as imagens</strong>}. 
            {settings.image_mode === 'ai' ? 
              " Este é o ÚNICO prompt usado em toda geração — inclua aqui tanto as instruções de texto quanto as instruções visuais." :
              " Este prompt define o estilo de escrita, tom e estrutura dos seus artigos."
            }
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Label htmlFor="writer-prompt-settings">
            Prompt do escritor {settings.image_mode === 'ai' ? "(texto + imagem)" : "(texto)"}
          </Label>
          <Textarea
            id="writer-prompt-settings"
            value={settings.writer_prompt}
            onChange={(e) => onChange({ writer_prompt: e.target.value })}
            placeholder={settings.image_mode === 'ai' 
              ? `Ex: Sou um jornalista especializado em tecnologia. Escreva artigos com tom informal mas informativo...\n\nIMAGEM: Fotografia editorial realista, estilo fotojornalismo brasileiro...`
              : `Ex: Sou um jornalista especializado em tecnologia. Escreva artigos com tom informal mas informativo, use listas e subtítulos, otimize para SEO...`
            }
            className="min-h-[200px] text-sm"
          />
          <p className="text-xs text-muted-foreground">
            Dica: Inclua estilo de escrita, nicho, tom, público-alvo e técnicas de SEO.
            {settings.image_mode === 'ai' && " Adicione também instruções de imagem (estilo fotográfico, iluminação, restrições)."}
          </p>
        </CardContent>
      </Card>

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
