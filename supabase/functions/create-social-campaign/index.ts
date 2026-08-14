import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PRESETS: Record<string, number[]> = {
  light: [0, 7 * 24 * 60],
  normal: [0, 2 * 24 * 60, 7 * 24 * 60, 14 * 24 * 60],
  aggressive: [0, 24 * 60, 3 * 24 * 60, 7 * 24 * 60, 10 * 24 * 60, 14 * 24 * 60, 21 * 24 * 60],
};

function clean(value: string | null | undefined) {
  return (value || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function platformFromKey(key: string) {
  return (key.split(":")[0] || "social").toLowerCase();
}

function withUtm(baseUrl: string, source: string, campaign: string, content: string) {
  if (!baseUrl) return "";
  try {
    const u = new URL(baseUrl);
    u.searchParams.set("utm_source", source);
    u.searchParams.set("utm_medium", "social");
    u.searchParams.set("utm_campaign", campaign);
    u.searchParams.set("utm_content", content);
    return u.toString();
  } catch {
    const sep = baseUrl.includes("?") ? "&" : "?";
    return `${baseUrl}${sep}utm_source=${encodeURIComponent(source)}&utm_medium=social&utm_campaign=${encodeURIComponent(campaign)}&utm_content=${encodeURIComponent(content)}`;
  }
}

function variantCaption(title: string, excerpt: string, url: string, variant: number, platform: string) {
  const hooks = [
    title,
    `Você já viu isso? ${title}`,
    `Entenda o que está por trás: ${title}`,
    `Vale a leitura: ${title}`,
    `O que você acha sobre isso? ${title}`,
    `Atualização importante: ${title}`,
    `Se esse assunto te interessa, confira: ${title}`,
  ];
  const hook = hooks[(variant - 1) % hooks.length];
  const summary = excerpt ? `\n\n${excerpt.slice(0, platform === "threads" ? 220 : 520)}` : "";
  const cta = platform === "instagram" ? `\n\nLeia o artigo completo: ${url}` : `\n\nLeia mais: ${url}`;
  const max = platform === "threads" ? 500 : 2100;
  return `${hook}${summary}${cta}`.slice(0, max);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) throw new Error("Unauthorized");

    const token = authHeader.replace("Bearer ", "").trim();
    const authed = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: auth } = await authed.auth.getUser(token);
    if (!auth?.user) throw new Error("Unauthorized");

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const body = await req.json();
    const userId = auth.user.id;
    const articleId: string | null = body.articleId || null;
    const targetKeys: string[] = Array.isArray(body.targetKeys) ? body.targetKeys.filter(Boolean) : [];
    const preset = PRESETS[body.preset] ? body.preset : "normal";
    const publishWordPress = Boolean(body.publishWordPress);
    const campaignSlug = clean(body.utmCampaign || "autopostwp").toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-|-$/g, "") || "autopostwp";
    const startAt = body.startAt ? new Date(body.startAt) : new Date();

    if (!targetKeys.length) throw new Error("Selecione ao menos uma conta social.");

    let title = clean(body.title);
    let excerpt = clean(body.excerpt);
    let imageUrl: string | null = body.imageUrl || null;
    let baseUrl = clean(body.baseUrl);
    let sourceType = body.sourceType === "custom" ? "custom" : "article";

    if (articleId) {
      const { data: article } = await admin.from("articles").select("*").eq("id", articleId).eq("user_id", userId).maybeSingle();
      if (!article) throw new Error("Artigo não encontrado.");
      title = title || clean(article.title);
      excerpt = excerpt || clean(article.excerpt || article.meta_description || article.content).slice(0, 700);
      imageUrl = imageUrl || article.featured_image_url || null;

      if (!baseUrl) {
        const { data: log } = await admin.from("publish_log")
          .select("published_url")
          .eq("article_id", articleId)
          .eq("platform", "wordpress")
          .eq("status", "success")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        baseUrl = log?.published_url || "";
      }
    }

    if (!title) throw new Error("Título obrigatório.");
    if (!baseUrl) throw new Error("Informe a URL do artigo. Para artigos do WordPress, publique o artigo primeiro para obter a URL canônica.");

    const offsets = PRESETS[preset];
    const { data: campaign, error: campaignError } = await admin.from("social_campaigns").insert({
      user_id: userId,
      article_id: articleId,
      name: clean(body.name) || `${title.slice(0, 70)} · ${preset}`,
      source_type: sourceType,
      base_url: baseUrl,
      preset,
      publish_wordpress: publishWordPress,
      status: "active",
      target_keys: targetKeys,
      utm_campaign: campaignSlug,
      total_items: offsets.length * targetKeys.length,
    }).select("*").single();
    if (campaignError) throw campaignError;

    const created: any[] = [];
    for (let v = 0; v < offsets.length; v++) {
      for (let t = 0; t < targetKeys.length; t++) {
        const key = targetKeys[t];
        const platform = platformFromKey(key);
        const jitterMinutes = v === 0 ? 0 : ((v * 17 + t * 11) % 31);
        const scheduledAt = new Date(startAt.getTime() + (offsets[v] + jitterMinutes) * 60_000);
        const utmContent = `v${v + 1}-${platform}`;
        const destination = withUtm(baseUrl, platform, campaignSlug, utmContent);
        const caption = variantCaption(title, excerpt, destination, v + 1, platform);

        const { data: queueRow, error: queueError } = await admin.from("social_queue").insert({
          user_id: userId,
          article_id: articleId,
          target_keys: [key],
          caption,
          image_url: imageUrl,
          link_url: destination,
          scheduled_at: scheduledAt.toISOString(),
          status: "pending",
          attempts: 0,
          max_attempts: 4,
        }).select("id").single();
        if (queueError) throw queueError;

        await admin.from("social_campaign_items").insert({
          campaign_id: campaign.id,
          user_id: userId,
          queue_id: queueRow.id,
          target_key: key,
          platform,
          variant: v + 1,
          destination_url: destination,
          utm_source: platform,
          utm_medium: "social",
          utm_campaign: campaignSlug,
          utm_content: utmContent,
          scheduled_at: scheduledAt.toISOString(),
        });
        created.push({ queueId: queueRow.id, targetKey: key, platform, variant: v + 1, scheduledAt, destination });
      }
    }

    return new Response(JSON.stringify({
      success: true,
      campaign,
      items: created,
      message: `Campanha criada com ${created.length} publicação(ões) e links UTM individuais.`,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    console.error("create-social-campaign error:", error);
    return new Response(JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Erro desconhecido" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
