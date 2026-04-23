import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Save, Loader2 } from 'lucide-react';
import WordPressSettings from '@/components/settings/WordPressSettings';
import SocialSettings from '@/components/settings/SocialSettings';
import GoogleAnalyticsSettings from '@/components/settings/GoogleAnalyticsSettings';
import AutomationSettings from '@/components/settings/AutomationSettings';
import GeminiSettings from '@/components/settings/GeminiSettings';
import OpenAISettings from '@/components/settings/OpenAISettings';
import GroqSettings from '@/components/settings/GroqSettings';
import JetpackSettings from '@/components/settings/JetpackSettings';

import { getErrorMessage, runBackendMutation, runBackendQuery } from '@/lib/backend';

export interface UserSettings {
  wordpress_url: string;
  wordpress_username: string;
  wordpress_app_password: string;
  google_analytics_property_id: string;
  gemini_api_key: string;
  openai_api_key: string;
  groq_api_key: string;
  categories: string[];
  articles_per_day: number;
  auto_publish: boolean;
  writer_prompt: string;
  facebook_access_token: string;
  facebook_page_id: string;
  facebook_ad_account_id: string;
  linkedin_access_token: string;
  linkedin_org_id: string;
}

const defaultSettings: UserSettings = {
  wordpress_url: '',
  wordpress_username: '',
  wordpress_app_password: '',
  google_analytics_property_id: '',
  gemini_api_key: '',
  openai_api_key: '',
  groq_api_key: '',
  categories: ['esportes', 'politica', 'policia', 'saude', 'celebridades', 'financas'],
  articles_per_day: 3,
  auto_publish: false,
  writer_prompt: '',
  facebook_access_token: '',
  facebook_page_id: '',
  facebook_ad_account_id: '',
  linkedin_access_token: '',
  linkedin_org_id: '',
};

interface CredentialsStatus {
  has_wp_password: boolean;
  has_gemini_key: boolean;
  has_openai_key: boolean;
  has_groq_key: boolean;
}

const SettingsPage = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasExistingSettings, setHasExistingSettings] = useState(false);
  const [settings, setSettings] = useState<UserSettings>(defaultSettings);
  const [credStatus, setCredStatus] = useState<CredentialsStatus>({ has_wp_password: false, has_gemini_key: false, has_openai_key: false, has_groq_key: false });

  useEffect(() => {
    if (!user) return;

    const fetchSettings = async () => {
      try {
        const [data, status] = await Promise.all([
          runBackendQuery(() =>
            supabase
              .from('user_settings')
              .select('wordpress_url, wordpress_username, google_analytics_property_id, categories, articles_per_day, auto_publish, writer_prompt, facebook_access_token, facebook_page_id, facebook_ad_account_id, linkedin_access_token, linkedin_org_id')
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
            google_analytics_property_id: data.google_analytics_property_id || '',
            gemini_api_key: '',
            openai_api_key: '',
            groq_api_key: '',
            categories: data.categories || defaultSettings.categories,
            articles_per_day: data.articles_per_day || 3,
            auto_publish: data.auto_publish || false,
            writer_prompt: (data as any).writer_prompt || '',
            facebook_access_token: (data as any).facebook_access_token || '',
            facebook_page_id: (data as any).facebook_page_id || '',
            facebook_ad_account_id: (data as any).facebook_ad_account_id || '',
            linkedin_access_token: (data as any).linkedin_access_token || '',
            linkedin_org_id: (data as any).linkedin_org_id || '',
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
        google_analytics_property_id: settings.google_analytics_property_id,
        categories: settings.categories,
        articles_per_day: settings.articles_per_day,
        auto_publish: settings.auto_publish,
        writer_prompt: settings.writer_prompt,
        facebook_access_token: settings.facebook_access_token,
        facebook_page_id: settings.facebook_page_id,
        facebook_ad_account_id: settings.facebook_ad_account_id,
        linkedin_access_token: settings.linkedin_access_token,
        linkedin_org_id: settings.linkedin_org_id,
      };

      if (settings.wordpress_app_password) {
        payload.wordpress_app_password = settings.wordpress_app_password;
      }
      if (settings.gemini_api_key) {
        payload.gemini_api_key = settings.gemini_api_key;
      }
      if (settings.openai_api_key) {
        payload.openai_api_key = settings.openai_api_key;
      }
      if (settings.groq_api_key) {
        payload.groq_api_key = settings.groq_api_key;
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

      setSettings(prev => ({ ...prev, wordpress_app_password: '', gemini_api_key: '', openai_api_key: '', groq_api_key: '' }));
    } catch (error) {
      toast({ title: 'Erro', description: getErrorMessage(error), variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const updateSettings = (partial: Partial<UserSettings>) => {
    setSettings((prev) => ({ ...prev, ...partial }));
  };

  const disconnectCredential = async (
    fields: Partial<Record<keyof UserSettings, null | '' | string[]>>,
    label: string,
  ) => {
    if (!user) return;
    try {
      if (hasExistingSettings) {
        await runBackendMutation(() =>
          supabase.from('user_settings').update(fields as any).eq('user_id', user.id),
        );
      }
      const localReset: Partial<UserSettings> = {};
      for (const k of Object.keys(fields) as (keyof UserSettings)[]) {
        const v = fields[k];
        (localReset as any)[k] = Array.isArray(v) ? v : '';
      }
      setSettings((prev) => ({ ...prev, ...localReset }));

      const status = await runBackendQuery(() => supabase.rpc('get_credentials_status'));
      if (status) setCredStatus(status as unknown as CredentialsStatus);

      toast({ title: 'Desconectado', description: `${label} foi desconectado(a) com sucesso.` });
    } catch (error) {
      toast({ title: 'Erro ao desconectar', description: getErrorMessage(error), variant: 'destructive' });
    }
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

      <div className="p-3 rounded-lg bg-accent/20 border border-accent/40 text-xs text-muted-foreground">
        <strong className="text-foreground">🔄 Sistema Multi-IA:</strong> O sistema tenta gerar artigos na seguinte ordem: <strong>Gemini → OpenAI → Groq → Lovable AI</strong>. Para imagens: <strong>DALL-E 3 → Lovable AI → Gemini</strong>. Se um provedor estiver sem saldo, o próximo é usado automaticamente.
      </div>

      <GeminiSettings settings={settings} onChange={updateSettings} hasGeminiKey={credStatus.has_gemini_key} onDisconnect={() => disconnectCredential({ gemini_api_key: '' }, 'Gemini')} />
      <OpenAISettings settings={settings} onChange={updateSettings} hasOpenaiKey={credStatus.has_openai_key} onDisconnect={() => disconnectCredential({ openai_api_key: '' }, 'OpenAI')} />
      <GroqSettings settings={settings} onChange={updateSettings} hasGroqKey={credStatus.has_groq_key} onDisconnect={() => disconnectCredential({ groq_api_key: '' }, 'Groq')} />
      <WordPressSettings settings={settings} onChange={updateSettings} hasWpPassword={credStatus.has_wp_password} onDisconnect={() => disconnectCredential({ wordpress_url: '', wordpress_username: '', wordpress_app_password: '' }, 'WordPress')} />
      <JetpackSettings settings={settings} hasWpPassword={credStatus.has_wp_password} />
      
      <GoogleAnalyticsSettings settings={settings} onChange={updateSettings} />
      <SocialSettings settings={settings} onChange={updateSettings} onDisconnect={(p) => disconnectCredential(p === 'facebook' ? { facebook_access_token: '', facebook_page_id: '', facebook_ad_account_id: '' } : { linkedin_access_token: '', linkedin_org_id: '' }, p)} />
      <AutomationSettings settings={settings} onChange={updateSettings} />

      <Button onClick={handleSave} disabled={saving} className="gradient-primary w-full sm:w-auto">
        {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
        Salvar Configurações
      </Button>
    </div>
  );
};

export default SettingsPage;