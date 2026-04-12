import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Save, Loader2 } from 'lucide-react';
import WordPressSettings from '@/components/settings/WordPressSettings';
import GoogleAnalyticsSettings from '@/components/settings/GoogleAnalyticsSettings';
import AutomationSettings from '@/components/settings/AutomationSettings';
import GeminiSettings from '@/components/settings/GeminiSettings';
import { getErrorMessage, runBackendMutation, runBackendQuery } from '@/lib/backend';

export interface UserSettings {
  wordpress_url: string;
  wordpress_username: string;
  wordpress_app_password: string;
  facebook_page_id: string;
  facebook_access_token: string;
  instagram_account_id: string;
  google_analytics_property_id: string;
  gemini_api_key: string;
  categories: string[];
  articles_per_day: number;
  auto_publish: boolean;
}

const defaultSettings: UserSettings = {
  wordpress_url: '',
  wordpress_username: '',
  wordpress_app_password: '',
  facebook_page_id: '',
  facebook_access_token: '',
  instagram_account_id: '',
  google_analytics_property_id: '',
  gemini_api_key: '',
  categories: ['esportes', 'politica', 'policia', 'saude', 'celebridades', 'financas'],
  articles_per_day: 10,
  auto_publish: false,
};

interface CredentialsStatus {
  has_wp_password: boolean;
  has_fb_token: boolean;
  has_gemini_key: boolean;
}

const SettingsPage = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasExistingSettings, setHasExistingSettings] = useState(false);
  const [settings, setSettings] = useState<UserSettings>(defaultSettings);
  const [credStatus, setCredStatus] = useState<CredentialsStatus>({ has_wp_password: false, has_fb_token: false, has_gemini_key: false });

  useEffect(() => {
    if (!user) return;

    const fetchSettings = async () => {
      try {
        const [data, status] = await Promise.all([
          runBackendQuery(() =>
            supabase
              .from('user_settings')
              .select('wordpress_url, wordpress_username, google_analytics_property_id, facebook_page_id, instagram_account_id, categories, articles_per_day, auto_publish')
              .eq('user_id', user.id)
              .maybeSingle(),
          ),
          runBackendQuery(() => supabase.rpc('get_credentials_status')),
        ]);

        setHasExistingSettings(!!data);

        if (data) {
          setSettings({
            wordpress_url: data.wordpress_url || '',
            wordpress_username: data.wordpress_username || '',
            wordpress_app_password: '',
            facebook_page_id: data.facebook_page_id || '',
            facebook_access_token: '',
            instagram_account_id: data.instagram_account_id || '',
            google_analytics_property_id: data.google_analytics_property_id || '',
            gemini_api_key: '',
            categories: data.categories || defaultSettings.categories,
            articles_per_day: data.articles_per_day || 10,
            auto_publish: data.auto_publish || false,
          });
        }

        if (status) {
          setCredStatus(status as unknown as CredentialsStatus);
        }
      } catch (error) {
        toast({ title: 'Erro ao carregar configurações', description: getErrorMessage(error), variant: 'destructive' });
      } finally {
        setLoading(false);
      }
    };

    fetchSettings();
  }, [toast, user]);

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        wordpress_url: settings.wordpress_url,
        wordpress_username: settings.wordpress_username,
        facebook_page_id: settings.facebook_page_id,
        instagram_account_id: settings.instagram_account_id,
        google_analytics_property_id: settings.google_analytics_property_id,
        categories: settings.categories,
        articles_per_day: settings.articles_per_day,
        auto_publish: settings.auto_publish,
      };

      if (settings.wordpress_app_password) {
        payload.wordpress_app_password = settings.wordpress_app_password;
      }
      if (settings.facebook_access_token) {
        payload.facebook_access_token = settings.facebook_access_token;
      }
      if (settings.gemini_api_key) {
        payload.gemini_api_key = settings.gemini_api_key;
      }

      await runBackendMutation(() =>
        hasExistingSettings
          ? supabase.from('user_settings').update(payload as any).eq('user_id', user.id)
          : supabase.from('user_settings').insert({ user_id: user.id, ...payload } as any),
      );

      setHasExistingSettings(true);
      toast({ title: 'Salvo!', description: 'Configurações atualizadas com sucesso.' });

      const status = await runBackendQuery(() => supabase.rpc('get_credentials_status'));
      if (status) setCredStatus(status as unknown as CredentialsStatus);

      setSettings(prev => ({ ...prev, wordpress_app_password: '', facebook_access_token: '', gemini_api_key: '' }));
    } catch (error) {
      toast({ title: 'Erro', description: getErrorMessage(error), variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const updateSettings = (partial: Partial<UserSettings>) => {
    setSettings((prev) => ({ ...prev, ...partial }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Configurações</h1>
        <p className="text-muted-foreground text-sm mt-1">Configure suas integrações e preferências</p>
      </div>

      <GeminiSettings settings={settings} onChange={updateSettings} hasGeminiKey={credStatus.has_gemini_key} />
      <WordPressSettings settings={settings} onChange={updateSettings} hasWpPassword={credStatus.has_wp_password} />
      <GoogleAnalyticsSettings settings={settings} onChange={updateSettings} />
      <AutomationSettings settings={settings} onChange={updateSettings} />

      <Button onClick={handleSave} disabled={saving} className="gradient-primary w-full sm:w-auto">
        {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
        Salvar Configurações
      </Button>
    </div>
  );
};

export default SettingsPage;
