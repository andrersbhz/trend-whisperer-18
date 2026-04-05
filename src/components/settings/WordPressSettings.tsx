import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Globe } from 'lucide-react';
import ConnectionCard from '@/components/ConnectionCard';
import type { UserSettings } from '@/pages/SettingsPage';

interface Props {
  settings: UserSettings;
  onChange: (partial: Partial<UserSettings>) => void;
}

const WordPressSettings = ({ settings, onChange }: Props) => {
  const connected = !!(settings.wordpress_url && settings.wordpress_app_password);

  return (
    <ConnectionCard
      icon={<Globe className="h-5 w-5 text-primary" />}
      title="WordPress"
      description="Publicação automática de artigos"
      connected={connected}
      connectedInfo={connected ? `Conectado a ${settings.wordpress_url}` : undefined}
      onDisconnect={() => onChange({ wordpress_url: '', wordpress_username: '', wordpress_app_password: '' })}
    >
      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label className="text-xs">URL do WordPress</Label>
          <Input
            placeholder="https://meublog.com.br"
            value={settings.wordpress_url}
            onChange={(e) => onChange({ wordpress_url: e.target.value })}
            className="h-9 text-sm"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Usuário</Label>
          <Input
            placeholder="admin"
            value={settings.wordpress_username}
            onChange={(e) => onChange({ wordpress_username: e.target.value })}
            className="h-9 text-sm"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Senha de Aplicativo</Label>
          <Input
            type="password"
            placeholder="xxxx xxxx xxxx xxxx"
            value={settings.wordpress_app_password}
            onChange={(e) => onChange({ wordpress_app_password: e.target.value })}
            className="h-9 text-sm"
          />
          <p className="text-[10px] text-muted-foreground">
            Gere em: WordPress → Usuários → Perfil → Senhas de Aplicativo
          </p>
        </div>
      </div>
    </ConnectionCard>
  );
};

export default WordPressSettings;
