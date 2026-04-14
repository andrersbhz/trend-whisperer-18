import { PasswordInput } from '@/components/ui/password-input';
import { Label } from '@/components/ui/label';
import { Zap } from 'lucide-react';
import { forwardRef } from 'react';
import ConnectionCard from '@/components/ConnectionCard';
import type { UserSettings } from '@/pages/SettingsPage';

interface Props {
  settings: UserSettings;
  onChange: (partial: Partial<UserSettings>) => void;
  hasGroqKey?: boolean;
}

const GroqSettings = forwardRef<HTMLDivElement, Props>(({ settings, onChange, hasGroqKey }, ref) => {
  const connected = !!(settings.groq_api_key || hasGroqKey);

  return (
    <ConnectionCard
      ref={ref}
      icon={<Zap className="h-5 w-5 text-primary" />}
      title="Groq (LLaMA / Mixtral)"
      description="Use sua chave gratuita do Groq como provedor de IA adicional — modelos open-source ultrarrápidos"
      connected={connected}
      connectedInfo={connected ? 'Chave Groq configurada ✓' : undefined}
      onDisconnect={() => onChange({ groq_api_key: '' })}
    >
      <div className="space-y-3">
        <div className="p-2.5 rounded-lg bg-accent/30 border border-accent/50 text-xs text-muted-foreground">
          <strong className="text-foreground">Como obter sua chave:</strong> Acesse{' '}
          <a href="https://console.groq.com/keys" target="_blank" rel="noopener noreferrer" className="text-primary underline">
            Groq Console
          </a>
          , crie uma API Key e cole aqui. O plano gratuito oferece <strong>14.400 req/dia</strong> com modelos como LLaMA 3.1 70B.
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Chave de API do Groq</Label>
          <PasswordInput
            placeholder={hasGroqKey && !settings.groq_api_key ? '••••••••  (salva no servidor)' : 'Cole sua chave gsk_...'}
            value={settings.groq_api_key}
            onChange={(e) => onChange({ groq_api_key: e.target.value })}
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

GroqSettings.displayName = 'GroqSettings';

export default GroqSettings;