import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function decryptField(supabase: any, val: string | null, encKey: string): Promise<string | null> {
  if (!val || !val.startsWith("ENCRYPTED:")) return val;
  const { data } = await supabase.rpc("decrypt_credential", { val, enc_key: encKey });
  return data || val;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { articleId, userId } = await req.json();
    if (!articleId || !userId) throw new Error("articleId and userId are required");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const encKey = Deno.env.get("DB_ENCRYPTION_KEY") || "";
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch article
    const { data: article, error: articleError } = await supabase
      .from("articles")
      .select("*")
      .eq("id", articleId)
      .eq("user_id", userId)
      .single();

    if (articleError || !article) throw new Error("Artigo não encontrado: " + (articleError?.message || ""));

    // Fetch settings
    const { data: settings, error: settingsError } = await supabase
      .from("user_settings")
      .select("*")
      .eq("user_id", userId)
      .single();

    if (settingsError || !settings) throw new Error("Configurações não encontradas. Vá para a página de Configurações.");

    if (!settings.wordpress_url) throw new Error("URL do WordPress não configurada. Vá para Configurações.");
    if (!settings.wordpress_app_password) throw new Error("Senha/chave do WordPress não configurada. Vá para Configurações.");

    // Update status
    await supabase.from("articles").update({ status: "publishing" }).eq("id", articleId);

    // Prepare WordPress connection
    let wpUrl = settings.wordpress_url.replace(/\/$/, "");
    if (!/^https?:\/\//i.test(wpUrl)) wpUrl = `https://${wpUrl}`;
    const hasPlugin = !settings.wordpress_username || settings.wordpress_username.toLowerCase() === 'autoblog-ai';

    // Decrypt password server-side
    const wpPassword = await decryptField(supabase, settings.wordpress_app_password, encKey) || settings.wordpress_app_password;

    console.log(`Publishing to WordPress: ${wpUrl}, mode: ${hasPlugin ? 'plugin' : 'standard'}, user: ${settings.wordpress_username || '(plugin)'}`);

    // Headers
    const wpHeaders: Record<string, string> = {
      "Content-Type": "application/json",
    };

    let publishEndpoint: string;

    if (hasPlugin) {
      wpHeaders["X-AutoBlog-Key"] = wpPassword;
      publishEndpoint = `${wpUrl}/wp-json/autoblog-ai/v1/publish`;
    } else {
      const auth = btoa(`${settings.wordpress_username}:${wpPassword}`);
      wpHeaders["Authorization"] = `Basic ${auth}`;
      publishEndpoint = `${wpUrl}/wp-json/wp/v2/posts`;
    }

    // Prepare post body
    const wpBody: Record<string, unknown> = hasPlugin
      ? {
          title: article.title,
          content: article.content || "",
          excerpt: article.excerpt || article.meta_description || "",
          status: "publish",
          seo_title: article.seo_title || article.title,
          meta_description: article.meta_description || "",
          seo_keyword: article.seo_keyword || "",
          featured_image_url: article.featured_image_url || "",
          categories: [article.category],
        }
      : {
          title: article.title,
          content: article.content || "",
          status: "publish",
          excerpt: article.excerpt || article.meta_description || "",
        };

    // Standard mode: handle featured image upload
    if (!hasPlugin && article.featured_image_url) {
      try {
        let featuredMediaId = null;

        if (article.featured_image_url.startsWith("data:image")) {
          const base64Data = article.featured_image_url.split(",")[1];
          const binaryData = Uint8Array.from(atob(base64Data), (c) => c.charCodeAt(0));
          const slug = (article.seo_keyword || article.title || "image").replace(/[^a-zA-Z0-9]/g, "-").substring(0, 50);

          const mediaResponse = await fetch(`${wpUrl}/wp-json/wp/v2/media`, {
            method: "POST",
            headers: {
              ...wpHeaders,
              "Content-Type": "image/png",
              "Content-Disposition": `attachment; filename="${slug}.png"`,
            },
            body: binaryData,
          });

          if (mediaResponse.ok) {
            const mediaData = await mediaResponse.json();
            featuredMediaId = mediaData.id;
          }
        } else if (article.featured_image_url.startsWith("http")) {
          try {
            const imgResp = await fetch(article.featured_image_url);
            if (imgResp.ok) {
              const imgData = new Uint8Array(await imgResp.arrayBuffer());
              const contentType = imgResp.headers.get("content-type") || "image/jpeg";
              const ext = contentType.includes("png") ? "png" : "jpg";
              const slug = (article.seo_keyword || "image").replace(/[^a-zA-Z0-9]/g, "-").substring(0, 50);

              const mediaResponse = await fetch(`${wpUrl}/wp-json/wp/v2/media`, {
                method: "POST",
                headers: {
                  ...wpHeaders,
                  "Content-Type": contentType,
                  "Content-Disposition": `attachment; filename="${slug}.${ext}"`,
                },
                body: imgData,
              });

              if (mediaResponse.ok) {
                const mediaData = await mediaResponse.json();
                featuredMediaId = mediaData.id;
              }
            }
          } catch (dlErr) {
            console.error("Image download failed:", dlErr);
          }
        }

        if (featuredMediaId) {
          wpBody.featured_media = featuredMediaId;
        }
      } catch (imgErr) {
        console.error("WP image upload failed:", imgErr);
      }

      // Yoast SEO meta
      if (article.seo_title || article.meta_description || article.seo_keyword) {
        wpBody.meta = {
          _yoast_wpseo_title: article.seo_title || article.title,
          _yoast_wpseo_metadesc: article.meta_description || "",
          _yoast_wpseo_focuskw: article.seo_keyword || "",
        };
      }
    }

    // Send the post
    console.log(`POST ${publishEndpoint}`);
    const wpResponse = await fetch(publishEndpoint, {
      method: "POST",
      headers: wpHeaders,
      body: JSON.stringify(wpBody),
    });

    const responseText = await wpResponse.text();
    console.log(`WordPress response ${wpResponse.status}: ${responseText.substring(0, 300)}`);

    if (wpResponse.ok) {
      const wpData = JSON.parse(responseText);
      await supabase.from("articles").update({
        wordpress_post_id: String(wpData.id),
        status: "published",
        published_at: new Date().toISOString(),
      }).eq("id", articleId);

      await supabase.from("publish_log").insert({
        user_id: userId,
        article_id: articleId,
        platform: "wordpress",
        status: "success",
        published_url: wpData.link,
      });

      return new Response(
        JSON.stringify({
          success: true,
          message: `✅ Artigo publicado no WordPress! ${wpData.link || ""}`,
          wpPostId: wpData.id,
          wpLink: wpData.link,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } else {
      // Parse error for better messages
      let errorDetail = responseText.substring(0, 300);
      try {
        const errJson = JSON.parse(responseText);
        if (errJson.code === "rest_cannot_create") {
          errorDetail = `O usuário "${settings.wordpress_username || 'plugin'}" não tem permissão para criar posts. Verifique se o usuário é Editor ou Administrador no WordPress.`;
        } else if (errJson.code === "invalid_username" || errJson.code === "incorrect_password") {
          errorDetail = "Usuário ou senha incorretos. Verifique suas credenciais nas Configurações.";
        } else if (errJson.message) {
          errorDetail = errJson.message;
        }
      } catch {}

      await supabase.from("articles").update({ status: "failed" }).eq("id", articleId);
      await supabase.from("publish_log").insert({
        user_id: userId,
        article_id: articleId,
        platform: "wordpress",
        status: "failed",
        error_message: errorDetail.substring(0, 500),
      });

      return new Response(
        JSON.stringify({
          success: false,
          message: `❌ Erro WordPress: ${errorDetail}`,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  } catch (error) {
    console.error("publish-article error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
