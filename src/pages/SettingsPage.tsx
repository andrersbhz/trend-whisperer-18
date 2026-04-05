import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { Save, Loader2 } from 'lucide-react';
import ConnectionCard from '@/components/ConnectionCard';
import WordPressSettings from '@/components/settings/WordPressSettings';
import FacebookSettings from '@/components/settings/FacebookSettings';
import GoogleAnalyticsSettings from '@/components/settings/GoogleAnalyticsSettings';
import AutomationSettings from '@/components/settings/AutomationSettings';

export interface UserSettings {
  wordpress_url: string;
  wordpress_username: string;
  wordpress_app_password: string;
  facebook_page_id: string;
  facebook_access_token: string;
  instagram_account_id: string;
  google_analytics_property_id: string;
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
  categories: ['esportes', 'politica', 'policia', 'saude', 'celebridades'],
  articles_per_day: 10,
  auto_publish: false,
};

const SettingsPage = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<UserSettings>(defaultSettings);

  useEffect(() => {
    if (!user) return;
    const fetchSettings = async () => {
      const { data } = await supabase
        .from('user_settings')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();
      if (data) {
        setSettings({
          wordpress_url: data.wordpress_url || '',
          wordpress_username: data.wordpress_username || '',
          wordpress_app_password: data.wordpress_app_password || '',
          facebook_page_id: data.facebook_page_id || '',
          facebook_access_token: data.facebook_access_token || '',
          instagram_account_id: data.instagram_account_id || '',
          google_analytics_property_id: (data as any).google_analytics_property_id || '',
          categories: data.categories || defaultSettings.categories,
          articles_per_day: data.articles_per_day || 10,
          auto_publish: data.auto_publish || false,
        });
      }
      setLoading(false);
    };
    fetchSettings();
  }, [user]);

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const { error } = await supabase.from('user_settings').upsert({
        user_id: user.id,
        ...settings,
      }, { onConflict: 'user_id' });
      if (error) throw error;
      toast({ title: 'Salvo!', description: 'Configurações atualizadas com sucesso.' });
    } catch (e: any) {
      toast({ title: 'Erro', description: e.message, variant: 'destructive' });
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

      <WordPressSettings settings={settings} onChange={updateSettings} />
      <FacebookSettings settings={settings} onChange={updateSettings} />
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
