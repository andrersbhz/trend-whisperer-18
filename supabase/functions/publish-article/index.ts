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
    if (!settings.wordpress_app_password) throw new Error("Senha de Aplicativo do WordPress não configurada. Vá para Configurações.");
    if (!settings.wordpress_username?.trim()) {
      throw new Error("Usuário do WordPress não configurado. Use seu usuário real do WordPress junto com uma Senha de Aplicativo.");
    }

    // Update status
    await supabase.from("articles").update({ status: "publishing" }).eq("id", articleId);

    // Prepare WordPress connection
    let wpUrl = settings.wordpress_url.replace(/\/$/, "");
    if (!/^https?:\/\//i.test(wpUrl)) wpUrl = `https://${wpUrl}`;
    // Force HTTPS to prevent redirect stripping POST body
    wpUrl = wpUrl.replace(/^http:\/\//i, "https://");
    const normalizedUsername = settings.wordpress_username.trim();
    const hasPlugin = normalizedUsername.toLowerCase() === 'autoblog-ai';
    const wpPassword = await decryptField(supabase, settings.wordpress_app_password, encKey) || settings.wordpress_app_password;

    // --- Helper: publish via standard REST API ---
    async function publishStandard(authHeader: string) {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        "Authorization": authHeader,
      };
      const body: Record<string, unknown> = {
        title: article.title,
        content: article.content || "",
        status: "publish",
        excerpt: article.excerpt || article.meta_description || "",
      };

      // Set slug if available
      if (article.seo_keyword) {
        body.slug = article.seo_keyword
          .toLowerCase()
          .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-|-$/g, "")
          .substring(0, 80);
      }

      // Featured image upload with alt text
      if (article.featured_image_url) {
        try {
          let featuredMediaId = null;
          const imgSlug = (article.seo_keyword || article.title || "image").replace(/[^a-zA-Z0-9]/g, "-").substring(0, 50);
          
          let uploadedMediaId = null;
          if (article.featured_image_url.startsWith("data:image")) {
            const base64Data = article.featured_image_url.split(",")[1];
            const binaryData = Uint8Array.from(atob(base64Data), (c) => c.charCodeAt(0));
            const mediaResponse = await fetch(`${wpUrl}/wp-json/wp/v2/media`, {
              method: "POST",
              headers: { ...headers, "Content-Type": "image/png", "Content-Disposition": `attachment; filename="${imgSlug}.png"` },
              body: binaryData,
            });
            if (mediaResponse.ok) { uploadedMediaId = (await mediaResponse.json()).id; }
          } else if (article.featured_image_url.startsWith("http")) {
            const imgResp = await fetch(article.featured_image_url);
            if (imgResp.ok) {
              const imgData = new Uint8Array(await imgResp.arrayBuffer());
              const contentType = imgResp.headers.get("content-type") || "image/jpeg";
              const ext = contentType.includes("png") ? "png" : "jpg";
              const mediaResponse = await fetch(`${wpUrl}/wp-json/wp/v2/media`, {
                method: "POST",
                headers: { ...headers, "Content-Type": contentType, "Content-Disposition": `attachment; filename="${imgSlug}.${ext}"` },
                body: imgData,
              });
              if (mediaResponse.ok) { uploadedMediaId = (await mediaResponse.json()).id; }
            }
          }
          
          if (uploadedMediaId) {
            featuredMediaId = uploadedMediaId;
            body.featured_media = featuredMediaId;
            
            // Update media with alt text and caption for SEO
            const altText = article.seo_keyword ? `${article.seo_keyword} - ${article.title}` : article.title;
            try {
              await fetch(`${wpUrl}/wp-json/wp/v2/media/${featuredMediaId}`, {
                method: "POST",
                headers,
                body: JSON.stringify({
                  alt_text: altText,
                  caption: article.excerpt || article.meta_description || "",
                  description: article.title,
                }),
              });
            } catch (altErr) { console.error("Failed to set image alt text:", altErr); }
          }
        } catch (imgErr) { console.error("WP image upload failed:", imgErr); }
      }

      // Yoast SEO + Jetpack meta
      body.meta = {
        _yoast_wpseo_title: article.seo_title || article.title,
        _yoast_wpseo_metadesc: article.meta_description || "",
        _yoast_wpseo_focuskw: article.seo_keyword || "",
        _yoast_wpseo_opengraph_title: article.seo_title || article.title,
        _yoast_wpseo_opengraph_description: article.meta_description || "",
        _yoast_wpseo_twitter_title: article.seo_title || article.title,
        _yoast_wpseo_twitter_description: article.meta_description || "",
        jetpack_seo_html_title: article.seo_title || article.title,
        advanced_seo_description: article.meta_description || "",
      };

      const endpoint = `${wpUrl}/wp-json/wp/v2/posts`;
      console.log(`POST (standard) ${endpoint}`);
      return fetch(endpoint, { method: "POST", headers, body: JSON.stringify(body) });
    }

    // --- Determine auth and attempt publish ---
    let wpResponse: Response;

    if (hasPlugin) {
      // Try plugin first
      const pluginEndpoint = `${wpUrl}/wp-json/autoblog-ai/v1/publish`;
      const pluginBody = {
        title: article.title,
        content: article.content || "",
        excerpt: article.excerpt || article.meta_description || "",
        status: "publish",
        seo_title: article.seo_title || article.title,
        meta_description: article.meta_description || "",
        seo_keyword: article.seo_keyword || "",
        featured_image_url: article.featured_image_url || "",
        categories: [article.category],
      };
      console.log(`POST (plugin) ${pluginEndpoint}`);
      wpResponse = await fetch(pluginEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-AutoBlog-Key": wpPassword },
        body: JSON.stringify(pluginBody),
      });

      if (wpResponse.status === 404) {
        throw new Error("O plugin AutoBlog AI Connector não está instalado nesse WordPress. Conecte usando usuário real do WordPress + Senha de Aplicativo.");
      }
    } else {
      const auth = btoa(`${normalizedUsername}:${wpPassword}`);
      wpResponse = await publishStandard(`Basic ${auth}`);
    }

    const responseText = await wpResponse.text();
    console.log(`WordPress response ${wpResponse.status}: ${responseText.substring(0, 300)}`);

    if (wpResponse.ok) {
      const rawData = JSON.parse(responseText);
      const wpData = Array.isArray(rawData) ? rawData[0] : rawData;
      const wpPostId = wpData?.id ?? wpData?.post_id ?? null;
      const wpLink = wpData?.link ?? wpData?.guid?.rendered ?? null;

      await supabase.from("articles").update({
        wordpress_post_id: wpPostId ? String(wpPostId) : null,
        status: "published",
        published_at: new Date().toISOString(),
      }).eq("id", articleId);

      await supabase.from("publish_log").insert({
        user_id: userId,
        article_id: articleId,
        platform: "wordpress",
        status: "success",
        published_url: wpLink,
      });

      return new Response(
        JSON.stringify({
          success: true,
          message: `✅ Artigo publicado no WordPress! ${wpLink || ""}`,
          wpPostId,
          wpLink,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } else {
      // Parse error for better messages
      let errorDetail = responseText.substring(0, 300);
      try {
        const errJson = JSON.parse(responseText);
        if (errJson.code === "rest_cannot_create") {
          errorDetail = `O usuário "${normalizedUsername}" não tem permissão para criar posts. Verifique se ele é Editor ou Administrador no WordPress.`;
        } else if (errJson.code === "invalid_username" || errJson.code === "incorrect_password") {
          errorDetail = "Usuário ou senha incorretos. Verifique suas credenciais nas Configurações.";
        } else if (errJson.code === "rest_no_route") {
          errorDetail = "A rota da API do WordPress não foi encontrada. Verifique a URL do site e se a REST API está ativa.";
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
