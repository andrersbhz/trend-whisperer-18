import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { getErrorMessage, runBackendQuery, runBackendMutation } from '@/lib/backend';
import { Phone, Plus, Trash2, Loader2 } from 'lucide-react';

interface Terminal {
  id: string;
  country_code: string;
  ddd: string;
  phone_number: string;
  label: string | null;
  created_at: string;
}

const TerminalsPage = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [terminals, setTerminals] = useState<Terminal[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [ddd, setDdd] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [label, setLabel] = useState('');

  const fetchTerminals = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const data = await runBackendQuery(() =>
        supabase
          .from('terminals' as any)
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
      );
      setTerminals((data as any[]) || []);
    } catch (error) {
      toast({ title: 'Erro ao carregar terminais', description: getErrorMessage(error), variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTerminals();
  }, [user]);

  const handleAdd = async () => {
    if (!user) return;
    const cleanDdd = ddd.trim().replace(/\D/g, '');
    const cleanPhone = phoneNumber.trim().replace(/\D/g, '');

    if (!cleanDdd || cleanDdd.length < 2) {
      toast({ title: 'DDD inválido', description: 'Informe um DDD válido com 2 dígitos.', variant: 'destructive' });
      return;
    }
    if (!cleanPhone || cleanPhone.length < 8) {
      toast({ title: 'Número inválido', description: 'Informe um número de celular válido.', variant: 'destructive' });
      return;
    }

    setSaving(true);
    try {
      await runBackendMutation(() =>
        supabase.from('terminals' as any).insert({
          user_id: user.id,
          country_code: '+55',
          ddd: cleanDdd,
          phone_number: cleanPhone,
          label: label.trim() || null,
        } as any)
      );
      toast({ title: 'Terminal adicionado!' });
      setDdd('');
      setPhoneNumber('');
      setLabel('');
      fetchTerminals();
    } catch (error) {
      toast({ title: 'Erro ao salvar', description: getErrorMessage(error), variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!user) return;
    try {
      await runBackendMutation(() =>
        supabase.from('terminals' as any).delete().eq('id', id).eq('user_id', user.id)
      );
      toast({ title: 'Terminal removido' });
      setTerminals((prev) => prev.filter((t) => t.id !== id));
    } catch (error) {
      toast({ title: 'Erro ao remover', description: getErrorMessage(error), variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold neon-text-lilac">Terminais</h1>
        <p className="text-muted-foreground text-sm mt-1">Cadastre seus números de telefone</p>
      </div>

      <Card className="glass-card neon-border-lilac">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Plus className="h-4 w-4" /> Adicionar Número
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 items-end">
            <div>
              <Label className="text-muted-foreground text-xs">País</Label>
              <Input value="+55" disabled className="bg-secondary/50 mt-1" />
            </div>
            <div>
              <Label className="text-muted-foreground text-xs">DDD</Label>
              <Input
                placeholder="11"
                value={ddd}
                onChange={(e) => setDdd(e.target.value.replace(/\D/g, '').slice(0, 2))}
                maxLength={2}
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-muted-foreground text-xs">Número</Label>
              <Input
                placeholder="999999999"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, '').slice(0, 9))}
                maxLength={9}
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-muted-foreground text-xs">Apelido (opcional)</Label>
              <Input
                placeholder="Meu celular"
                value={label}
                onChange={(e) => setLabel(e.target.value.slice(0, 50))}
                maxLength={50}
                className="mt-1"
              />
            </div>
          </div>
          <Button onClick={handleAdd} disabled={saving} className="gradient-primary text-primary-foreground">
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
            Adicionar
          </Button>
        </CardContent>
      </Card>

      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Phone className="h-4 w-4" /> Números Cadastrados
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center gap-2 text-muted-foreground py-4">
              <Loader2 className="h-4 w-4 animate-spin" /> Carregando...
            </div>
          ) : terminals.length === 0 ? (
            <p className="text-muted-foreground text-sm py-4">Nenhum número cadastrado ainda.</p>
          ) : (
            <div className="space-y-2">
              {terminals.map((t) => (
                <div
                  key={t.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-secondary/30 border border-border/50"
                >
                  <div className="flex items-center gap-3">
                    <Phone className="h-4 w-4 text-primary" />
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        {t.country_code} ({t.ddd}) {t.phone_number}
                      </p>
                      {t.label && (
                        <p className="text-xs text-muted-foreground">{t.label}</p>
                      )}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(t.id)}
                    className="text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default TerminalsPage;
