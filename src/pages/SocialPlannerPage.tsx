import { useEffect, useMemo, useState } from 'react';
import { Activity, CalendarClock, CheckCircle2, Clock3, FileText, Loader2, Play, Plus, RefreshCw, Save, Trash2, XCircle } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const DEFAULT_TEMPLATE = `🔥 {title}\n\n{excerpt}\n\nLeia mais: {url}\n\n{hashtags}`;

type QueueItem = {
  id: string;
  caption: string;
  target_keys: string[];
  scheduled_at: string;
  status: string;
  attempts: number;
  max_attempts: number;
  last_error?: string | null;
  created_at: string;
};

type Template = { id: string; name: string; platform: string; body: string; is_default: boolean };
type Planner = { id: string; name: string; enabled: boolean; interval_minutes: number; start_time: string; end_time: string; weekdays: number[]; target_keys: string[] };

const SocialPlannerPage = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [planners, setPlanners] = useState<Planner[]>([]);
  const [health, setHealth] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [checking, setChecking] = useState(false);

  const [templateName, setTemplateName] = useState('Padrão de notícias');
  const [templateBody, setTemplateBody] = useState(DEFAULT_TEMPLATE);
  const [plannerName, setPlannerName] = useState('Publicação automática');
  const [plannerInterval, setPlannerInterval] = useState(120);
  const [plannerStart, setPlannerStart] = useState('09:00');
  const [plannerEnd, setPlannerEnd] = useState('20:00');

  const loadData = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [queueRes, templatesRes, plannersRes] = await Promise.all([
        supabase.from('social_queue' as any).select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(100),
        supabase.from('social_templates' as any).select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
        supabase.from('social_planners' as any).select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
      ]);
      if (queueRes.error) throw queueRes.error;
      if (templatesRes.error) throw templatesRes.error;
      if (plannersRes.error) throw plannersRes.error;
      setQueue((queueRes.data || []) as any);
      setTemplates((templatesRes.data || []) as any);
      setPlanners((plannersRes.data || []) as any);
    } catch (e: any) {
      toast({ title: 'Erro ao carregar Social Planner', description: e.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, [user]);

  const stats = useMemo(() => ({
    pending: queue.filter((q) => ['pending', 'processing'].includes(q.status)).length,
    published: queue.filter((q) => q.status === 'published').length,
    partial: queue.filter((q) => q.status === 'partial').length,
    failed: queue.filter((q) => q.status === 'failed').length,
  }), [queue]);

  const runQueue = async () => {
    setProcessing(true);
    try {
      const { data, error } = await supabase.functions.invoke('process-social-queue', { body: { limit: 10 } });
      if (error) throw error;
      toast({ title: 'Fila processada', description: `${data?.processed?.length || 0} item(ns) processado(s).` });
      await loadData();
    } catch (e: any) {
      toast({ title: 'Erro ao processar fila', description: e.message, variant: 'destructive' });
    } finally { setProcessing(false); }
  };

  const checkHealth = async () => {
    setChecking(true);
    try {
      const { data, error } = await supabase.functions.invoke('social-health-check');
      if (error) throw error;
      setHealth(data?.results || []);
      toast({ title: 'Conexões verificadas', description: `${data?.results?.length || 0} conta(s) analisada(s).` });
    } catch (e: any) {
      toast({ title: 'Falha no diagnóstico', description: e.message, variant: 'destructive' });
    } finally { setChecking(false); }
  };

  const saveTemplate = async () => {
    if (!user || !templateName.trim() || !templateBody.trim()) return;
    const { error } = await supabase.from('social_templates' as any).insert({
      user_id: user.id, name: templateName.trim(), platform: 'all', body: templateBody.trim(), is_default: templates.length === 0,
    } as any);
    if (error) return toast({ title: 'Erro ao salvar template', description: error.message, variant: 'destructive' });
    toast({ title: 'Template salvo' });
    await loadData();
  };

  const deleteTemplate = async (id: string) => {
    const { error } = await supabase.from('social_templates' as any).delete().eq('id', id);
    if (error) return toast({ title: 'Erro ao excluir', description: error.message, variant: 'destructive' });
    await loadData();
  };

  const savePlanner = async () => {
    if (!user || !plannerName.trim()) return;
    const { error } = await supabase.from('social_planners' as any).insert({
      user_id: user.id,
      name: plannerName.trim(),
      enabled: true,
      weekdays: [1,2,3,4,5,6,0],
      start_time: plannerStart,
      end_time: plannerEnd,
      interval_minutes: Math.max(5, plannerInterval),
      target_keys: [],
      filters: {},
    } as any);
    if (error) return toast({ title: 'Erro ao salvar planner', description: error.message, variant: 'destructive' });
    toast({ title: 'Planner criado', description: 'O plano está salvo e pronto para ser ligado ao pipeline automático.' });
    await loadData();
  };

  const togglePlanner = async (planner: Planner) => {
    const { error } = await supabase.from('social_planners' as any).update({ enabled: !planner.enabled } as any).eq('id', planner.id);
    if (error) return toast({ title: 'Erro ao alterar planner', description: error.message, variant: 'destructive' });
    await loadData();
  };

  const cancelQueue = async (id: string) => {
    const { error } = await supabase.from('social_queue' as any).update({ status: 'cancelled', updated_at: new Date().toISOString() } as any).eq('id', id).in('status', ['pending','failed']);
    if (error) return toast({ title: 'Erro ao cancelar', description: error.message, variant: 'destructive' });
    await loadData();
  };

  const statusBadge = (status: string) => {
    const cls = status === 'published' ? 'text-emerald-500' : status === 'failed' ? 'text-destructive' : status === 'partial' ? 'text-amber-500' : 'text-muted-foreground';
    return <span className={`text-[10px] font-bold uppercase tracking-[.14em] ${cls}`}>{status}</span>;
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between border-b border-border/60 pb-5">
        <div>
          <p className="text-[11px] uppercase tracking-[0.2em] font-semibold text-muted-foreground">Social Publisher</p>
          <h1 className="text-2xl font-semibold tracking-tight mt-1">Planner, fila e automações</h1>
          <p className="text-sm text-muted-foreground mt-2 max-w-2xl">Camada de automação inspirada no fluxo do FS Poster: templates, agendamento resiliente, retentativas, diagnóstico de conexões e histórico.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={loadData} disabled={loading}><RefreshCw className={loading ? 'animate-spin' : ''}/>Atualizar</Button>
          <Button variant="outline" onClick={checkHealth} disabled={checking}>{checking ? <Loader2 className="animate-spin"/> : <Activity/>}Testar conexões</Button>
          <Button onClick={runQueue} disabled={processing}>{processing ? <Loader2 className="animate-spin"/> : <Play/>}Processar fila</Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Na fila</p><p className="text-2xl font-semibold mt-1">{stats.pending}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Publicados</p><p className="text-2xl font-semibold mt-1">{stats.published}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Parciais</p><p className="text-2xl font-semibold mt-1">{stats.partial}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Falhas</p><p className="text-2xl font-semibold mt-1">{stats.failed}</p></CardContent></Card>
      </div>

      <Tabs defaultValue="queue" className="space-y-4">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="queue"><Clock3 className="h-4 w-4 mr-1.5"/>Fila</TabsTrigger>
          <TabsTrigger value="templates"><FileText className="h-4 w-4 mr-1.5"/>Templates</TabsTrigger>
          <TabsTrigger value="planner"><CalendarClock className="h-4 w-4 mr-1.5"/>Planner</TabsTrigger>
          <TabsTrigger value="health"><Activity className="h-4 w-4 mr-1.5"/>Saúde</TabsTrigger>
        </TabsList>

        <TabsContent value="queue">
          <Card>
            <CardHeader><CardTitle className="text-base">Fila de publicação</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {!queue.length && <div className="p-8 text-center text-sm text-muted-foreground border border-dashed rounded-lg">A fila está vazia.</div>}
              {queue.map((item) => (
                <div key={item.id} className="rounded-lg border border-border/60 bg-background/30 p-3 flex flex-col gap-2 lg:flex-row lg:items-center">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">{statusBadge(item.status)}<span className="text-[11px] text-muted-foreground">Tentativa {item.attempts}/{item.max_attempts}</span></div>
                    <p className="text-sm font-medium truncate mt-1">{item.caption}</p>
                    <p className="text-xs text-muted-foreground mt-1">{new Date(item.scheduled_at).toLocaleString('pt-BR')} · {item.target_keys?.length || 0} destino(s)</p>
                    {item.last_error && <p className="text-xs text-destructive mt-1 truncate">{item.last_error}</p>}
                  </div>
                  {['pending','failed'].includes(item.status) && <Button variant="ghost" size="sm" onClick={() => cancelQueue(item.id)}><XCircle className="h-4 w-4"/>Cancelar</Button>}
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="templates">
          <div className="grid gap-4 xl:grid-cols-[1fr_1fr]">
            <Card><CardHeader><CardTitle className="text-base">Novo template</CardTitle></CardHeader><CardContent className="space-y-4">
              <div className="space-y-2"><Label>Nome</Label><Input value={templateName} onChange={(e)=>setTemplateName(e.target.value)}/></div>
              <div className="space-y-2"><Label>Conteúdo</Label><Textarea className="min-h-56" value={templateBody} onChange={(e)=>setTemplateBody(e.target.value)}/></div>
              <div className="text-xs text-muted-foreground rounded-lg border p-3">Placeholders: {'{title}'} {'{excerpt}'} {'{url}'} {'{featured_image}'} {'{categories}'} {'{tags}'} {'{hashtags}'} {'{author}'} {'{site_name}'}.</div>
              <Button onClick={saveTemplate}><Save className="h-4 w-4"/>Salvar template</Button>
            </CardContent></Card>
            <Card><CardHeader><CardTitle className="text-base">Templates salvos</CardTitle></CardHeader><CardContent className="space-y-2">
              {!templates.length && <p className="text-sm text-muted-foreground">Nenhum template salvo.</p>}
              {templates.map((tpl)=><div key={tpl.id} className="border rounded-lg p-3 flex gap-3"><div className="min-w-0 flex-1"><p className="text-sm font-semibold">{tpl.name}</p><p className="text-xs text-muted-foreground mt-1 line-clamp-3 whitespace-pre-wrap">{tpl.body}</p></div><Button variant="ghost" size="icon" onClick={()=>deleteTemplate(tpl.id)}><Trash2 className="h-4 w-4"/></Button></div>)}
            </CardContent></Card>
          </div>
        </TabsContent>

        <TabsContent value="planner">
          <div className="grid gap-4 xl:grid-cols-[.9fr_1.1fr]">
            <Card><CardHeader><CardTitle className="text-base">Criar Planner</CardTitle></CardHeader><CardContent className="space-y-4">
              <div className="space-y-2"><Label>Nome</Label><Input value={plannerName} onChange={(e)=>setPlannerName(e.target.value)}/></div>
              <div className="grid grid-cols-2 gap-3"><div className="space-y-2"><Label>Início</Label><Input type="time" value={plannerStart} onChange={(e)=>setPlannerStart(e.target.value)}/></div><div className="space-y-2"><Label>Fim</Label><Input type="time" value={plannerEnd} onChange={(e)=>setPlannerEnd(e.target.value)}/></div></div>
              <div className="space-y-2"><Label>Intervalo entre publicações (min)</Label><Input type="number" min={5} value={plannerInterval} onChange={(e)=>setPlannerInterval(Number(e.target.value))}/></div>
              <Button onClick={savePlanner}><Plus className="h-4 w-4"/>Criar Planner</Button>
            </CardContent></Card>
            <Card><CardHeader><CardTitle className="text-base">Planos salvos</CardTitle></CardHeader><CardContent className="space-y-2">
              {!planners.length && <p className="text-sm text-muted-foreground">Nenhum planner configurado.</p>}
              {planners.map((planner)=><div key={planner.id} className="border rounded-lg p-3 flex items-center gap-3"><div className={`h-2.5 w-2.5 rounded-full ${planner.enabled ? 'bg-emerald-500' : 'bg-muted-foreground/40'}`}/><div className="min-w-0 flex-1"><p className="text-sm font-semibold truncate">{planner.name}</p><p className="text-xs text-muted-foreground">{planner.start_time?.slice(0,5)}–{planner.end_time?.slice(0,5)} · a cada {planner.interval_minutes} min</p></div><Button variant={planner.enabled ? 'outline' : 'default'} size="sm" onClick={()=>togglePlanner(planner)}>{planner.enabled ? 'Pausar' : 'Ativar'}</Button></div>)}
            </CardContent></Card>
          </div>
        </TabsContent>

        <TabsContent value="health">
          <Card><CardHeader><CardTitle className="text-base">Diagnóstico das conexões</CardTitle></CardHeader><CardContent className="space-y-2">
            {!health.length && <div className="p-8 text-center text-sm text-muted-foreground border border-dashed rounded-lg">Clique em “Testar conexões” para validar tokens e contas.</div>}
            {health.map((item)=><div key={item.key} className="rounded-lg border p-3 flex items-center gap-3">{item.ok ? <CheckCircle2 className="h-5 w-5 text-emerald-500"/> : <XCircle className="h-5 w-5 text-destructive"/>}<div className="min-w-0 flex-1"><p className="text-sm font-semibold truncate">{item.name || item.key}</p><p className="text-xs text-muted-foreground uppercase">{item.platform}</p>{item.error && <p className="text-xs text-destructive mt-1">{item.error}</p>}</div><span className={`text-[10px] font-bold uppercase ${item.ok ? 'text-emerald-500':'text-destructive'}`}>{item.ok ? 'OK' : 'Erro'}</span></div>)}
          </CardContent></Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default SocialPlannerPage;
