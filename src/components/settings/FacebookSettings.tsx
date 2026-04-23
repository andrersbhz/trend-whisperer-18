import { useEffect, useRef, useState } from 'react';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Facebook, Plus, Trash2, Loader2, Search, Instagram, Users, CheckCircle2, LogIn, RefreshCw } from 'lucide-react';
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
    const onMessage = (e: MessageEvent) => {
      if (e.data?.type === 'fb-oauth-done') {
        clearPopupWatcher();
        if (e.data.success) {
          toast({ title: 'Facebook conectado!', description: 'Páginas e tokens importados com sucesso.' });
          fetchAccounts();
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
    // Open popup synchronously (required to avoid popup blockers)
    const popup = window.open('about:blank', 'facebook-oauth', getPopupFeatures());
    if (!popup) {
      setOauthLoading(false);
      toast({
        title: 'Popup bloqueado',
        description: 'Permita popups para este site e tente novamente.',
        variant: 'destructive',
      });
      return;
    }
    popupRef.current = popup;

    try {
      popup.document.write(`<!doctype html><html><head><title>Conectando ao Facebook…</title><meta charset="utf-8"/></head><body style="font-family:-apple-system,sans-serif;background:#0b0b14;color:#e5e5e5;display:flex;align-items:center;justify-content:center;height:100vh;margin:0"><div style="text-align:center"><div style="font-size:2rem">⏳</div><p>Preparando conexão segura…</p></div></body></html>`);
    } catch {}

    try {
      const authUrl = await requestFacebookAuthUrl(returnUrl);
      popup.location.href = authUrl;
      popup.focus();
      watchPopupClosed(popup);
    } catch (e: any) {
      try { popup.close(); } catch {}
      setOauthLoading(false);
      toast({ title: 'Erro', description: e.message, variant: 'destructive' });
    }
  };

  const handleOAuthConnect = async () => {
    if (oauthLoading) return;
    setOauthLoading(true);
    await startOauthPopup();
  };

  const handleDiscoverPages = async () => {
    if (!userAccessToken) {
      toast({ title: 'Erro', description: 'Insira seu User Access Token da Meta', variant: 'destructive' });
      return;
    }
    setDiscoverLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('fetch-meta-pages', {
        body: { accessToken: userAccessToken },
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
        if (!confirm('Tem certeza que deseja desconectar todas as contas do Facebook?')) return;
        for (const acc of accounts) {
          await supabase.from('facebook_accounts').delete().eq('id', acc.id);
        }
        fetchAccounts();
      }}
    >
      <div className="space-y-4">
        {/* Connection Action */}
        <div className="p-3 rounded-lg border border-primary/40 bg-gradient-to-br from-primary/10 to-accent/10">
          <div className="flex items-start gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground">
                {accounts.length > 0 ? "Atualizar conexão com Facebook" : "Login com Facebook (recomendado)"}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Conecta automaticamente todas as páginas do seu Business Manager. Tokens válidos por 60 dias.
              </p>
            </div>
            <Button 
              onClick={handleOAuthConnect}
              disabled={oauthLoading}
              className="inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 bg-primary text-primary-foreground hover:bg-primary/90 h-9 rounded-md px-3 gradient-primary shrink-0"
            >
              {oauthLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <LogIn className="h-4 w-4 mr-1.5" />
                  {accounts.length > 0 ? "Atualizar" : "Conectar"}
                </>
              )}
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="h-6 w-6 animate-spin text-primary/60" />
          </div>
        ) : (
          <>
            {/* Connected accounts */}
            {accounts.length > 0 && (
              <div className="space-y-2">
                <h5 className="text-xs font-medium text-muted-foreground px-1 uppercase tracking-wider">Contas Ativas</h5>
                {accounts.map((acc) => (
                  <div key={acc.id} className="group flex items-center justify-between p-3.5 rounded-xl bg-muted/40 border border-border/50 hover:border-primary/30 transition-all">
                    <div className="min-w-0 flex-1 flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-primary/5 flex items-center justify-center border border-primary/10">
                        <Facebook className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-foreground truncate">
                            {acc.page_name || `Página ${acc.page_id}`}
                          </p>
                          {acc.is_active && (
                            <Badge variant="outline" className="h-4 px-1.5 text-[10px] bg-success/10 text-success border-success/20">Ativo</Badge>
                          )}
                        </div>
                        <p className="text-[10px] text-muted-foreground font-mono">ID: {acc.page_id}</p>
                        {acc.instagram_account_id && (
                          <div className="flex items-center gap-1 mt-0.5">
                            <Instagram className="h-3 w-3 text-primary/60" />
                            <p className="text-[10px] text-muted-foreground truncate">Conectado ao Instagram</p>
                          </div>
                        )}
                      </div>
                    </div>
                    <Button 
                      size="sm" 
                      variant="ghost" 
                      className="opacity-0 group-hover:opacity-100 text-destructive hover:bg-destructive/10 shrink-0 transition-opacity" 
                      onClick={() => {
                        if (confirm(`Remover conexão com ${acc.page_name || acc.page_id}?`)) {
                          handleDelete(acc.id);
                        }
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            {/* Advanced Options Toggle */}
            <div className="flex justify-center pt-2">
              <Button 
                variant="ghost" 
                size="sm" 
                className="text-[11px] text-muted-foreground h-7"
                onClick={() => setShowDiscover(!showDiscover)}
              >
                {showDiscover ? "Ocultar opções avançadas" : "Opções de conexão manual (Avançado)"}
              </Button>
            </div>

            {/* Discover pages from Meta (Now hidden in advanced) */}
            {showDiscover && (
              <div className="space-y-4 p-4 rounded-xl border border-border bg-muted/30 animate-in fade-in slide-in-from-top-2 duration-300">
                <div className="flex items-center gap-2 mb-1">
                  <Search className="h-4 w-4 text-primary" />
                  <span className="text-sm font-semibold text-foreground">Conexão via User Access Token</span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Caso o login automático não encontre sua página, você pode usar um <strong>User Access Token</strong> do Meta for Developers.
                </p>
                <div className="space-y-1.5">
                  <Label className="text-[11px] font-medium uppercase tracking-tight text-muted-foreground">User Access Token</Label>
                  <PasswordInput
                    placeholder="EAAxxxxxxx..."
                    value={userAccessToken}
                    onChange={(e) => setUserAccessToken(e.target.value)}
                    className="h-10 text-sm bg-background border-border/60"
                  />
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={handleDiscoverPages} disabled={discoverLoading} className="gradient-primary">
                    {discoverLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Search className="h-4 w-4 mr-2" />}
                    Buscar Páginas
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => { setShowDiscover(false); setMetaPages([]); setUserAccessToken(''); }}>
                    Cancelar
                  </Button>
                </div>

                {/* Meta pages list */}
                {metaPages.length > 0 && (
                  <div className="space-y-2.5 mt-4 pt-4 border-t border-border/60">
                    <p className="text-xs font-semibold text-foreground uppercase tracking-wider">{metaPages.length} página(s) disponível(is):</p>
                    <div className="grid gap-2">
                      {metaPages.map((page) => {
                        const alreadyConnected = connectedPageIds.has(page.page_id);
                        return (
                          <div key={page.page_id} className="flex items-center gap-3 p-3 rounded-lg bg-background border border-border/80 shadow-sm">
                            {page.picture_url ? (
                              <img src={page.picture_url} alt={page.page_name} className="w-10 h-10 rounded-lg object-cover border border-border/50" />
                            ) : (
                              <div className="w-10 h-10 rounded-lg bg-primary/5 flex items-center justify-center border border-primary/10">
                                <Facebook className="h-5 w-5 text-primary" />
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-foreground truncate">{page.page_name}</p>
                              <div className="flex items-center gap-2 mt-0.5">
                                {page.category && (
                                  <Badge variant="secondary" className="text-[9px] h-3.5 px-1 bg-muted/60 text-muted-foreground font-normal border-none">{page.category}</Badge>
                                )}
                                <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                                  <Users className="h-2.5 w-2.5" /> {page.fan_count.toLocaleString()}
                                </span>
                              </div>
                            </div>
                            {alreadyConnected ? (
                              <Badge variant="outline" className="shrink-0 text-success border-success/30 bg-success/5 h-6 px-2">
                                <CheckCircle2 className="h-3 w-3 mr-1" /> Conectada
                              </Badge>
                            ) : (
                              <Button
                                size="sm"
                                onClick={() => handleConnectPage(page)}
                                disabled={connectingPageId === page.page_id}
                                className="shrink-0 gradient-primary h-8"
                              >
                                {connectingPageId === page.page_id ? (
                                  <Loader2 className="h-3 w-3 animate-spin mr-1.5" />
                                ) : (
                                  <Plus className="h-3 w-3 mr-1.5" />
                                )}
                                Conectar
                              </Button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </ConnectionCard>
  );
};

export default FacebookSettings;
