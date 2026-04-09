import { useEffect, useState } from 'react';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Facebook, Plus, Trash2, Loader2 } from 'lucide-react';
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

interface Props {
  settings: UserSettings;
  onChange: (partial: Partial<UserSettings>) => void;
}

const FacebookSettings = ({ settings, onChange }: Props) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [accounts, setAccounts] = useState<FacebookAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [newAccount, setNewAccount] = useState({ page_name: '', page_id: '', access_token: '', instagram_account_id: '' });
  const [saving, setSaving] = useState(false);

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
        {loading ? (
          <div className="flex justify-center py-4">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
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
                    <p className="text-xs text-muted-foreground">IG: {acc.instagram_account_id}</p>
                  )}
                </div>
                <Button size="sm" variant="ghost" className="text-destructive shrink-0" onClick={() => handleDelete(acc.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}

            {showAdd ? (
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
                  <Input type="password" placeholder="EAAxxxxxxx..." value={newAccount.access_token} onChange={(e) => setNewAccount((p) => ({ ...p, access_token: e.target.value }))} className="h-9 text-sm" />
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
              <Button variant="outline" size="sm" className="w-full" onClick={() => setShowAdd(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Adicionar Conta
              </Button>
            )}
          </>
        )}
      </div>
    </ConnectionCard>
  );
};

export default FacebookSettings;
