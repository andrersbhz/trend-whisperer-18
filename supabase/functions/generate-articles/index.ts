import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { z } from "https://esm.sh/zod@3.25.76";
import { requireUserOrService, safeError } from "../_shared/security.ts";
import { runJobStep, JobStopped } from "../_shared/job-runtime.ts";
import { handleGeneration } from "./engine.ts";

const RequestSchema = z.object({
  userId: z.string().uuid(), topics: z.array(z.union([z.string().min(1).max(2000), z.object({ topic: z.string().min(1).max(2000), category: z.string().max(100).optional(), context: z.string().max(20000).nullable().optional() }).passthrough()])).max(100).optional(),
  forceCategory: z.string().max(100).optional(), automationJobId: z.string().uuid().optional(), automationLease: z.string().uuid().optional(),
});
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const parsed = RequestSchema.safeParse(await req.json());
    if (!parsed.success) return json({ error: 'Pedido de geração inválido' }, 400);
    const body = parsed.data;
    const auth = await requireUserOrService(req, body.userId);
    const url = Deno.env.get('SUPABASE_URL');
    const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const anon = Deno.env.get('SUPABASE_ANON_KEY');
    if (!url || !key || !anon) throw new Error('Serviço indisponível');
    const db = createClient(url, key);
    if (!body.automationJobId) {
      const { data: jobId, error } = await db.rpc('enqueue_article_automation', { p_user: body.userId, p_origin: 'manual', p_payload: { topics: body.topics, forceCategory: body.forceCategory } });
      if (error) throw error;
      const { data: job } = await db.from('article_automation_jobs').select('status, pause_reason').eq('id', jobId).single();
      if (job?.status === 'paused') return json({ success: false, paused: true, jobId, message: job.pause_reason || 'Há uma tarefa pausada; confira a automação antes de retomar.' });
      const { error: dispatchError } = await db.rpc('dispatch_article_automation', { p_url: `${url}/functions/v1/auto-pipeline`, p_bearer: anon });
      if (dispatchError) throw dispatchError;
      return json({ success: true, queued: true, jobId, articles: 0, message: 'Geração adicionada à fila. Acompanhe o progresso em Artigos.' });
    }
    if (!auth.isService || !body.automationLease) return json({ error: 'Etapa interna não autorizada' }, 403);
    const { data: job, error } = await db.from('article_automation_jobs').select('payload, stage').eq('id', body.automationJobId).eq('user_id', body.userId).eq('lease_token', body.automationLease).eq('status', 'running').gt('lease_expires_at', new Date().toISOString()).single();
    if (error || !job || !['research', 'text', 'save'].includes(job.stage)) return json({ error: 'Tarefa não autorizada ou expirada' }, 409);
    const payload = job.payload as { forceCategory?: string };
    const internalReq = new Request(req.url, { method: 'POST', headers: req.headers, body: JSON.stringify({ ...body, forceCategory: payload.forceCategory }) });
    try {
      return await runJobStep(() => handleGeneration(internalReq));
    } catch (error) {
      return json({ success: false, paused: true, message: error instanceof Error ? error.message : 'Etapa interrompida', outcomeUnknown: error instanceof JobStopped && error.unknownOutcome, rateLimited: error instanceof JobStopped && error.rateLimited });
    }
  } catch (error) {
    console.error('generate-articles:', error);
    return safeError(error, corsHeaders);
  }
});
