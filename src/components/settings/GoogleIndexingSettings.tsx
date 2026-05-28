import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Search } from 'lucide-react';
import ConnectionCard from '@/components/ConnectionCard';
import type { UserSettings } from '@/pages/SettingsPage';
import { forwardRef } from 'react';

interface Props {
  settings: UserSettings;
  onChange: (partial: Partial<UserSettings>) => void;
}

const GoogleIndexingSettings = forwardRef<HTMLDivElement, Props>(({ settings, onChange }, ref) => {
  const connected = !!settings.google_indexing_key;

  return (
    <ConnectionCard
      ref={ref}
      icon={<Search className="h-5 w-5 text-primary" />}
      title="Google Indexing API"
      description="Indexação imediata de novos posts no Google"
      connected={connected}
      connectedInfo={connected ? "Configurado (Chave JSON)" : undefined}
      onDisconnect={() => onChange({ google_indexing_key: '' })}
    >
      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label className="text-xs">Chave JSON da Conta de Serviço</Label>
          <Textarea
            placeholder='{"type": "service_account", "project_id": "...", ...}'
            value={settings.google_indexing_key || ''}
            onChange={(e) => onChange({ google_indexing_key: e.target.value })}
            className="h-24 text-xs font-mono"
          />
          <div className="space-y-1 mt-2">
            <p className="text-[10px] text-muted-foreground">
              1. Crie uma Conta de Serviço no Google Cloud Console.
            </p>
            <p className="text-[10px] text-muted-foreground">
              2. Baixe a chave JSON e cole o conteúdo acima.
            </p>
            <p className="text-[10px] text-muted-foreground">
              3. Adicione o e-mail da conta de serviço como "Proprietário" no Search Console.
            </p>
            <p className="text-[10px] text-muted-foreground font-medium text-amber-500/80">
              * Importante: Ative a "Indexing API" no projeto do Google Cloud.
            </p>
          </div>
        </div>
      </div>
    </ConnectionCard>
  );
});

GoogleIndexingSettings.displayName = 'GoogleIndexingSettings';

export default GoogleIndexingSettings;
