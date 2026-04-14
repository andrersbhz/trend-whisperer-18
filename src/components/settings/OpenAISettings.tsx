import { PasswordInput } from '@/components/ui/password-input';
import { Label } from '@/components/ui/label';
import { Brain } from 'lucide-react';
import { forwardRef } from 'react';
import ConnectionCard from '@/components/ConnectionCard';
import type { UserSettings } from '@/pages/SettingsPage';

interface Props {
  settings: UserSettings;
  onChange: (partial: Partial<UserSettings>) => void;
  hasOpenaiKey?: boolean;
}

const OpenAISettings = forwardRef<HTMLDivElement, Props>(({ settings, onChange, hasOpenaiKey }, ref) => {
  const connected = !!(settings.openai_api_key || hasOpenaiKey);

  return (
    <ConnectionCard
      ref={ref}
      icon={<Brain className="h-5 w-5 text-primary" />}
      title="OpenAI (ChatGPT)"
      description="Use sua própria chave da OpenAI como provedor alternativo de IA para gerar artigos"
      connected={connected}
      connectedInfo={connected ? 'Chave OpenAI configurada ✓' : undefined}
      onDisconnect={() => onChange({ openai_api_key: '' })}
    >
      <div className="space-y-3">
        <div className="p-2.5 rounded-lg bg-accent/30 border border-accent/50 text-xs text-muted-foreground">
          <strong className="text-foreground">Como obter sua chave:</strong> Acesse{' '}
          <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer" className="text-primary underline">
            OpenAI Platform
          </a>
          , crie uma API Key e cole aqui. Requer saldo na conta OpenAI.
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Chave de API da OpenAI</Label>
          <PasswordInput
            placeholder={hasOpenaiKey && !settings.openai_api_key ? '••••••••  (salva no servidor)' : 'Cole sua chave sk-...'}
            value={settings.openai_api_key}
            onChange={(e) => onChange({ openai_api_key: e.target.value })}
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

OpenAISettings.displayName = 'OpenAISettings';

export default OpenAISettings;
