import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { z } from "https://esm.sh/zod@3.25.76";
import { requireServiceOrAdmin, safeError } from "../_shared/security.ts";
import { AUTOMATION_BATCH_USERS, AUTOMATION_PUBLISH_LIMIT, nextValidationStage, prioritizeAutomationUsers, type AutomationStage } from "../_shared/automation-policy.ts";

const RequestSchema = z.object({ jobId: z.string().uuid().optional(), remainingHops: z.number().int().min(0).max(6).default(6) });
declare const EdgeRuntime: { waitUntil: (work: Promise<unknown>) => void };
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    await requireServiceOrAdmin(req);
    const parsed = RequestSchema.safeParse(JSON.parse(await req.text() || '{}'));
    if (!parsed.success) return json({ error: "Pedido de automação inválido" }, 400);
    const url = Deno.env.get("SUPABASE_URL");
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const anon = Deno.env.get("SUPABASE_ANON_KEY");
    if (!url || !service || !anon) throw new Error("Serviço não configurado");
    const db = createClient(url, service);

    if (!parsed.data.jobId) {
      // Each user gets an independent durable job. Oldest completed users go first.
      const { data: users, error } = await db.from("user_settings").select("user_id").eq("auto_publish", true).order("user_id");
      if (error) throw error;
      const { data: history, error: historyError } = await db.from("article_automation_jobs").select("user_id, updated_at").eq("origin", "scheduled").order("updated_at", { ascending: false }).limit(5000);
      if (historyError) throw historyError;
      const ordered = prioritizeAutomationUsers(users || [], history || []);
      let enqueued = 0;
      for (const user of ordered.slice(0, AUTOMATION_BATCH_USERS)) {
        const { error: enqueueError } = await db.rpc("enqueue_article_automation", { p_user: user.user_id });
        if (enqueueError) throw enqueueError;
        enqueued++;
      }
      const { data: dispatched, error: dispatchError } = await db.rpc("dispatch_article_automation", { p_url: `${url}/functions/v1/auto-pipeline`, p_bearer: anon });
      if (dispatchError) throw dispatchError;
      return json({ success: true, enqueued, dispatched });
    }

    const jobId = parsed.data.jobId;
    const { data: claimed, error: claimError } = await db.rpc("claim_article_automation", { p_id: jobId });
    if (claimError) throw claimError;
    const job = claimed?.[0];
    if (!job) return json({ success: true, message: "Tarefa ocupada, pausada ou concluída." });
    const lease = job.lease_token;
    if (!lease) throw new Error("Trava não adquirida");
    const advance = async (stage: string, checkpoint = job.checkpoint, articleId = job.article_id) => {
      const { data, error } = await db.rpc("advance_article_automation", { p_id: job.id, p_lease: lease, p_stage: stage, p_checkpoint: checkpoint, p_article: articleId });
      if (error || !data) throw new Error(error?.message || "Trava da tarefa expirou");
    };
    const invoke = async (name: string, body: unknown, timeoutMs: number) => {
      const response = await fetch(`${url}/functions/v1/${name}`, { method: "POST", signal: AbortSignal.timeout(timeoutMs), headers: { Authorization: `Bearer ${service}`, "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await response.json();
      if (!response.ok) throw new Error(`HTTP ${response.status}: ${data.error || name}`);
      return data;
    };
    try {
      if (job.origin === "validation") {
        // Read-only validation jobs exercise the real claim/advance flow, not external providers.
        await advance(nextValidationStage(job.stage as AutomationStage), { ...job.checkpoint, validated: true });
      } else if (job.stage === "publish") {
        const now = new Date();
        const { error: staleError } = await db.from("articles").update({ status: "ready", is_approved: true, scheduled_at: now.toISOString() }).eq("user_id", job.user_id).eq("status", "publishing").is("wordpress_post_id", null).lt("updated_at", new Date(now.getTime() - 180000).toISOString());
        if (staleError) throw staleError;
        const { error: retryError } = await db.from("articles").update({ status: "ready", is_approved: true, scheduled_at: new Date(now.getTime() + 180000).toISOString() }).eq("user_id", job.user_id).eq("status", "failed").is("wordpress_post_id", null);
        if (retryError) throw retryError;
        const { data: ready, error: readyError } = await db.from("articles").select("id").eq("user_id", job.user_id).eq("status", "ready").eq("is_approved", true).lte("scheduled_at", now.toISOString()).order("scheduled_at").limit(AUTOMATION_PUBLISH_LIMIT);
        if (readyError) throw readyError;
        for (const article of ready || []) await invoke("publish-article", { articleId: article.id, userId: job.user_id }, 60000);
        await advance("trends");
      } else if (job.stage === "trends") {
        const result = await invoke("fetch-trends", { userId: job.user_id }, 25000);
        if (result.success === false || result.error) throw new Error(result.error || result.message || "Falha na busca de tendências");
        const { data: generation, error: generationError } = await db.from("article_automation_jobs").select("id").eq("user_id", job.user_id).neq("id", job.id).in("status", ["pending", "running", "paused"]).not("stage", "in", "(publish,trends)").limit(1);
        if (generationError) throw generationError;
        await advance(generation?.length ? "done" : "research");
      } else if (job.stage === "image") {
        if (!job.article_id) throw new Error("Artigo da tarefa não encontrado");
        const { data: article, error: articleError } = await db.from("articles").select("id, status, featured_image_url").eq("id", job.article_id).eq("user_id", job.user_id).single();
        if (articleError) throw articleError;
        if (article.status !== "published" && !article.featured_image_url) {
          const checkpoint = job.checkpoint as { imageFormat?: string; autoPublish?: boolean };
          const result = await invoke("regenerate-image", { userId: job.user_id, articleIds: [job.article_id], imageFormat: checkpoint.imageFormat, force: true, automationJobId: job.id, automationLease: lease }, 110000);
          if (!result.success) {
            const { error } = await db.from("article_automation_jobs").update({ status: result.rateLimited ? "pending" : "paused", available_at: new Date(Date.now() + 15 * 60000).toISOString(), pause_reason: result.message || result.error || "Imagem não gerada", outcome_unknown: Boolean(result.outcomeUnknown), lease_token: null, lease_expires_at: null, updated_at: new Date().toISOString() }).eq("id", job.id).eq("lease_token", lease);
            if (error) throw error;
            return json({ success: false, paused: true });
          }
          const { error: updateError } = await db.from("articles").update({ status: checkpoint.autoPublish ? "ready" : "draft", is_approved: Boolean(checkpoint.autoPublish) }).eq("id", job.article_id).eq("user_id", job.user_id).eq("status", "no_image").not("featured_image_url", "is", null);
          if (updateError) throw updateError;
        }
        await advance("done");
      } else {
        // Research, text and save each return a persisted checkpoint, never an entire long batch.
        const result = await invoke("generate-articles", { userId: job.user_id, automationJobId: job.id, automationLease: lease }, 110000);
        if (result.paused || result.error || result.success === false) {
          const { error } = await db.from("article_automation_jobs").update({ status: result.rateLimited ? "pending" : "paused", pause_reason: result.message || result.error || "Geração interrompida", outcome_unknown: Boolean(result.outcomeUnknown), available_at: new Date(Date.now() + 15 * 60000).toISOString(), lease_token: null, lease_expires_at: null, updated_at: new Date().toISOString() }).eq("id", job.id).eq("lease_token", lease);
          if (error) throw error;
        }
      }
      if (parsed.data.remainingHops > 0) {
        const { data: next } = await db.from("article_automation_jobs").select("status").eq("id", job.id).single();
        if (next?.status === "pending") EdgeRuntime.waitUntil((async () => {
          await new Promise(resolve => setTimeout(resolve, 10000));
          try {
            const { error } = await db.rpc("dispatch_article_automation_hop", { p_id: job.id, p_url: `${url}/functions/v1/auto-pipeline`, p_bearer: anon, p_hops: parsed.data.remainingHops - 1 });
            if (error) throw error;
          } catch (error) {
            console.error("[Automation] Confirmação da próxima etapa perdida", job.id);
            await db.from("article_automation_jobs").update({ pause_reason: "Próxima etapa não confirmada; tarefa preservada para o próximo ciclo.", updated_at: new Date().toISOString() }).eq("id", job.id).eq("status", "pending");
          }
        })());
      }
      return json({ success: true, jobId: job.id, stage: job.stage });
    } catch (error) {
      const { error: pauseError } = await db.from("article_automation_jobs").update({ status: "paused", pause_reason: error instanceof Error ? error.message : "Execução interrompida", outcome_unknown: true, lease_token: null, lease_expires_at: null, updated_at: new Date().toISOString() }).eq("id", job.id).eq("lease_token", lease);
      if (pauseError) throw pauseError;
      return json({ success: false, paused: true, message: "Execução pausada; progresso preservado." });
    }
  } catch (error) {
    console.error("auto-pipeline:", error);
    return safeError(error, corsHeaders);
  }
});
