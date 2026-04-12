import { PasswordInput } from '@/components/ui/password-input';
import { Label } from '@/components/ui/label';
import { Sparkles } from 'lucide-react';
import { forwardRef } from 'react';
import ConnectionCard from '@/components/ConnectionCard';
import type { UserSettings } from '@/pages/SettingsPage';

interface Props {
  settings: UserSettings;
  onChange: (partial: Partial<UserSettings>) => void;
  hasGeminiKey?: boolean;
}

const GeminiSettings = forwardRef<HTMLDivElement, Props>(({ settings, onChange, hasGeminiKey }, ref) => {
  const connected = !!(settings.gemini_api_key || hasGeminiKey);

  return (
    <ConnectionCard
      ref={ref}
      icon={<Sparkles className="h-5 w-5 text-primary" />}
      title="Google Gemini (IA)"
      description="Use sua própria chave do Google Gemini para gerar artigos sem gastar créditos extras"
      connected={connected}
      connectedInfo={connected ? 'Chave Gemini configurada ✓' : undefined}
      onDisconnect={() => onChange({ gemini_api_key: '' })}
    >
      <div className="space-y-3">
        <div className="p-2.5 rounded-lg bg-accent/30 border border-accent/50 text-xs text-muted-foreground">
          <strong className="text-foreground">Como obter sua chave:</strong> Acesse{' '}
          <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer" className="text-primary underline">
            Google AI Studio
          </a>
          , clique em <strong>"Create API Key"</strong> e cole aqui. A chave é gratuita com limites generosos.
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Chave de API do Gemini</Label>
          <PasswordInput
            placeholder={hasGeminiKey && !settings.gemini_api_key ? '••••••••  (salva no servidor)' : 'Cole sua chave AIza...'}
            value={settings.gemini_api_key}
            onChange={(e) => onChange({ gemini_api_key: e.target.value })}
            className="h-9 text-sm"
          />
          <p className="text-[10px] text-muted-foreground">
            Deixe em branco para manter a chave atual. Sua chave é criptografada e armazenada de forma segura.
          </p>
        </div>
      </div>
    </ConnectionCard>
  );
});

GeminiSettings.displayName = 'GeminiSettings';

export default GeminiSettings;
