import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Facebook } from 'lucide-react';
import ConnectionCard from '@/components/ConnectionCard';
import type { UserSettings } from '@/pages/SettingsPage';

interface Props {
  settings: UserSettings;
  onChange: (partial: Partial<UserSettings>) => void;
}

const FacebookSettings = ({ settings, onChange }: Props) => {
  const connected = !!(settings.facebook_page_id && settings.facebook_access_token);

  return (
    <ConnectionCard
      icon={<Facebook className="h-5 w-5 text-primary" />}
      title="Facebook & Instagram"
      description="Postagem automática nas redes sociais"
      connected={connected}
      connectedInfo={connected ? `Page ID: ${settings.facebook_page_id}` : undefined}
      onDisconnect={() => onChange({ facebook_page_id: '', facebook_access_token: '', instagram_account_id: '' })}
    >
      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label className="text-xs">Page ID do Facebook</Label>
          <Input
            placeholder="123456789"
            value={settings.facebook_page_id}
            onChange={(e) => onChange({ facebook_page_id: e.target.value })}
            className="h-9 text-sm"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Access Token (Page Token)</Label>
          <Input
            type="password"
            placeholder="EAAxxxxxxx..."
            value={settings.facebook_access_token}
            onChange={(e) => onChange({ facebook_access_token: e.target.value })}
            className="h-9 text-sm"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Instagram Business Account ID</Label>
          <Input
            placeholder="17841400000000"
            value={settings.instagram_account_id}
            onChange={(e) => onChange({ instagram_account_id: e.target.value })}
            className="h-9 text-sm"
          />
        </div>
      </div>
    </ConnectionCard>
  );
};

export default FacebookSettings;
