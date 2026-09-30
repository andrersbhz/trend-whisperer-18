import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { requireUserOrService } from "../_shared/security.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function localClock(timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone, weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(new Date());
  const value = (type: string) => parts.find((p) => p.type === type)?.value || "";
  const weekdayMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return { weekday: weekdayMap[value("weekday")], minutes: Number(value("hour")) * 60 + Number(value("minute")) };
}

function asMinutes(value: string) {
  const [hours, minutes] = String(value || "00:00").split(":").map(Number);
  return hours * 60 + minutes;
}

function renderTemplate(template: string, article: any, url: string) {
  const values: Record<string, string> = {
    title: article.title || "",
    excerpt: article.excerpt || article.meta_description || "",
    url,
    featured_image: article.featured_image_url || "",
    categories: article.category || "",
    tags: "",
    hashtags: "",
    author: "",
    site_name: "",
  };
  return Object.entries(values).reduce((text, [key, value]) => text.replaceAll(`{${key}}`, value), template).trim();
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const authHeader = req.headers.get("Authorization") || "";
    const bearer = authHeader.replace(/^Bearer\s+/i, "").trim();
    if (!bearer) throw new Error("Unauthorized");

    const admin = createClient(supabaseUrl, serviceKey);
    let userId: string | null = null;
    const auth = await requireUserOrService(req);
    if (!auth.isService) userId = auth.userId;

    let query = admin.from("social_planners").select("*").eq("enabled", true);
    if (userId) query = query.eq("user_id", userId);
    const { data: planners, error } = await query;
    if (error) throw error;

    const results: any[] = [];
    for (const planner of planners || []) {
      try {
        if (!planner.target_keys?.length) throw new Error("Planner sem contas de destino");
        const clock = localClock(planner.timezone || "America/Sao_Paulo");
        if (!planner.weekdays?.includes(clock.weekday)) continue;
        if (clock.minutes < asMinutes(planner.start_time) || clock.minutes > asMinutes(planner.end_time)) continue;
        if (planner.last_run_at && Date.now() - new Date(planner.last_run_at).getTime() < planner.interval_minutes * 60_000) continue;

        const { data: articles } = await admin.from("articles")
          .select("id,title,excerpt,meta_description,featured_image_url,category")
          .eq("user_id", planner.user_id).eq("status", "published")
          .order("published_at", { ascending: false }).limit(25);

        let article: any = null;
        for (const candidate of articles || []) {
          const { count } = await admin.from("social_queue").select("id", { count: "exact", head: true })
            .eq("planner_id", planner.id).eq("article_id", candidate.id);
          if (!count) { article = candidate; break; }
        }
        if (!article) continue;

        const { data: log } = await admin.from("publish_log").select("published_url")
          .eq("article_id", article.id).eq("platform", "wordpress").eq("status", "success")
          .order("created_at", { ascending: false }).limit(1).maybeSingle();
        const url = log?.published_url || "";
        const { data: template } = planner.template_id
          ? await admin.from("social_templates").select("body").eq("id", planner.template_id).eq("user_id", planner.user_id).maybeSingle()
          : { data: null } as any;
        const caption = renderTemplate(template?.body || "{title}\n\n{excerpt}\n\n{url}", article, url);
        const bucket = Math.floor(Date.now() / (planner.interval_minutes * 60_000));

        for (const targetKey of planner.target_keys) {
          await admin.from("social_queue").insert({
            user_id: planner.user_id, article_id: article.id, planner_id: planner.id,
            target_keys: [targetKey], caption, image_url: article.featured_image_url,
            link_url: url || null, scheduled_at: new Date().toISOString(), status: "pending",
            idempotency_key: `planner:${planner.id}:${article.id}:${targetKey}:${bucket}`,
          });
        }
        await admin.from("social_planners").update({ last_run_at: new Date().toISOString(), last_error: null }).eq("id", planner.id);
        results.push({ plannerId: planner.id, articleId: article.id, queued: planner.target_keys.length });
      } catch (plannerError) {
        const message = plannerError instanceof Error ? plannerError.message : String(plannerError);
        await admin.from("social_planners").update({ last_error: message }).eq("id", planner.id);
        results.push({ plannerId: planner.id, error: message });
      }
    }

    return new Response(JSON.stringify({ success: true, results }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    return new Response(JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Erro desconhecido" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
