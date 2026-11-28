import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { RefreshCw, Play, AlertTriangle } from 'lucide-react';

type Job = { id: string; stage: string; status: string; pause_reason: string | null; outcome_unknown: boolean; updated_at: string };
const stages: Record<string, string> = { publish: 'Publicação', trends: 'Tendências', research: 'Apuração', text: 'Texto', save: 'Salvamento', image: 'Imagem', done: 'Concluída' };
const states: Record<string, string> = { pending: 'Pendente', running: 'Em andamento', paused: 'Pausada', completed: 'Concluída' };
export function AutomationProgress({ onCompleted }: { onCompleted?: () => void }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [busy, setBusy] = useState(false);
  const load = async () => {
    if (!user) return;
    const { data, error } = await supabase.from('article_automation_jobs').select('id, stage, status, pause_reason, outcome_unknown, updated_at').eq('user_id', user.id).order('updated_at', { ascending: false }).limit(5);
    if (error) { toast({ title: 'Falha ao consultar automação', description: error.message, variant: 'destructive' }); return; }
    setJobs(data || []);
  };
  useEffect(() => {
    void load();
    const refresh = () => { void load(); };
    window.addEventListener('refresh-articles', refresh);
    const timer = setInterval(refresh, 15000);
    return () => { clearInterval(timer); window.removeEventListener('refresh-articles', refresh); };
  }, [user?.id]);
  useEffect(() => {
    if (jobs[0]?.status === 'completed' || jobs[0]?.stage === 'image') onCompleted?.();
  }, [jobs[0]?.id, jobs[0]?.status, jobs[0]?.stage]);
  const resume = async (job: Job) => {
    setBusy(true);
    try {
      const { data, error } = await supabase.rpc('resume_article_automation', { p_id: job.id });
      if (error || !data) throw new Error(error?.message || 'Esta tarefa exige conferência antes de retomar.');
      toast({ title: 'Retomada solicitada', description: 'A tarefa continuará no próximo ciclo.' });
      await load();
    } catch (error) { toast({ title: 'Não foi possível retomar', description: error instanceof Error ? error.message : 'Tente novamente.', variant: 'destructive' }); }
    finally { setBusy(false); }
  };
  if (!jobs.length) return null;
  return <section className="border-y border-border py-4 space-y-3" aria-label="Progresso da automação">
    <div className="flex items-center justify-between"><h2 className="text-sm font-semibold">Automação</h2>
      <Button variant="ghost" size="icon" title="Atualizar automação" aria-label="Atualizar automação" onClick={() => void load()}><RefreshCw className="h-4 w-4" /></Button></div>
    {jobs.map(job => <div key={job.id} className="flex flex-wrap items-center gap-3 text-sm">
      <Badge variant={job.status === 'paused' ? 'destructive' : 'secondary'}>{states[job.status] || job.status}</Badge>
      <span>{stages[job.stage] || job.stage}</span>
      <time className="text-xs text-muted-foreground">{new Date(job.updated_at).toLocaleString('pt-BR')}</time>
      {job.pause_reason && <span className="basis-full flex items-start gap-2 text-destructive"><AlertTriangle className="h-4 w-4 shrink-0" />{job.pause_reason}</span>}
      {job.status === 'paused' && <Button size="sm" variant="outline" disabled={busy} onClick={() => void resume(job)}><Play className="h-4 w-4 mr-2" />{job.outcome_unknown ? 'Conferir e retomar' : 'Retomar'}</Button>}
      {job.outcome_unknown && <span className="basis-full text-xs text-muted-foreground">Resultado sem confirmação. Confira se o artigo já foi criado; a retomada só acontece pelo botão acima.</span>}
    </div>)}
  </section>;
}