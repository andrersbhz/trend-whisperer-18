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

// Poll IG container until FINISHED, then publish
async function publishIgContainer(igId: string, containerId: string, token: string): Promise<string | null> {
  for (let i = 0; i < 12; i++) {
    const statusResp = await fetch(
      `${GRAPH_API}/${containerId}?fields=status_code&access_token=${encodeURIComponent(token)}`
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

    // Need an image URL (publicly fetchable) and a WP link
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

    // Build full caption: title + excerpt/content trimmed + link at end
    const cleanText = (s: string | null) =>
      (s || "").replace(/<[^>]+>/g, "").replace(/\n{3,}/g, "\n\n").trim();
    const title = cleanText(article.title);
    const body = cleanText(article.excerpt || article.content || "");
    // Instagram caption hard limit ~2200 chars; reserve ~200 for link/hashtags
    const reserved = 250;
    const maxBody = 2200 - title.length - reserved;
    const trimmedBody = body.length > maxBody ? body.substring(0, maxBody - 3) + "..." : body;
    const linkSuffix = wpLink ? `\n\nLeia o artigo completo: ${wpLink}` : "";
    const caption = `${title}\n\n${trimmedBody}${linkSuffix}`.trim();

    // Collect all FB pages (settings + facebook_accounts)
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

    if (targets.length === 0) {
      return new Response(
        JSON.stringify({ success: false, message: "Nenhuma página do Facebook conectada." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const results: Array<{ target: string; channel: string; ok: boolean; id?: string; error?: string }> = [];
    let firstIgFeedId: string | null = null;

    for (const t of targets) {
      // ===== Instagram Feed =====
      if (t.igId) {
        try {
          const containerResp = await fetch(`${GRAPH_API}/${t.igId}/media`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              image_url: imageUrl,
              caption,
              access_token: t.pageToken,
            }),
          });
          if (containerResp.ok) {
            const c = await containerResp.json();
            const postId = await publishIgContainer(t.igId, c.id, t.pageToken);
            if (postId) {
              if (!firstIgFeedId) firstIgFeedId = postId;
              results.push({ target: t.pageName, channel: "instagram_feed", ok: true, id: postId });
              await supabase.from("publish_log").insert({
                user_id: userId, article_id: articleId, platform: "instagram", status: "success",
                published_url: `https://www.instagram.com/p/${postId}`,
              });
            } else {
              results.push({ target: t.pageName, channel: "instagram_feed", ok: false, error: "publish failed" });
            }
          } else {
            const err = await containerResp.text();
            console.error(`IG feed container failed (${t.pageName}):`, err);
            results.push({ target: t.pageName, channel: "instagram_feed", ok: false, error: err.substring(0, 200) });
          }
        } catch (e) {
          results.push({ target: t.pageName, channel: "instagram_feed", ok: false, error: String(e) });
        }

        // ===== Instagram Stories =====
        try {
          const storyResp = await fetch(`${GRAPH_API}/${t.igId}/media`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              image_url: imageUrl,
              media_type: "STORIES",
              access_token: t.pageToken,
            }),
          });
          if (storyResp.ok) {
            const c = await storyResp.json();
            const storyId = await publishIgContainer(t.igId, c.id, t.pageToken);
            results.push({ target: t.pageName, channel: "instagram_story", ok: !!storyId, id: storyId || undefined });
          } else {
            const err = await storyResp.text();
            console.error(`IG story failed (${t.pageName}):`, err);
            results.push({ target: t.pageName, channel: "instagram_story", ok: false, error: err.substring(0, 200) });
          }
        } catch (e) {
          results.push({ target: t.pageName, channel: "instagram_story", ok: false, error: String(e) });
        }
      }

      // ===== Facebook Page Story (photo story) =====
      try {
        // Step 1: upload unpublished photo
        const photoResp = await fetch(`${GRAPH_API}/${t.pageId}/photos`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            url: imageUrl,
            published: false,
            access_token: t.pageToken,
          }),
        });
        if (!photoResp.ok) {
          const err = await photoResp.text();
          console.error(`FB photo upload failed (${t.pageName}):`, err);
          results.push({ target: t.pageName, channel: "facebook_story", ok: false, error: err.substring(0, 200) });
        } else {
          const photo = await photoResp.json();
          // Step 2: publish as photo story
          const storyResp = await fetch(`${GRAPH_API}/${t.pageId}/photo_stories`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              photo_id: photo.id,
              access_token: t.pageToken,
            }),
          });
          if (storyResp.ok) {
            const sd = await storyResp.json();
            results.push({ target: t.pageName, channel: "facebook_story", ok: true, id: sd.post_id || sd.id });
          } else {
            const err = await storyResp.text();
            console.error(`FB story publish failed (${t.pageName}):`, err);
            results.push({ target: t.pageName, channel: "facebook_story", ok: false, error: err.substring(0, 200) });
          }
        }
      } catch (e) {
        results.push({ target: t.pageName, channel: "facebook_story", ok: false, error: String(e) });
      }
      // ===== Facebook Page Post (Feed) =====
      try {
        const fbPostResp = await fetch(`${GRAPH_API}/${t.pageId}/feed`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: caption,
            link: wpLink,
            access_token: t.pageToken,
          }),
        });
        if (fbPostResp.ok) {
          const pd = await fbPostResp.json();
          results.push({ target: t.pageName, channel: "facebook_feed", ok: true, id: pd.id });
          await supabase.from("publish_log").insert({
            user_id: userId, article_id: articleId, platform: "facebook", status: "success",
            published_url: `https://www.facebook.com/${pd.id}`,
          });
        } else {
          const err = await fbPostResp.text();
          console.error(`FB feed post failed (${t.pageName}):`, err);
          results.push({ target: t.pageName, channel: "facebook_feed", ok: false, error: err.substring(0, 200) });
        }
      } catch (e) {
        results.push({ target: t.pageName, channel: "facebook_feed", ok: false, error: String(e) });
      }
    }

    if (firstIgFeedId) {
      await supabase.from("articles").update({ instagram_post_id: firstIgFeedId }).eq("id", articleId);
    }

    const okCount = results.filter((r) => r.ok).length;
    return new Response(
      JSON.stringify({
        success: okCount > 0,
        message: `Publicado em ${okCount}/${results.length} canais sociais`,
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
