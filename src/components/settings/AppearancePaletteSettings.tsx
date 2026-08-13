import { useState } from 'react';
import { Check, Palette, RotateCcw, SlidersHorizontal } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { UI_PALETTES, useTheme } from '@/components/theme-provider';

const AppearancePaletteSettings = () => {
  const { palette, setPalette, customPrimary, customAccent, setCustomColors } = useTheme();
  const [primary, setPrimary] = useState(customPrimary);
  const [accent, setAccent] = useState(customAccent);

  return (
    <Card className="overflow-hidden border-border/60 bg-card/80 shadow-sm">
      <CardHeader className="border-b border-border/60 bg-muted/20">
        <div className="flex items-center justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <Palette className="h-4 w-4 text-primary" /> Paleta do sistema
            </CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">Troque a identidade visual sem alterar nenhuma função do sistema.</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => setPalette('lime')}>
            <RotateCcw className="h-3.5 w-3.5" /> Restaurar
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6 p-5">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {UI_PALETTES.map((item) => {
            const active = palette === item.name;
            return (
              <button
                type="button"
                key={item.name}
                onClick={() => setPalette(item.name)}
                className={`group relative rounded-xl border p-3 text-left transition-all duration-200 ${active ? 'border-primary bg-primary/5 ring-2 ring-primary/20' : 'border-border/70 bg-background/50 hover:border-primary/60 hover:bg-muted/50'}`}
              >
                <div className="mb-3 flex gap-1.5">
                  <span className="h-7 flex-1 rounded-md border border-black/5" style={{ background: `hsl(${item.primary})` }} />
                  <span className="h-7 w-8 rounded-md border border-black/5" style={{ background: `hsl(${item.accent})` }} />
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-foreground">{item.label}</span>
                  {active && <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground"><Check className="h-3 w-3" /></span>}
                </div>
              </button>
            );
          })}
        </div>

        <div className="rounded-xl border border-border/70 bg-muted/15 p-4">
          <div className="mb-4 flex items-center gap-2">
            <SlidersHorizontal className="h-4 w-4 text-primary" />
            <div>
              <p className="text-sm font-semibold">Paleta personalizada</p>
              <p className="text-xs text-muted-foreground">Escolha a cor principal e a cor de destaque. O contraste do texto é calculado automaticamente.</p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_auto] lg:items-end">
            <div className="space-y-2">
              <Label>Cor principal</Label>
              <div className="flex items-center gap-2 rounded-lg border border-input bg-background px-3 py-2">
                <input type="color" value={primary} onChange={(e) => setPrimary(e.target.value)} className="h-8 w-10 cursor-pointer rounded border-0 bg-transparent p-0" />
                <span className="text-xs font-mono uppercase text-muted-foreground">{primary}</span>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Cor de destaque</Label>
              <div className="flex items-center gap-2 rounded-lg border border-input bg-background px-3 py-2">
                <input type="color" value={accent} onChange={(e) => setAccent(e.target.value)} className="h-8 w-10 cursor-pointer rounded border-0 bg-transparent p-0" />
                <span className="text-xs font-mono uppercase text-muted-foreground">{accent}</span>
              </div>
            </div>
            <Button onClick={() => setCustomColors(primary, accent)}>Aplicar cores</Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default AppearancePaletteSettings;
