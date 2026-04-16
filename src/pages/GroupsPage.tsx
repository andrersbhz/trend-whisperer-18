import { useEffect, useState, useRef } from 'react';
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
  Users,
  Plus,
  Trash2,
  Send,
  Loader2,
  MessageCircle,
  ArrowLeft,
  Smartphone,
  UserPlus,
} from 'lucide-react';

interface ChipGroup {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
}

interface GroupMember {
  id: string;
  chip_id: string;
  group_id: string;
  phone_chips?: { ddd: string; phone_number: string; status: string } | null;
}

interface ChatMessage {
  id: string;
  group_id: string;
  sender_chip_id: string | null;
  content: string;
  message_type: string;
  created_at: string;
}

interface PhoneChip {
  id: string;
  ddd: string;
  phone_number: string;
  status: string;
}

const GroupsPage = () => {
  const { user } = useAuth();
  const { toast } = useToast();

  const [groups, setGroups] = useState<ChipGroup[]>([]);
  const [chips, setChips] = useState<PhoneChip[]>([]);
  const [loading, setLoading] = useState(true);
  const [groupName, setGroupName] = useState('');
  const [groupDesc, setGroupDesc] = useState('');
  const [adding, setAdding] = useState(false);

  // Selected group for chat
  const [selectedGroup, setSelectedGroup] = useState<ChipGroup | null>(null);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [addingChipId, setAddingChipId] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const fetchGroups = async () => {
    if (!user) return;
    try {
      const data = await runBackendQuery(() =>
        supabase.from('chip_groups').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
      );
      setGroups((data as ChipGroup[]) || []);
    } catch (error) {
      toast({ title: 'Erro ao carregar grupos', description: getErrorMessage(error), variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const fetchChips = async () => {
    if (!user) return;
    try {
      const data = await runBackendQuery(() =>
        supabase.from('phone_chips').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
      );
      setChips((data as PhoneChip[]) || []);
    } catch {
      // silent
    }
  };

  const fetchGroupDetails = async (group: ChipGroup) => {
    if (!user) return;
    try {
      const [membersData, messagesData] = await Promise.all([
        runBackendQuery(() =>
          supabase
            .from('chip_group_members')
            .select('*, phone_chips(ddd, phone_number, status)')
            .eq('group_id', group.id)
            .eq('user_id', user.id),
        ),
        runBackendQuery(() =>
          supabase
            .from('chat_messages')
            .select('*')
            .eq('group_id', group.id)
            .eq('user_id', user.id)
            .order('created_at', { ascending: true }),
        ),
      ]);
      setMembers((membersData as GroupMember[]) || []);
      setMessages((messagesData as ChatMessage[]) || []);
    } catch (error) {
      toast({ title: 'Erro', description: getErrorMessage(error), variant: 'destructive' });
    }
  };

  useEffect(() => {
    fetchGroups();
    fetchChips();
  }, [user]);

  // Realtime subscription for messages
  useEffect(() => {
    if (!selectedGroup) return;

    const channel = supabase
      .channel(`chat-${selectedGroup.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `group_id=eq.${selectedGroup.id}` },
        (payload) => {
          setMessages((prev) => [...prev, payload.new as ChatMessage]);
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedGroup]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const createGroup = async () => {
    if (!user || !groupName.trim()) return;
    setAdding(true);
    try {
      await runBackendMutation(() =>
        supabase.from('chip_groups').insert({ user_id: user.id, name: groupName.trim(), description: groupDesc.trim() || null }),
      );
      setGroupName('');
      setGroupDesc('');
      toast({ title: 'Grupo criado!' });
      fetchGroups();
    } catch (error) {
      toast({ title: 'Erro', description: getErrorMessage(error), variant: 'destructive' });
    } finally {
      setAdding(false);
    }
  };

  const deleteGroup = async (id: string) => {
    try {
      await runBackendMutation(() => supabase.from('chip_groups').delete().eq('id', id));
      toast({ title: 'Grupo removido' });
      if (selectedGroup?.id === id) setSelectedGroup(null);
      fetchGroups();
    } catch (error) {
      toast({ title: 'Erro', description: getErrorMessage(error), variant: 'destructive' });
    }
  };

  const openGroup = (group: ChipGroup) => {
    setSelectedGroup(group);
    fetchGroupDetails(group);
  };

  const addChipToGroup = async () => {
    if (!user || !selectedGroup || !addingChipId) return;
    try {
      await runBackendMutation(() =>
        supabase.from('chip_group_members').insert({ group_id: selectedGroup.id, chip_id: addingChipId, user_id: user.id }),
      );
      setAddingChipId('');
      toast({ title: 'Chip adicionado ao grupo!' });
      fetchGroupDetails(selectedGroup);
    } catch (error) {
      toast({ title: 'Erro', description: getErrorMessage(error), variant: 'destructive' });
    }
  };

  const removeChipFromGroup = async (memberId: string) => {
    try {
      await runBackendMutation(() => supabase.from('chip_group_members').delete().eq('id', memberId));
      toast({ title: 'Chip removido do grupo' });
      if (selectedGroup) fetchGroupDetails(selectedGroup);
    } catch (error) {
      toast({ title: 'Erro', description: getErrorMessage(error), variant: 'destructive' });
    }
  };

  const sendMessage = async () => {
    if (!user || !selectedGroup || !newMessage.trim()) return;
    setSending(true);
    try {
      await runBackendMutation(() =>
        supabase.from('chat_messages').insert({
          group_id: selectedGroup.id,
          user_id: user.id,
          content: newMessage.trim(),
          sender_chip_id: members[0]?.chip_id || null,
        }),
      );
      setNewMessage('');
    } catch (error) {
      toast({ title: 'Erro ao enviar', description: getErrorMessage(error), variant: 'destructive' });
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // ========== CHAT VIEW ==========
  if (selectedGroup) {
    const availableChips = chips.filter((c) => !members.some((m) => m.chip_id === c.id));

    return (
      <div className="space-y-6 max-w-4xl">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => setSelectedGroup(null)}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground">{selectedGroup.name}</h1>
            {selectedGroup.description && <p className="text-muted-foreground text-sm">{selectedGroup.description}</p>}
          </div>
        </div>

        {/* Members */}
        <Card className="glass border-primary/30">
          <CardHeader className="p-[25px] pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Smartphone className="h-4 w-4 text-primary" />
              Chips no Grupo ({members.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-[25px] pt-3 space-y-3">
            <div className="flex flex-wrap gap-2">
              {members.map((m) => (
                <Badge key={m.id} className="bg-primary/20 text-primary border-primary/30 gap-1 pr-1">
                  ({m.phone_chips?.ddd}) {m.phone_chips?.phone_number}
                  <button onClick={() => removeChipFromGroup(m.id)} className="ml-1 hover:text-destructive">
                    <Trash2 className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
              {members.length === 0 && <p className="text-xs text-muted-foreground">Nenhum chip neste grupo</p>}
            </div>
            {availableChips.length > 0 && (
              <div className="flex gap-2 items-end">
                <div className="flex-1">
                  <Label className="text-xs text-muted-foreground mb-1 block">Adicionar chip</Label>
                  <select
                    value={addingChipId}
                    onChange={(e) => setAddingChipId(e.target.value)}
                    className="w-full h-10 rounded-md border border-input bg-secondary/50 px-3 text-sm"
                  >
                    <option value="">Selecione...</option>
                    {availableChips.map((c) => (
                      <option key={c.id} value={c.id}>
                        ({c.ddd}) {c.phone_number}
                      </option>
                    ))}
                  </select>
                </div>
                <Button size="sm" onClick={addChipToGroup} disabled={!addingChipId}>
                  <UserPlus className="h-4 w-4 mr-1" /> Adicionar
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Chat */}
        <Card className="glass border-[hsl(30,100%,50%)]/30 shadow-[0_0_20px_hsl(30,100%,50%,0.1)]">
          <CardHeader className="p-[25px] pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <MessageCircle className="h-4 w-4 text-[hsl(30,100%,50%)]" />
              Chat em Tempo Real
            </CardTitle>
          </CardHeader>
          <CardContent className="p-[25px] pt-3">
            <div className="h-80 overflow-y-auto rounded-lg bg-secondary/30 border border-border p-[25px] mb-3 space-y-3">
              {messages.length === 0 ? (
                <p className="text-center text-muted-foreground text-sm py-10">Nenhuma mensagem ainda. Envie a primeira!</p>
              ) : (
                messages.map((msg) => {
                  const senderChip = chips.find((c) => c.id === msg.sender_chip_id);
                  return (
                    <div key={msg.id} className="flex flex-col">
                      <div className="glass rounded-xl p-3 max-w-[80%] border border-primary/20">
                        {senderChip && (
                          <p className="text-xs text-primary font-semibold mb-1">
                            ({senderChip.ddd}) {senderChip.phone_number}
                          </p>
                        )}
                        <p className="text-sm text-foreground">{msg.content}</p>
                        <p className="text-[10px] text-muted-foreground mt-1">
                          {new Date(msg.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>
            <div className="flex gap-2">
              <Input
                placeholder="Digite uma mensagem..."
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
                className="bg-secondary/50 border-border flex-1"
              />
              <Button
                onClick={sendMessage}
                disabled={!newMessage.trim() || sending}
                className="bg-[hsl(30,100%,50%)] hover:bg-[hsl(30,100%,45%)] text-white shadow-[0_0_15px_hsl(30,100%,50%,0.4)]"
              >
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ========== GROUPS LIST ==========
  return (
    <div className="space-y-8 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Grupos</h1>
        <p className="text-muted-foreground text-sm mt-1">Crie grupos de chips e converse em tempo real</p>
      </div>

      <Card className="glass border-primary/30 shadow-[0_0_20px_hsl(var(--primary),0.1)]">
        <CardHeader className="p-[25px] pb-2">
          <CardTitle className="flex items-center gap-2 text-xl">
            <div className="p-2 rounded-lg bg-primary/20">
              <Users className="h-5 w-5 text-primary" />
            </div>
            Criar Grupo
          </CardTitle>
          <CardDescription>Agrupe chips e gerencie conversas</CardDescription>
        </CardHeader>
        <CardContent className="p-[25px] pt-4 space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1">
              <Label className="text-xs text-muted-foreground mb-1 block">Nome do Grupo</Label>
              <Input
                placeholder="Ex: Vendas SP"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                className="bg-secondary/50 border-border"
              />
            </div>
            <div className="flex-1">
              <Label className="text-xs text-muted-foreground mb-1 block">Descrição (opcional)</Label>
              <Input
                placeholder="Grupo para vendas em São Paulo"
                value={groupDesc}
                onChange={(e) => setGroupDesc(e.target.value)}
                className="bg-secondary/50 border-border"
              />
            </div>
            <div className="flex items-end">
              <Button
                onClick={createGroup}
                disabled={!groupName.trim() || adding}
                className="w-full sm:w-auto bg-[hsl(30,100%,50%)] hover:bg-[hsl(30,100%,45%)] text-white font-semibold shadow-[0_0_15px_hsl(30,100%,50%,0.4)]"
              >
                {adding ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
                Criar
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Groups list */}
      {groups.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground text-sm">
          <Users className="h-12 w-12 mx-auto mb-3 opacity-30" />
          Nenhum grupo criado ainda
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {groups.map((g) => (
            <div
              key={g.id}
              className="glass rounded-xl p-[25px] border border-primary/20 hover:border-primary/40 transition-all group cursor-pointer"
              onClick={() => openGroup(g)}
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="font-bold text-lg text-foreground">{g.name}</p>
                  {g.description && <p className="text-xs text-muted-foreground mt-0.5">{g.description}</p>}
                  <p className="text-[10px] text-muted-foreground mt-1">
                    Criado em {new Date(g.created_at).toLocaleDateString('pt-BR')}
                  </p>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteGroup(g.id);
                  }}
                  className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              <Button
                size="sm"
                className="w-full bg-white/90 hover:bg-white text-[hsl(30,100%,40%)] font-semibold shadow-[0_0_12px_hsl(0,0%,100%,0.2)] border border-white/30"
              >
                <MessageCircle className="h-4 w-4 mr-2" /> Abrir Chat
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default GroupsPage;
