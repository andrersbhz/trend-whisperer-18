import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { getErrorMessage, runBackendMutation, runBackendQuery } from '@/lib/backend';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Smartphone,
  Plus,
  Trash2,
  Send,
  Loader2,
  Wifi,
  WifiOff,
  MessageCircle,
  Flame,
  Phone,
} from 'lucide-react';

interface PhoneChip {
  id: string;
  ddd: string;
  phone_number: string;
  full_number: string;
  status: string;
  whatsapp_active: boolean;
  activated_at: string | null;
  created_at: string;
}

interface WarmupNumber {
  id: string;
  ddd: string;
  phone_number: string;
  full_number: string;
  label: string | null;
  status: string;
  last_message_at: string | null;
  message_count: number;
  created_at: string;
}

const statusColors: Record<string, string> = {
  pending: 'bg-warning/20 text-warning border-warning/30',
  sent: 'bg-primary/20 text-primary border-primary/30',
  active: 'bg-[hsl(var(--success))]/20 text-[hsl(var(--success))] border-[hsl(var(--success))]/30',
  failed: 'bg-destructive/20 text-destructive border-destructive/30',
  inactive: 'bg-muted text-muted-foreground border-border',
  warming: 'bg-[hsl(30,100%,50%)]/20 text-[hsl(30,100%,50%)] border-[hsl(30,100%,50%)]/30',
};

const statusLabels: Record<string, string> = {
  pending: 'Pendente',
  sent: 'SMS Enviado',
  active: 'Ativo',
  failed: 'Falhou',
  inactive: 'Inativo',
  warming: 'Aquecendo',
};

const ChipsPage = () => {
  const { user } = useAuth();
  const { toast } = useToast();

  // Chips state
  const [chips, setChips] = useState<PhoneChip[]>([]);
  const [chipDdd, setChipDdd] = useState('');
  const [chipNumber, setChipNumber] = useState('');
  const [loadingChips, setLoadingChips] = useState(true);
  const [connectingId, setConnectingId] = useState<string | null>(null);
  const [addingChip, setAddingChip] = useState(false);

  // Warmup state
  const [warmups, setWarmups] = useState<WarmupNumber[]>([]);
  const [warmupDdd, setWarmupDdd] = useState('');
  const [warmupNumber, setWarmupNumber] = useState('');
  const [warmupLabel, setWarmupLabel] = useState('');
  const [loadingWarmups, setLoadingWarmups] = useState(true);
  const [addingWarmup, setAddingWarmup] = useState(false);
  const [connectingWarmupId, setConnectingWarmupId] = useState<string | null>(null);

  const fetchData = async () => {
    if (!user) return;
    try {
      const [chipsData, warmupsData] = await Promise.all([
        runBackendQuery(() =>
          supabase
            .from('phone_chips')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false }),
        ),
        runBackendQuery(() =>
          supabase
            .from('warmup_numbers')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false }),
        ),
      ]);
      setChips((chipsData as PhoneChip[]) || []);
      setWarmups((warmupsData as WarmupNumber[]) || []);
    } catch (error) {
      toast({ title: 'Erro ao carregar dados', description: getErrorMessage(error), variant: 'destructive' });
    } finally {
      setLoadingChips(false);
      setLoadingWarmups(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [user]);

  const addChip = async () => {
    if (!user || !chipDdd || !chipNumber) return;
    setAddingChip(true);
    try {
      await runBackendMutation(() =>
        supabase.from('phone_chips').insert({
          user_id: user.id,
          ddd: chipDdd.replace(/\D/g, ''),
          phone_number: chipNumber.replace(/\D/g, ''),
        }),
      );
      setChipDdd('');
      setChipNumber('');
      toast({ title: 'Chip adicionado!' });
      fetchData();
    } catch (error) {
      toast({ title: 'Erro', description: getErrorMessage(error), variant: 'destructive' });
    } finally {
      setAddingChip(false);
    }
  };

  const connectChip = async (chip: PhoneChip) => {
    setConnectingId(chip.id);
    try {
      // Update status to "sent" (SMS sending simulation — integrate Twilio later)
      await runBackendMutation(() =>
        supabase.from('phone_chips').update({ status: 'sent' }).eq('id', chip.id),
      );
      toast({
        title: 'SMS de ativação enviado!',
        description: `Enviado para (${chip.ddd}) ${chip.phone_number}. Aguarde a confirmação.`,
      });
      fetchData();
    } catch (error) {
      toast({ title: 'Erro ao conectar', description: getErrorMessage(error), variant: 'destructive' });
    } finally {
      setConnectingId(null);
    }
  };

  const deleteChip = async (id: string) => {
    try {
      await runBackendMutation(() => supabase.from('phone_chips').delete().eq('id', id));
      toast({ title: 'Chip removido' });
      fetchData();
    } catch (error) {
      toast({ title: 'Erro', description: getErrorMessage(error), variant: 'destructive' });
    }
  };

  const addWarmup = async () => {
    if (!user || !warmupDdd || !warmupNumber) return;
    setAddingWarmup(true);
    try {
      await runBackendMutation(() =>
        supabase.from('warmup_numbers').insert({
          user_id: user.id,
          ddd: warmupDdd.replace(/\D/g, ''),
          phone_number: warmupNumber.replace(/\D/g, ''),
          label: warmupLabel || null,
        }),
      );
      setWarmupDdd('');
      setWarmupNumber('');
      setWarmupLabel('');
      toast({ title: 'Número cadastrado para aquecimento!' });
      fetchData();
    } catch (error) {
      toast({ title: 'Erro', description: getErrorMessage(error), variant: 'destructive' });
    } finally {
      setAddingWarmup(false);
    }
  };

  const connectWarmup = async (warmup: WarmupNumber) => {
    setConnectingWarmupId(warmup.id);
    try {
      await runBackendMutation(() =>
        supabase.from('warmup_numbers').update({ status: 'warming' }).eq('id', warmup.id),
      );
      toast({
        title: 'Aquecimento iniciado!',
        description: `Número (${warmup.ddd}) ${warmup.phone_number} em aquecimento.`,
      });
      fetchData();
    } catch (error) {
      toast({ title: 'Erro', description: getErrorMessage(error), variant: 'destructive' });
    } finally {
      setConnectingWarmupId(null);
    }
  };

  const deleteWarmup = async (id: string) => {
    try {
      await runBackendMutation(() => supabase.from('warmup_numbers').delete().eq('id', id));
      toast({ title: 'Número removido' });
      fetchData();
    } catch (error) {
      toast({ title: 'Erro', description: getErrorMessage(error), variant: 'destructive' });
    }
  };

  if (loadingChips || loadingWarmups) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Chips & WhatsApp</h1>
        <p className="text-muted-foreground text-sm mt-1">Gerencie chips, conecte números e aqueça para WhatsApp</p>
      </div>

      {/* ========== CONECTAR CHIPS ========== */}
      <Card className="glass border-[hsl(30,100%,50%)]/30 shadow-[0_0_20px_hsl(30,100%,50%,0.1)]">
        <CardHeader className="p-[25px] pb-2">
          <CardTitle className="flex items-center gap-2 text-xl">
            <div className="p-2 rounded-lg bg-[hsl(30,100%,50%)]/20">
              <Smartphone className="h-5 w-5 text-[hsl(30,100%,50%)]" />
            </div>
            Conectar Chips
          </CardTitle>
          <CardDescription>Adicione o DDD e número, clique em Conectar para enviar SMS de ativação do WhatsApp</CardDescription>
        </CardHeader>
        <CardContent className="p-[25px] pt-4 space-y-5">
          {/* Input row */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="w-28">
              <Label className="text-xs text-muted-foreground mb-1 block">DDD</Label>
              <Input
                placeholder="11"
                maxLength={3}
                value={chipDdd}
                onChange={(e) => setChipDdd(e.target.value.replace(/\D/g, ''))}
                className="bg-secondary/50 border-border text-center font-mono text-lg"
              />
            </div>
            <div className="flex-1">
              <Label className="text-xs text-muted-foreground mb-1 block">Número</Label>
              <Input
                placeholder="999999999"
                maxLength={9}
                value={chipNumber}
                onChange={(e) => setChipNumber(e.target.value.replace(/\D/g, ''))}
                className="bg-secondary/50 border-border font-mono text-lg"
              />
            </div>
            <div className="flex items-end">
              <Button
                onClick={addChip}
                disabled={!chipDdd || !chipNumber || addingChip}
                className="w-full sm:w-auto bg-[hsl(30,100%,50%)] hover:bg-[hsl(30,100%,45%)] text-white font-semibold shadow-[0_0_15px_hsl(30,100%,50%,0.4)] transition-all"
              >
                {addingChip ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
                Adicionar
              </Button>
            </div>
          </div>

          {/* Chips cards */}
          {chips.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              <Phone className="h-10 w-10 mx-auto mb-2 opacity-30" />
              Nenhum chip cadastrado ainda
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {chips.map((chip) => (
                <div
                  key={chip.id}
                  className="glass rounded-xl p-[25px] border border-[hsl(30,100%,50%)]/20 hover:border-[hsl(30,100%,50%)]/40 transition-all group"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="font-mono text-lg font-bold text-foreground">
                        ({chip.ddd}) {chip.phone_number}
                      </p>
                      <Badge className={`mt-1 text-xs ${statusColors[chip.status] || statusColors.pending}`}>
                        {chip.whatsapp_active ? <Wifi className="h-3 w-3 mr-1" /> : <WifiOff className="h-3 w-3 mr-1" />}
                        {statusLabels[chip.status] || chip.status}
                      </Badge>
                    </div>
                    <button
                      onClick={() => deleteChip(chip.id)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => connectChip(chip)}
                    disabled={chip.status === 'active' || connectingId === chip.id}
                    className="w-full bg-white/90 hover:bg-white text-[hsl(30,100%,40%)] font-semibold shadow-[0_0_12px_hsl(0,0%,100%,0.2)] border border-white/30"
                  >
                    {connectingId === chip.id ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <Send className="h-4 w-4 mr-2" />
                    )}
                    Conectar
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ========== AQUECIMENTO DE NÚMEROS ========== */}
      <Card className="glass border-primary/30 shadow-[0_0_20px_hsl(var(--primary),0.1)]">
        <CardHeader className="p-[25px] pb-2">
          <CardTitle className="flex items-center gap-2 text-xl">
            <div className="p-2 rounded-lg bg-primary/20">
              <Flame className="h-5 w-5 text-primary" />
            </div>
            Aquecimento de Números
          </CardTitle>
          <CardDescription>Cadastre números para aquecimento automático do WhatsApp</CardDescription>
        </CardHeader>
        <CardContent className="p-[25px] pt-4 space-y-5">
          {/* Input row */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="w-28">
              <Label className="text-xs text-muted-foreground mb-1 block">DDD</Label>
              <Input
                placeholder="11"
                maxLength={3}
                value={warmupDdd}
                onChange={(e) => setWarmupDdd(e.target.value.replace(/\D/g, ''))}
                className="bg-secondary/50 border-border text-center font-mono text-lg"
              />
            </div>
            <div className="flex-1">
              <Label className="text-xs text-muted-foreground mb-1 block">Número</Label>
              <Input
                placeholder="999999999"
                maxLength={9}
                value={warmupNumber}
                onChange={(e) => setWarmupNumber(e.target.value.replace(/\D/g, ''))}
                className="bg-secondary/50 border-border font-mono text-lg"
              />
            </div>
            <div className="flex-1">
              <Label className="text-xs text-muted-foreground mb-1 block">Rótulo (opcional)</Label>
              <Input
                placeholder="Ex: Chip vendas"
                value={warmupLabel}
                onChange={(e) => setWarmupLabel(e.target.value)}
                className="bg-secondary/50 border-border"
              />
            </div>
            <div className="flex items-end">
              <Button
                onClick={addWarmup}
                disabled={!warmupDdd || !warmupNumber || addingWarmup}
                className="w-full sm:w-auto bg-[hsl(30,100%,50%)] hover:bg-[hsl(30,100%,45%)] text-white font-semibold shadow-[0_0_15px_hsl(30,100%,50%,0.4)] transition-all"
              >
                {addingWarmup ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
                Cadastrar
              </Button>
            </div>
          </div>

          {/* Warmup cards */}
          {warmups.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              <MessageCircle className="h-10 w-10 mx-auto mb-2 opacity-30" />
              Nenhum número cadastrado para aquecimento
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {warmups.map((w) => (
                <div
                  key={w.id}
                  className="glass rounded-xl p-[25px] border border-primary/20 hover:border-primary/40 transition-all group"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="font-mono text-lg font-bold text-foreground">
                        ({w.ddd}) {w.phone_number}
                      </p>
                      {w.label && <p className="text-xs text-muted-foreground mt-0.5">{w.label}</p>}
                      <div className="flex items-center gap-2 mt-1">
                        <Badge className={`text-xs ${statusColors[w.status] || statusColors.inactive}`}>
                          {statusLabels[w.status] || w.status}
                        </Badge>
                        {w.message_count > 0 && (
                          <span className="text-xs text-muted-foreground">{w.message_count} msgs</span>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => deleteWarmup(w.id)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => connectWarmup(w)}
                    disabled={w.status === 'warming' || connectingWarmupId === w.id}
                    className="w-full bg-white/90 hover:bg-white text-[hsl(30,100%,40%)] font-semibold shadow-[0_0_12px_hsl(0,0%,100%,0.2)] border border-white/30"
                  >
                    {connectingWarmupId === w.id ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <Send className="h-4 w-4 mr-2" />
                    )}
                    Conectar
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

export default ChipsPage;
