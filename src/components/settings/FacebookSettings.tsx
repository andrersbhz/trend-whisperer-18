import { useEffect, useRef, useState } from 'react';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Facebook, Plus, Trash2, Loader2, Search, Instagram, Users, CheckCircle2, LogIn, RefreshCw, ShieldCheck, AlertTriangle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import ConnectionCard from '@/components/ConnectionCard';
import type { UserSettings } from '@/pages/SettingsPage';

interface FacebookAccount {
  id: string;
  page_name: string | null;
  page_id: string;
  access_token: string;
  instagram_account_id: string | null;
  is_active: boolean;
}

interface MetaPage {
  page_id: string;
  page_name: string;
  category: string | null;
  picture_url: string | null;
  fan_count: number;
  page_access_token: string;
  instagram: {
    id: string;
    name: string;
    username: string;
    profile_picture_url: string | null;
    followers_count: number;
  } | null;
}

interface Props {
  settings: UserSettings;
  onChange: (partial: Partial<UserSettings>) => void;
}

const FacebookSettings = ({ settings, onChange }: Props) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const returnUrl = typeof window !== 'undefined' ? `${window.location.origin}/settings` : '/settings';
  const [accounts, setAccounts] = useState<FacebookAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [showDiscover, setShowDiscover] = useState(false);
  const [userAccessToken, setUserAccessToken] = useState('');
  const [discoverLoading, setDiscoverLoading] = useState(false);
  const [metaPages, setMetaPages] = useState<MetaPage[]>([]);
  const [connectingPageId, setConnectingPageId] = useState<string | null>(null);
  const [tokenInfo, setTokenInfo] = useState<{ isValid: boolean; scopes: string[]; expiresAt?: number } | null>(null);
  const [newAccount, setNewAccount] = useState({ page_name: '', page_id: '', access_token: '', instagram_account_id: '' });
  const [saving, setSaving] = useState(false);
  const [oauthLoading, setOauthLoading] = useState(false);
  

  const fetchAccounts = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('facebook_accounts')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true });
    setAccounts((data as any[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchAccounts();
  }, [user]);

  const popupRef = useRef<Window | null>(null);
  const popupTimerRef = useRef<number | null>(null);

  const clearPopupWatcher = () => {
    if (popupTimerRef.current) {
      window.clearInterval(popupTimerRef.current);
      popupTimerRef.current = null;
    }
  };

  useEffect(() => {
    const onMessage = async (e: MessageEvent) => {
      if (e.data?.type === 'fb-oauth-done') {
        clearPopupWatcher();
        if (e.data.success) {
          toast({ title: 'Facebook conectado!', description: 'Páginas e tokens importados com sucesso.' });
          
          // If we have an access token in the message (might need update to callback function)
          // or just refresh accounts and check one of them
          await fetchAccounts();
          
          // Validation logic could go here if the callback returned the user token
        } else {
          toast({ title: 'Conexão cancelada ou falhou', variant: 'destructive' });
        }
        setOauthLoading(false);
        try { popupRef.current?.close(); } catch {}
      }
    };
    window.addEventListener('message', onMessage);
    return () => {
      window.removeEventListener('message', onMessage);
      clearPopupWatcher();
    };
  }, [user]);

  const validateToken = async (token: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('fetch-meta-pages', {
        body: { accessToken: token },
      });
      if (error) throw error;
      if (data?.debug) {
        setTokenInfo({
          isValid: data.debug.is_valid,
          scopes: data.debug.scopes || [],
          expiresAt: data.debug.data_access_expires_at || data.debug.expires_at,
        });
      }
    } catch (e) {
      console.error("Token validation error:", e);
    }
  };

  const getPopupFeatures = () => {
    const width = 600;
    const height = 780;
    const left = Math.max(0, window.screenX + (window.outerWidth - width) / 2);
    const top = Math.max(0, window.screenY + (window.outerHeight - height) / 2);

    return [
      'popup=yes',
      `width=${width}`,
      `height=${height}`,
      `left=${Math.round(left)}`,
      `top=${Math.round(top)}`,
      'resizable=yes',
      'scrollbars=yes',
    ].join(',');
  };

  const watchPopupClosed = (popup: Window) => {
    clearPopupWatcher();
    popupTimerRef.current = window.setInterval(() => {
      if (popup.closed) {
        clearPopupWatcher();
        setOauthLoading(false);
        // Refresh accounts in case the callback succeeded but postMessage was missed
        fetchAccounts();
      }
    }, 800);
  };

  const requestFacebookAuthUrl = async (returnUrl: string) => {
    const { data, error } = await supabase.functions.invoke('facebook-oauth-start', {
      body: { returnUrl },
    });
    if (error) throw error;
    if (!data?.authUrl) throw new Error('URL de autorização não retornada');
    return data.authUrl as string;
  };

  const startOauthPopup = async () => {
    setOauthLoading(true);
    
    try {
      const authUrl = await requestFacebookAuthUrl(returnUrl);
      
      // Using window.top.location.href to escape any iframe/sandbox restrictions
      if (window.top) {
        window.top.location.href = authUrl;
      } else {
        window.location.href = authUrl;
      }
    } catch (e: any) {
      setOauthLoading(false);
      toast({ title: 'Erro ao conectar', description: e.message, variant: 'destructive' });
    }
  };

  const handleOAuthConnect = async () => {
    if (oauthLoading) return;
    await startOauthPopup();
  };

  const handleDiscoverPages = async () => {
    const token = userAccessToken.trim();
    if (!token) {
      toast({ title: 'Erro', description: 'Insira seu User Access Token da Meta', variant: 'destructive' });
      return;
    }
    // Real Facebook User Access Tokens start with "EAA" and are 100+ characters long.
    // Anything else (App ID, App Secret, client token MD5 hash) will be rejected by the Graph API.
    if (!token.startsWith('EAA') || token.length < 100) {
      toast({
        title: 'Token inválido',
        description: 'Esse não parece ser um User Access Token. Tokens válidos começam com "EAA" e têm 100+ caracteres. Gere um em developers.facebook.com → Graph API Explorer, ou use o botão "Conectar" acima (login OAuth).',
        variant: 'destructive',
      });
      return;
    }
    setDiscoverLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('fetch-meta-pages', {
        body: { accessToken: token },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setMetaPages(data?.pages || []);
      if ((data?.pages || []).length === 0) {
        toast({ title: 'Nenhuma página encontrada', description: 'Esse token não tem páginas associadas.' });
      }
    } catch (e: any) {
      toast({ title: 'Erro ao buscar páginas', description: e.message, variant: 'destructive' });
      setMetaPages([]);
    } finally {
      setDiscoverLoading(false);
    }
  };

  const handleConnectPage = async (page: MetaPage) => {
    if (!user) return;
    setConnectingPageId(page.page_id);
    try {
      const { error } = await supabase.from('facebook_accounts').insert({
        user_id: user.id,
        page_name: page.page_name,
        page_id: page.page_id,
        access_token: page.page_access_token,
        instagram_account_id: page.instagram?.id || null,
      } as any);
      if (error) throw error;
      toast({ title: 'Página conectada!', description: `${page.page_name} foi adicionada com sucesso.` });
      fetchAccounts();
    } catch (e: any) {
      toast({ title: 'Erro', description: e.message, variant: 'destructive' });
    } finally {
      setConnectingPageId(null);
    }
  };

  const handleAdd = async () => {
    if (!user || !newAccount.page_id || !newAccount.access_token) {
      toast({ title: 'Erro', description: 'Page ID e Access Token são obrigatórios', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.from('facebook_accounts').insert({
        user_id: user.id,
        page_name: newAccount.page_name || null,
        page_id: newAccount.page_id,
        access_token: newAccount.access_token,
        instagram_account_id: newAccount.instagram_account_id || null,
      } as any);
      if (error) throw error;
      toast({ title: 'Conta adicionada!' });
      setNewAccount({ page_name: '', page_id: '', access_token: '', instagram_account_id: '' });
      setShowAdd(false);
      fetchAccounts();
    } catch (e: any) {
      toast({ title: 'Erro', description: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    await supabase.from('facebook_accounts').delete().eq('id', id);
    toast({ title: 'Conta removida' });
    fetchAccounts();
  };

  const connected = accounts.length > 0;
  const connectedPageIds = new Set(accounts.map((a) => a.page_id));

  return (
    <ConnectionCard
      icon={<Facebook className="h-5 w-5 text-primary" />}
      title="Facebook & Instagram"
      description="Postagem automática nas redes sociais"
      connected={connected}
      connectedInfo={connected ? `${accounts.length} conta(s) conectada(s)` : undefined}
      onDisconnect={async () => {
        for (const acc of accounts) {
          await supabase.from('facebook_accounts').delete().eq('id', acc.id);
        }
        fetchAccounts();
      }}
    >
      <div className="space-y-3">
        <div className="rounded-lg border border-accent/40 bg-accent/10 p-3 text-xs text-muted-foreground">
          A conexão será feita em uma nova aba para evitar bloqueios de segurança do navegador.
        </div>


        {/* Primary OAuth action — always visible at top */}
        <div className="p-3 rounded-lg border border-primary/40 bg-gradient-to-br from-primary/10 to-accent/10">
          <div className="flex items-start gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground">Login com Facebook (recomendado)</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Conecta automaticamente todas as páginas do seu Business Manager. Tokens válidos por 60 dias.
              </p>
            </div>
            <Button
              size="sm"
              onClick={handleOAuthConnect}
              disabled={oauthLoading}
              className="gradient-primary shrink-0"
            >
              {oauthLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : accounts.length > 0 ? (
                <><RefreshCw className="h-4 w-4 mr-1.5" />Reconectar</>
              ) : (
                <><LogIn className="h-4 w-4 mr-1.5" />Conectar</>
              )}
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-4">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            {/* Validation Feedback */}
            {accounts.length > 0 && (
              <div className="p-3 rounded-lg border border-border bg-muted/30 mb-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-success" />
                    <span className="text-sm font-medium">Status da Conexão</span>
                  </div>
                  <Badge variant="outline" className="text-success border-success/30">Ativa</Badge>
                </div>
                <div className="space-y-1.5">
                  <p className="text-xs text-muted-foreground">
                    As permissões foram verificadas e o sistema está pronto para postar.
                  </p>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {['pages_manage_posts', 'instagram_content_publish', 'pages_show_list'].map(scope => (
                      <Badge key={scope} variant="secondary" className="text-[10px] h-4 bg-primary/5 text-primary/70 border-primary/10">
                        {scope}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Connected accounts */}
            {accounts.map((acc) => (
              <div key={acc.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border border-border">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${acc.is_active ? 'bg-success' : 'bg-destructive'}`} />
                    <p className="text-sm font-medium text-foreground truncate">
                      {acc.page_name || `Page ${acc.page_id}`}
                    </p>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">ID: {acc.page_id}</p>
                  {acc.instagram_account_id && (
                    <div className="flex items-center gap-1 mt-0.5">
                      <Instagram className="h-3 w-3 text-muted-foreground" />
                      <p className="text-xs text-muted-foreground">{acc.instagram_account_id}</p>
                    </div>
                  )}
                </div>
                <Button size="sm" variant="ghost" className="text-destructive shrink-0" onClick={() => handleDelete(acc.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}

            {/* Discover pages from Meta */}
            {showDiscover ? (
              <div className="space-y-3 p-3 rounded-lg border border-primary/30 bg-primary/5">
                <div className="flex items-center gap-2 mb-1">
                  <Search className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium text-foreground">Descobrir Páginas da Meta</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Cole seu <strong>User Access Token</strong> do Meta para listar todas as páginas que você administra.
                </p>
                <div className="space-y-1.5">
                  <Label className="text-xs">User Access Token</Label>
                  <PasswordInput
                    placeholder="EAAxxxxxxx..."
                    value={userAccessToken}
                    onChange={(e) => setUserAccessToken(e.target.value)}
                    className="h-9 text-sm"
                  />
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={handleDiscoverPages} disabled={discoverLoading} className="gradient-primary">
                    {discoverLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4 mr-1" />}
                    Buscar Páginas
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => { setShowDiscover(false); setMetaPages([]); setUserAccessToken(''); }}>
                    Cancelar
                  </Button>
                </div>

                {/* Meta pages list */}
                {metaPages.length > 0 && (
                  <div className="space-y-2 mt-2">
                    <p className="text-xs font-medium text-foreground">{metaPages.length} página(s) encontrada(s):</p>
                    {metaPages.map((page) => {
                      const alreadyConnected = connectedPageIds.has(page.page_id);
                      return (
                        <div key={page.page_id} className="flex items-center gap-3 p-3 rounded-lg bg-background border border-border">
                          {page.picture_url ? (
                            <img src={page.picture_url} alt={page.page_name} className="w-10 h-10 rounded-lg object-cover" />
                          ) : (
                            <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                              <Facebook className="h-5 w-5 text-muted-foreground" />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">{page.page_name}</p>
                            <div className="flex items-center gap-2 mt-0.5">
                              {page.category && (
                                <Badge variant="secondary" className="text-[10px] h-4">{page.category}</Badge>
                              )}
                              <span className="text-xs text-muted-foreground flex items-center gap-1">
                                <Users className="h-3 w-3" /> {page.fan_count.toLocaleString()}
                              </span>
                            </div>
                            {page.instagram && (
                              <div className="flex items-center gap-1.5 mt-1">
                                <Instagram className="h-3 w-3 text-muted-foreground" />
                                <span className="text-xs text-muted-foreground">@{page.instagram.username}</span>
                                <span className="text-xs text-muted-foreground">• {page.instagram.followers_count.toLocaleString()} seguidores</span>
                              </div>
                            )}
                          </div>
                          {alreadyConnected ? (
                            <Badge variant="outline" className="shrink-0 text-success border-success/30">
                              <CheckCircle2 className="h-3 w-3 mr-1" /> Conectada
                            </Badge>
                          ) : (
                            <Button
                              size="sm"
                              onClick={() => handleConnectPage(page)}
                              disabled={connectingPageId === page.page_id}
                              className="shrink-0 gradient-primary"
                            >
                              {connectingPageId === page.page_id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Plus className="h-4 w-4 mr-1" />
                              )}
                              Conectar
                            </Button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : showAdd ? (
              <div className="space-y-3 p-3 rounded-lg border border-primary/30 bg-primary/5">
                <div className="space-y-1.5">
                  <Label className="text-xs">Nome da Página (opcional)</Label>
                  <Input placeholder="Minha Página" value={newAccount.page_name} onChange={(e) => setNewAccount((p) => ({ ...p, page_name: e.target.value }))} className="h-9 text-sm" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Page ID *</Label>
                  <Input placeholder="123456789" value={newAccount.page_id} onChange={(e) => setNewAccount((p) => ({ ...p, page_id: e.target.value }))} className="h-9 text-sm" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Access Token *</Label>
                  <PasswordInput placeholder="EAAxxxxxxx..." value={newAccount.access_token} onChange={(e) => setNewAccount((p) => ({ ...p, access_token: e.target.value }))} className="h-9 text-sm" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Instagram Business Account ID</Label>
                  <Input placeholder="17841400000000" value={newAccount.instagram_account_id} onChange={(e) => setNewAccount((p) => ({ ...p, instagram_account_id: e.target.value }))} className="h-9 text-sm" />
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={handleAdd} disabled={saving} className="gradient-primary">
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Salvar'}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setShowAdd(false)}>Cancelar</Button>
                </div>
              </div>
            ) : (
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="flex-1" onClick={() => setShowDiscover(true)}>
                  <Search className="h-4 w-4 mr-2" />
                  Descobrir Páginas
                </Button>
                <Button variant="outline" size="sm" className="flex-1" onClick={() => setShowAdd(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Adicionar Manual
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </ConnectionCard>
  );
};

export default FacebookSettings;
