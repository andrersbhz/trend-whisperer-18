import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const GRAPH_API = "https://graph.facebook.com/v21.0";

async function decryptField(supabase: any, val: string | null): Promise<string | null> {
  if (!val) return val;
  if (!val.startsWith("ENCRYPTED:")) return val;
  const { data } = await supabase.rpc("decrypt_credential", { val, enc_key: "" });
  return data || val;
}

// ---------- Professional caption + hashtags ----------

function cleanText(s: string | null): string {
  return (s || "").replace(/<[^>]+>/g, "").replace(/\s+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

function buildProfessionalCaption(article: any, wpLink: string | null): string {
  const title = cleanText(article.title);
  const excerpt = cleanText(article.excerpt || "");
  const body = cleanText(article.content || "");

  // Use excerpt when available, otherwise first 2-3 sentences of body
  let summary = excerpt;
  if (!summary && body) {
    const sentences = body.split(/(?<=[.!?])\s+/);
    summary = sentences.slice(0, 3).join(" ");
  }

  const divider = "━━━━━━━━━━━━━━━━━━";
  const cta = wpLink
    ? `📖 Leia o artigo completo:\n${wpLink}`
    : `💬 Compartilhe sua opinião nos comentários!`;

  // Hard cap ~2200; reserve room for CTA + link
  const reserved = (cta?.length || 0) + 60;
  const maxSummary = 2000 - title.length - reserved;
  const trimmedSummary =
    summary.length > maxSummary ? summary.substring(0, maxSummary - 3).trimEnd() + "..." : summary;

  return [
    title.toUpperCase(),
    divider,
    trimmedSummary,
    "",
    cta,
    "",
    "👉 Siga para mais conteúdos como este.",
  ]
    .filter(Boolean)
    .join("\n")
    .trim();
}

async function generateHashtags(article: any): Promise<string> {
  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  const fallback =
    `#noticias #atualidades #${(article.category || "geral").toString().toLowerCase().replace(/\s+/g, "")} #brasil #news #trending #informacao #conteudo`;
  if (!apiKey) return fallback;

  try {
    const prompt = `Gere EXATAMENTE 20 hashtags em português (pt-BR), relevantes ao tema do artigo, otimizadas para Instagram (mistura de hashtags amplas, médias e de nicho). Sem espaços, sem números no final, sem repetições. Responda APENAS com as hashtags separadas por espaço, começando cada uma com #.

Título: ${article.title}
Categoria: ${article.category || "geral"}
Resumo: ${cleanText(article.excerpt || article.content || "").substring(0, 500)}`;

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "user", content: prompt }],
      }),
    });
    if (!resp.ok) return fallback;
    const data = await resp.json();
    const text: string = data?.choices?.[0]?.message?.content || "";
    const tags = (text.match(/#[\p{L}0-9_]+/gu) || []).slice(0, 28).join(" ");
    return tags || fallback;
  } catch {
    return fallback;
  }
}

// ---------- Instagram publishing ----------

async function publishIgContainer(containerId: string, igId: string, token: string): Promise<string | null> {
  for (let i = 0; i < 15; i++) {
    const statusResp = await fetch(
      `${GRAPH_API}/${containerId}?fields=status_code,status&access_token=${encodeURIComponent(token)}`
    );
    if (statusResp.ok) {
      const s = await statusResp.json();
      if (s.status_code === "FINISHED") break;
      if (s.status_code === "ERROR") {
        console.error("IG container ERROR:", s);
        return null;
      }
    }
    await new Promise((r) => setTimeout(r, 2500));
  }
  const pubResp = await fetch(`${GRAPH_API}/${igId}/media_publish`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ creation_id: containerId, access_token: token }),
  });
  if (!pubResp.ok) {
    console.error("IG publish failed:", await pubResp.text());
    return null;
  }
  const data = await pubResp.json();
  return data.id || null;
}

async function postFirstComment(mediaId: string, message: string, token: string): Promise<boolean> {
  try {
    const resp = await fetch(`${GRAPH_API}/${mediaId}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, access_token: token }),
    });
    if (!resp.ok) {
      console.error("IG first comment failed:", await resp.text());
      return false;
    }
    return true;
  } catch (e) {
    console.error("IG first comment error:", e);
    return false;
  }
}

async function getInstagramPermalink(mediaId: string, token: string): Promise<string | null> {
  try {
    const r = await fetch(
      `${GRAPH_API}/${mediaId}?fields=permalink&access_token=${encodeURIComponent(token)}`
    );
    if (!r.ok) return null;
    const d = await r.json();
    return d.permalink || null;
  } catch {
    return null;
  }
}

async function publishInstagramDirect(
  _supabase: any,
  account: any
): Promise<{ ok: boolean; id?: string; error?: string }> {
  // Direct (login/password) posting not supported in edge runtime
  return { ok: false, error: "Conexão direta via login/senha não publica de fato. Use a conta oficial (Graph API)." };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { articleId, userId } = await req.json();
    if (!articleId || !userId) throw new Error("articleId and userId required");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: article } = await supabase
      .from("articles")
      .select("*")
      .eq("id", articleId)
      .eq("user_id", userId)
      .single();
    if (!article) throw new Error("Artigo não encontrado");

    const imageUrl = article.featured_image_url;
    const { data: lastLog } = await supabase
      .from("publish_log")
      .select("published_url")
      .eq("article_id", articleId)
      .eq("platform", "wordpress")
      .eq("status", "success")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const wpLink: string | null = lastLog?.published_url || null;

    if (!imageUrl || imageUrl.startsWith("data:")) {
      return new Response(
        JSON.stringify({ success: false, message: "Artigo sem imagem pública para publicar nas redes sociais." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Professional caption + hashtags (hashtags go in the FIRST COMMENT)
    const caption = buildProfessionalCaption(article, wpLink);
    const hashtags = await generateHashtags(article);
    const altText = cleanText(article.title).substring(0, 240);

    // 1. Collect Graph API Targets
    const { data: settings } = await supabase
      .from("user_settings")
      .select("facebook_page_id, facebook_access_token, instagram_account_id")
      .eq("user_id", userId)
      .single();

    const { data: fbAccounts } = await supabase
      .from("facebook_accounts")
      .select("*")
      .eq("user_id", userId)
      .eq("is_active", true);

    type Target = { pageId: string; pageToken: string; pageName: string; igId?: string | null };
    const targets: Target[] = [];

    if (settings?.facebook_page_id && settings?.facebook_access_token) {
      const tok = (await decryptField(supabase, settings.facebook_access_token)) || "";
      if (tok) {
        targets.push({
          pageId: settings.facebook_page_id,
          pageToken: tok,
          pageName: "Página Principal",
          igId: settings.instagram_account_id || null,
        });
      }
    }
    for (const acc of fbAccounts || []) {
      const tok = (await decryptField(supabase, acc.access_token)) || "";
      if (!tok) continue;
      if (targets.find((t) => t.pageId === acc.page_id)) continue;
      targets.push({
        pageId: acc.page_id,
        pageToken: tok,
        pageName: acc.page_name || acc.page_id,
        igId: acc.instagram_account_id || null,
      });
    }

    const { data: directAccounts } = await supabase
      .from("instagram_accounts_direct")
      .select("*")
      .eq("user_id", userId)
      .eq("is_active", true);

    const results: Array<{ target: string; channel: string; ok: boolean; id?: string; error?: string; permalink?: string }> = [];
    const processedTargets = new Set<string>();
    let firstIgFeedId: string | null = null;

    for (const t of targets) {
      const targetKey = `${t.pageId}-${t.igId || "no-ig"}`;
      if (processedTargets.has(targetKey)) continue;
      processedTargets.add(targetKey);

      // Official Instagram (Graph API) — PROFESSIONAL POSTING
      if (t.igId) {
        try {
          const containerResp = await fetch(`${GRAPH_API}/${t.igId}/media`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              image_url: imageUrl,
              caption,
              alt_text: altText, // accessibility
              access_token: t.pageToken,
            }),
          });
          if (containerResp.ok) {
            const c = await containerResp.json();
            const postId = await publishIgContainer(c.id, t.igId, t.pageToken);
            if (postId) {
              if (!firstIgFeedId) firstIgFeedId = postId;

              // Post hashtags as FIRST COMMENT (professional practice)
              await postFirstComment(postId, hashtags, t.pageToken);

              const permalink = await getInstagramPermalink(postId, t.pageToken);
              results.push({
                target: t.pageName,
                channel: "instagram_feed",
                ok: true,
                id: postId,
                permalink: permalink || undefined,
              });
              await supabase.from("publish_log").insert({
                user_id: userId,
                article_id: articleId,
                platform: "instagram",
                status: "success",
                published_url: permalink || `https://www.instagram.com/p/${postId}`,
              });
            } else {
              results.push({ target: t.pageName, channel: "instagram_feed", ok: false, error: "publish failed" });
            }
          } else {
            const err = await containerResp.text();
            console.error("IG container failed:", err);
            results.push({ target: t.pageName, channel: "instagram_feed", ok: false, error: err.substring(0, 300) });
          }
        } catch (e) {
          results.push({ target: t.pageName, channel: "instagram_feed", ok: false, error: String(e) });
        }
      }

      // Facebook Feed
      try {
        const fbPostResp = await fetch(`${GRAPH_API}/${t.pageId}/feed`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: caption, link: wpLink, access_token: t.pageToken }),
        });
        if (fbPostResp.ok) {
          const pd = await fbPostResp.json();
          results.push({ target: t.pageName, channel: "facebook_feed", ok: true, id: pd.id });
          await supabase.from("publish_log").insert({
            user_id: userId,
            article_id: articleId,
            platform: "facebook",
            status: "success",
            published_url: `https://www.facebook.com/${pd.id}`,
          });
        } else {
          const err = await fbPostResp.text();
          results.push({ target: t.pageName, channel: "facebook_feed", ok: false, error: err.substring(0, 300) });
        }
      } catch (e) {
        results.push({ target: t.pageName, channel: "facebook_feed", ok: false, error: String(e) });
      }
    }

    for (const acc of directAccounts || []) {
      const res = await publishInstagramDirect(supabase, acc);
      results.push({ target: acc.username, channel: "instagram_direct", ok: res.ok, id: res.id, error: res.error });
    }

    if (firstIgFeedId) {
      await supabase.from("articles").update({ instagram_post_id: firstIgFeedId }).eq("id", articleId);
    }

    const okCount = results.filter((r) => r.ok).length;
    return new Response(
      JSON.stringify({
        success: okCount > 0,
        message: `Publicado em ${okCount}/${results.length} canais sociais`,
        caption_preview: caption.substring(0, 200),
        hashtags_preview: hashtags,
        results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("publish-social error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
