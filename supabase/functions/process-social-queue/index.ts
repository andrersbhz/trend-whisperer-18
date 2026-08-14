import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(supabaseUrl, serviceKey);

  try {
    const authHeader = req.headers.get("Authorization") || "";
    const bearer = authHeader.replace(/^Bearer\s+/i, "").trim();
    if (!bearer) throw new Error("Unauthorized");

    let callerUserId: string | null = null;
    const isService = bearer === serviceKey;
    if (!isService) {
      const authed = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data } = await authed.auth.getUser(bearer);
      if (!data.user) throw new Error("Unauthorized");
      callerUserId = data.user.id;
    }

    const body = await req.json().catch(() => ({}));
    const requestedLimit = Math.max(1, Math.min(Number(body.limit || 5), 20));
    const processed: any[] = [];

    for (let i = 0; i < requestedLimit; i++) {
      let job: any = null;

      if (isService) {
        const { data, error } = await admin.rpc("claim_next_social_job");
        if (error) throw error;
        job = Array.isArray(data) ? data[0] : data;
      } else {
        // User-triggered processing is intentionally scoped to that user's due jobs.
        const { data: candidate, error } = await admin
          .from("social_queue")
          .select("*")
          .eq("user_id", callerUserId)
          .in("status", ["pending", "failed"])
          .lte("scheduled_at", new Date().toISOString())
          .lt("attempts", 4)
          .order("scheduled_at", { ascending: true })
          .limit(1)
          .maybeSingle();
        if (error) throw error;
        if (candidate) {
          const { data: claimed, error: claimError } = await admin
            .from("social_queue")
            .update({ status: "processing", locked_at: new Date().toISOString(), attempts: candidate.attempts + 1, updated_at: new Date().toISOString() })
            .eq("id", candidate.id)
            .in("status", ["pending", "failed"])
            .select("*")
            .maybeSingle();
          if (claimError) throw claimError;
          job = claimed;
        }
      }

      if (!job) break;

      try {
        const response = await fetch(`${supabaseUrl}/functions/v1/publish-social`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${serviceKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            userId: job.user_id,
            articleId: job.article_id,
            content: {
              caption: job.caption,
              imageUrl: job.image_url,
              linkUrl: job.link_url,
            },
            targetKeys: job.target_keys || [],
          }),
        });

        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload?.error || `publish-social HTTP ${response.status}`);

        const results = Array.isArray(payload?.results) ? payload.results : [];
        const okCount = results.filter((r: any) => r.ok).length;
        const failedCount = results.length - okCount;
        const finalStatus = okCount === results.length && results.length > 0 ? "published" : okCount > 0 ? "partial" : "failed";

        if (finalStatus === "failed" && job.attempts < job.max_attempts) {
          const backoffMinutes = Math.min(60, 2 ** Math.max(0, job.attempts - 1) * 5);
          const nextAttempt = new Date(Date.now() + backoffMinutes * 60_000).toISOString();
          await admin.from("social_queue").update({
            status: "failed",
            result: payload,
            last_error: payload?.message || "Nenhum destino foi publicado",
            next_attempt_at: nextAttempt,
            locked_at: null,
            updated_at: new Date().toISOString(),
          }).eq("id", job.id);
        } else {
          await admin.from("social_queue").update({
            status: finalStatus,
            result: payload,
            last_error: failedCount ? `${failedCount} destino(s) falharam` : null,
            next_attempt_at: null,
            locked_at: null,
            published_at: okCount ? new Date().toISOString() : null,
            updated_at: new Date().toISOString(),
          }).eq("id", job.id);
        }

        processed.push({ id: job.id, status: finalStatus, okCount, failedCount });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const exhausted = job.attempts >= job.max_attempts;
        const backoffMinutes = Math.min(60, 2 ** Math.max(0, job.attempts - 1) * 5);
        await admin.from("social_queue").update({
          status: "failed",
          last_error: message,
          next_attempt_at: exhausted ? null : new Date(Date.now() + backoffMinutes * 60_000).toISOString(),
          locked_at: null,
          updated_at: new Date().toISOString(),
        }).eq("id", job.id);
        processed.push({ id: job.id, status: "failed", error: message });
      }

      // Small gap protects provider APIs when several queued jobs are due at once.
      await sleep(250);
    }

    return new Response(JSON.stringify({ success: true, processed }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("process-social-queue error", error);
    return new Response(JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Erro desconhecido" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
