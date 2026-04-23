import React from 'react';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { Label } from '@/components/ui/label';
import { Facebook, Linkedin, ExternalLink } from 'lucide-react';
import ConnectionCard from '@/components/ConnectionCard';
import type { UserSettings } from '@/pages/SettingsPage';

interface Props {
  settings: UserSettings;
  onChange: (partial: Partial<UserSettings>) => void;
  onDisconnect?: (provider: 'facebook' | 'linkedin') => void;
}

const SocialSettings = ({ settings, onChange, onDisconnect }: Props) => {
  const fbConnected = !!(settings.facebook_access_token && settings.facebook_page_id);
  const liConnected = !!(settings.linkedin_access_token && settings.linkedin_org_id);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* Facebook & Instagram */}
      <ConnectionCard
        icon={<Facebook className="h-5 w-5 text-[#1877F2]" />}
        title="Meta (FB/IG)"
        description="Publicar automaticamente no Facebook e Instagram"
        connected={fbConnected}
        connectedInfo={fbConnected ? `Página ID: ${settings.facebook_page_id}` : undefined}
        onDisconnect={() => onDisconnect?.('facebook')}
      >
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Token de Acesso à Página (EAA...)</Label>
            <PasswordInput
              placeholder="Cole o token permanente da página"
              value={settings.facebook_access_token || ''}
              onChange={(e) => onChange({ facebook_access_token: e.target.value })}
              className="h-9 text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Page ID</Label>
            <Input
              placeholder="Ex: 1029384756"
              value={settings.facebook_page_id || ''}
              onChange={(e) => onChange({ facebook_page_id: e.target.value })}
              className="h-9 text-sm"
            />
          </div>
          <a 
            href="https://developers.facebook.com/tools/explorer/" 
            target="_blank" 
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-[10px] text-primary hover:underline"
          >
            Obter token no Graph Explorer <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </ConnectionCard>

      {/* LinkedIn */}
      <ConnectionCard
        icon={<Linkedin className="h-5 w-5 text-[#0A66C2]" />}
        title="LinkedIn"
        description="Publicar artigos em páginas de organização"
        connected={liConnected}
        connectedInfo={liConnected ? `Org ID: ${settings.linkedin_org_id}` : undefined}
        onDisconnect={() => onDisconnect?.('linkedin')}
      >
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">LinkedIn Access Token</Label>
            <PasswordInput
              placeholder="OAuth Access Token"
              value={settings.linkedin_access_token || ''}
              onChange={(e) => onChange({ linkedin_access_token: e.target.value })}
              className="h-9 text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Organization ID (URN)</Label>
            <Input
              placeholder="Ex: 1234567"
              value={settings.linkedin_org_id || ''}
              onChange={(e) => onChange({ linkedin_org_id: e.target.value })}
              className="h-9 text-sm"
            />
          </div>
          <p className="text-[10px] text-muted-foreground">
            A API do LinkedIn requer permissões `w_organization_social`.
          </p>
        </div>
      </ConnectionCard>
    </div>
  );
};

export default SocialSettings;
