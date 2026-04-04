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
import { Save, Globe, Facebook, Key, Loader2 } from 'lucide-react';

const allCategories = [
  { id: 'esportes', label: '⚽ Esportes' },
  { id: 'politica', label: '🏛️ Política' },
  { id: 'policia', label: '🚔 Polícia' },
  { id: 'saude', label: '💚 Saúde e Bem-Estar' },
  { id: 'celebridades', label: '⭐ Celebridades' },
];

const SettingsPage = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState({
    wordpress_url: '',
    wordpress_username: '',
    wordpress_app_password: '',
    facebook_page_id: '',
    facebook_access_token: '',
    instagram_account_id: '',
    categories: ['esportes', 'politica', 'policia', 'saude', 'celebridades'],
    articles_per_day: 10,
    auto_publish: false,
  });

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
          categories: data.categories || ['esportes', 'politica', 'policia', 'saude', 'celebridades'],
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

  const toggleCategory = (cat: string) => {
    setSettings((prev) => ({
      ...prev,
      categories: prev.categories.includes(cat)
        ? prev.categories.filter((c) => c !== cat)
        : [...prev.categories, cat],
    }));
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

      {/* WordPress */}
      <Card className="shadow-card">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Globe className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">WordPress</CardTitle>
          </div>
          <CardDescription>Conecte seu blog WordPress para publicação automática</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>URL do WordPress</Label>
            <Input
              placeholder="https://meublog.com.br"
              value={settings.wordpress_url}
              onChange={(e) => setSettings({ ...settings, wordpress_url: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>Usuário</Label>
            <Input
              placeholder="admin"
              value={settings.wordpress_username}
              onChange={(e) => setSettings({ ...settings, wordpress_username: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>Senha de Aplicativo</Label>
            <Input
              type="password"
              placeholder="xxxx xxxx xxxx xxxx xxxx xxxx"
              value={settings.wordpress_app_password}
              onChange={(e) => setSettings({ ...settings, wordpress_app_password: e.target.value })}
            />
            <p className="text-xs text-muted-foreground">
              Gere em: WordPress → Usuários → Perfil → Senhas de Aplicativo
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Facebook / Instagram */}
      <Card className="shadow-card">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Facebook className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">Facebook & Instagram</CardTitle>
          </div>
          <CardDescription>Configure a postagem automática nas redes sociais</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Page ID do Facebook</Label>
            <Input
              placeholder="123456789"
              value={settings.facebook_page_id}
              onChange={(e) => setSettings({ ...settings, facebook_page_id: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>Access Token (Page Token)</Label>
            <Input
              type="password"
              placeholder="EAAxxxxxxx..."
              value={settings.facebook_access_token}
              onChange={(e) => setSettings({ ...settings, facebook_access_token: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>Instagram Business Account ID</Label>
            <Input
              placeholder="17841400000000"
              value={settings.instagram_account_id}
              onChange={(e) => setSettings({ ...settings, instagram_account_id: e.target.value })}
            />
          </div>
        </CardContent>
      </Card>

      {/* Automação */}
      <Card className="shadow-card">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Key className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">Automação</CardTitle>
          </div>
          <CardDescription>Configure como os artigos devem ser gerados</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label>Artigos por dia</Label>
            <Input
              type="number"
              min={1}
              max={20}
              value={settings.articles_per_day}
              onChange={(e) => setSettings({ ...settings, articles_per_day: parseInt(e.target.value) || 10 })}
            />
          </div>

          <div className="space-y-3">
            <Label>Categorias ativas</Label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {allCategories.map((cat) => (
                <label key={cat.id} className="flex items-center gap-2 p-2 rounded-lg hover:bg-muted/50 cursor-pointer">
                  <Checkbox
                    checked={settings.categories.includes(cat.id)}
                    onCheckedChange={() => toggleCategory(cat.id)}
                  />
                  <span className="text-sm text-foreground">{cat.label}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
            <div>
              <p className="text-sm font-medium text-foreground">Publicação automática</p>
              <p className="text-xs text-muted-foreground">Publicar artigos automaticamente após geração</p>
            </div>
            <Switch
              checked={settings.auto_publish}
              onCheckedChange={(checked) => setSettings({ ...settings, auto_publish: checked })}
            />
          </div>
        </CardContent>
      </Card>

      <Button onClick={handleSave} disabled={saving} className="gradient-primary w-full sm:w-auto">
        {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
        Salvar Configurações
      </Button>
    </div>
  );
};

export default SettingsPage;
