import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Get all users with auto_publish enabled
    const { data: users, error: usersErr } = await supabase
      .from("user_settings")
      .select("user_id, auto_publish, articles_per_day, categories")
      .eq("auto_publish", true);

    if (usersErr) throw usersErr;
    if (!users || users.length === 0) {
      return new Response(JSON.stringify({ message: "No users with auto_publish enabled" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const results: Array<{ userId: string; step: string; result: string }> = [];

    for (const userSettings of users) {
      const userId = userSettings.user_id;
      const articlesPerDay = Math.max(userSettings.articles_per_day || 10, 1);
      const intervalMs = (24 / articlesPerDay) * 60 * 60 * 1000;
      console.log(`[Pipeline] Processing user: ${userId}`);

      const now = new Date();

      // Step 1: Publish ready articles FIRST (before any rescheduling)
      try {
        const { data: readyArticles } = await supabase
          .from("articles")
          .select("id")
          .eq("user_id", userId)
          .eq("status", "ready")
          .not("scheduled_at", "is", null)
          .lte("scheduled_at", now.toISOString())
          .order("scheduled_at", { ascending: true })
          .limit(10);

        if (readyArticles && readyArticles.length > 0) {
          let published = 0;
          for (const article of readyArticles) {
            try {
              const pubResp = await fetch(`${supabaseUrl}/functions/v1/publish-article`, {
                method: "POST",
                headers: { Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json" },
                body: JSON.stringify({ articleId: article.id, userId }),
              });
              if (pubResp.ok) {
                published++;
              } else {
                const errBody = await pubResp.text().catch(() => "");
                console.error(`[Pipeline] Publish failed for article ${article.id}: ${pubResp.status} ${errBody.substring(0, 200)}`);
              }
              await new Promise((r) => setTimeout(r, 3000));
            } catch (e) {
              console.error(`[Pipeline] Publish error article ${article.id}:`, e);
            }
          }
          results.push({ userId, step: "auto-publish", result: `${published}/${readyArticles.length} published` });
          console.log(`[Pipeline] Published ${published}/${readyArticles.length} articles for ${userId}`);
        } else {
          results.push({ userId, step: "auto-publish", result: "no articles ready" });
        }
      } catch (err) {
        console.error(`[Pipeline] Publish error for ${userId}:`, err);
        results.push({ userId, step: "auto-publish", result: `error: ${err}` });
      }

      // Step 2: Reagendar apenas itens vencidos que não estão prontos para publicar
      try {
        const { data: pendingArticles } = await supabase
          .from("articles")
          .select("id, scheduled_at, created_at, status")
          .eq("user_id", userId)
          .neq("status", "published")
          .neq("status", "ready")
          .not("scheduled_at", "is", null)
          .order("scheduled_at", { ascending: true })
          .order("created_at", { ascending: true });

        const overdue = (pendingArticles || []).filter((article: any) => article.scheduled_at && new Date(article.scheduled_at).getTime() < now.getTime());
        const future = (pendingArticles || []).filter((article: any) => article.scheduled_at && new Date(article.scheduled_at).getTime() >= now.getTime());

        let queueCursor = future.length > 0
          ? new Date(future[future.length - 1].scheduled_at)
          : new Date(now);

        for (const article of overdue) {
          queueCursor = new Date(Math.max(queueCursor.getTime(), now.getTime()) + intervalMs);
          await supabase.from("articles").update({ scheduled_at: queueCursor.toISOString() }).eq("id", article.id);
        }

        if (overdue.length > 0) {
          console.log(`[Pipeline] Reagendados ${overdue.length} artigos vencidos para ${userId}`);
          results.push({ userId, step: "reschedule-overdue", result: `${overdue.length} reagendados` });
        }
      } catch (err) {
        console.error(`[Pipeline] Reschedule error for ${userId}:`, err);
        results.push({ userId, step: "reschedule-overdue", result: `error: ${err}` });
      }

      // Small delay between steps
      await new Promise((r) => setTimeout(r, 2000));

      // Step 2: Fetch trends
      try {
        const trendResp = await fetch(`${supabaseUrl}/functions/v1/fetch-trends`, {
          method: "POST",
          headers: { Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({ userId }),
        });
        const trendData = await trendResp.json();
        results.push({ userId, step: "fetch-trends", result: trendData.message || "done" });
        console.log(`[Pipeline] Trends for ${userId}: ${trendData.message}`);
      } catch (err) {
        console.error(`[Pipeline] Trends error for ${userId}:`, err);
        results.push({ userId, step: "fetch-trends", result: `error: ${err}` });
      }

      await new Promise((r) => setTimeout(r, 2000));

      // Step 3: Generate articles
      try {
        const genResp = await fetch(`${supabaseUrl}/functions/v1/generate-articles`, {
          method: "POST",
          headers: { Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({ userId }),
        });
        const genData = await genResp.json();
        results.push({ userId, step: "generate-articles", result: genData.message || genData.error || "done" });
        console.log(`[Pipeline] Articles for ${userId}: ${genData.message || genData.error}`);
      } catch (err) {
        console.error(`[Pipeline] Generation error for ${userId}:`, err);
        results.push({ userId, step: "generate-articles", result: `error: ${err}` });
      }
    }

    return new Response(
      JSON.stringify({ success: true, results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("auto-pipeline error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
