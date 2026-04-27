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
    console.log(`WP Config: url=${wpUrl}, user=${normalizedUsername}, pwd_len=${wpPassword?.length}, pwd_start=${wpPassword?.substring(0,4)}`);

    // --- Helper: find or create WP category ---
    async function resolveWpCategory(authHeader: string, categoryName: string): Promise<number | null> {
      const categoryLabels: Record<string, string> = {
        esportes: "Esportes",
        politica: "Política",
        policia: "Polícia",
        saude: "Saúde e Bem-Estar",
        celebridades: "Celebridades",
        financas: "Finanças",
      };
      const label = categoryLabels[categoryName] || categoryName;
      const slug = categoryName.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-");

      try {
        // Search existing categories
        const searchResp = await fetch(`${wpUrl}/wp-json/wp/v2/categories?search=${encodeURIComponent(label)}&per_page=100`, {
          headers: { Authorization: authHeader },
        });
        if (searchResp.ok) {
          const cats = await searchResp.json();
          const match = cats.find((c: any) =>
            c.slug === slug || c.name.toLowerCase() === label.toLowerCase()
          );
          if (match) { console.log(`Found WP category: ${match.name} (id=${match.id})`); return match.id; }
        }

        // Also try by slug directly
        const slugResp = await fetch(`${wpUrl}/wp-json/wp/v2/categories?slug=${slug}`, {
          headers: { Authorization: authHeader },
        });
        if (slugResp.ok) {
          const slugCats = await slugResp.json();
          if (slugCats.length > 0) { console.log(`Found WP category by slug: ${slugCats[0].name} (id=${slugCats[0].id})`); return slugCats[0].id; }
        }

        // Create category if not found
        const createResp = await fetch(`${wpUrl}/wp-json/wp/v2/categories`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: authHeader },
          body: JSON.stringify({ name: label, slug }),
        });
        if (createResp.ok) {
          const newCat = await createResp.json();
          console.log(`Created WP category: ${newCat.name} (id=${newCat.id})`);
          return newCat.id;
        }
      } catch (err) { console.error("Category resolution error:", err); }
      return null;
    }

    // --- Helper: publish via standard REST API ---
    async function publishStandard(authHeader: string) {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        "Authorization": authHeader,
        "X-WP-Nonce": "", // Some servers require this even if empty to allow REST
      };
      const body: Record<string, unknown> = {
        title: article.title,
        content: article.content || "",
        status: "draft",
        excerpt: article.excerpt || article.meta_description || "",
      };

      // Resolve WordPress category
      const wpCategoryId = await resolveWpCategory(authHeader, article.category);
      if (wpCategoryId) {
        body.categories = [wpCategoryId];
      }

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

      // Note: Yoast SEO meta fields will be set via a separate update after post creation
      // to avoid WordPress crashing if Yoast is not installed or meta keys are unregistered

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
      // If response is an array, the POST was likely converted to GET by a redirect
      if (Array.isArray(rawData)) {
        throw new Error("WordPress retornou uma listagem em vez de criar o post. Verifique se a URL usa HTTPS e se as credenciais estão corretas.");
      }
      const wpPostId = rawData?.id ?? rawData?.post_id ?? null;
      let wpLink = rawData?.link ?? rawData?.guid?.rendered ?? null;

      // Step 2: Update post to "publish" status + set Yoast SEO meta
      if (wpPostId) {
        const auth = btoa(`${normalizedUsername}:${wpPassword}`);
        const updateBody: Record<string, unknown> = { status: "publish" };

        // Set Yoast SEO meta fields (focus keyword, meta description, SEO title)
        const yoastMeta: Record<string, string> = {};
        if (article.seo_title) yoastMeta._yoast_wpseo_title = article.seo_title;
        if (article.meta_description) yoastMeta._yoast_wpseo_metadesc = article.meta_description;
        if (article.seo_keyword) yoastMeta._yoast_wpseo_focuskw = article.seo_keyword;

        if (Object.keys(yoastMeta).length > 0) {
          updateBody.meta = yoastMeta;
        }

        try {
          const publishResp = await fetch(`${wpUrl}/wp-json/wp/v2/posts/${wpPostId}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json", "Authorization": `Basic ${auth}` },
            body: JSON.stringify(updateBody),
          });
          if (publishResp.ok) {
            const publishData = await publishResp.json();
            wpLink = publishData?.link || wpLink;
            console.log(`Post ${wpPostId} published with Yoast SEO meta: focuskw="${article.seo_keyword}", metadesc="${article.meta_description?.substring(0, 50)}..."`);
          } else {
            const errText = await publishResp.text();
            console.error(`Failed to publish post ${wpPostId}: ${publishResp.status} ${errText.substring(0, 200)}`);

            // If meta update fails (unregistered keys), retry without meta
            if (errText.includes("rest_invalid_param") || errText.includes("meta")) {
              console.log("Retrying publish without meta (Yoast may not be installed)...");
              const retryResp = await fetch(`${wpUrl}/wp-json/wp/v2/posts/${wpPostId}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json", "Authorization": `Basic ${auth}` },
                body: JSON.stringify({ status: "publish" }),
              });
              if (retryResp.ok) {
                const retryData = await retryResp.json();
                wpLink = retryData?.link || wpLink;
                console.log(`Post ${wpPostId} published (without Yoast meta - plugin may not be installed)`);
              }
            }
          }
        } catch (pubErr) {
          console.error("Error publishing post:", pubErr);
        }
      }

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

      // Keep only the 30 most recent published articles per user
      try {
        const { data: oldPublished } = await supabase
          .from("articles")
          .select("id")
          .eq("user_id", userId)
          .eq("status", "published")
          .order("published_at", { ascending: false })
          .order("created_at", { ascending: false })
          .range(30, 500);

        const oldIds = (oldPublished || []).map((item: any) => item.id);
        if (oldIds.length > 0) {
          await supabase.from("publish_log").delete().in("article_id", oldIds);
          await supabase.from("articles").delete().in("id", oldIds);
          console.log(`Retention cleanup removed ${oldIds.length} old published articles`);
        }
      } catch (cleanupErr) {
        console.error("Retention cleanup failed:", cleanupErr);
      }

      // Trigger social publishing (Instagram feed + Stories + Facebook page Stories)
      // Fire-and-forget but await briefly so logs are written before response
      try {
        const socialResp = await fetch(`${supabaseUrl}/functions/v1/publish-social`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${supabaseKey}`,
          },
          body: JSON.stringify({ articleId, userId }),
        });
        const socialText = await socialResp.text();
        console.log(`publish-social response ${socialResp.status}: ${socialText.substring(0, 300)}`);
      } catch (socialErr) {
        console.error("publish-social call failed:", socialErr);
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: `✅ Artigo publicado! WP: ✅ | FB: ✅ | IG: ✅`,
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
    const message = error instanceof Error ? error.message : "Erro desconhecido";
    const isMissingConfiguration =
      message.includes("Configurações") ||
      message.includes("não configurad") ||
      message.includes("não encontrado");

    return new Response(
      JSON.stringify({ success: false, error: message, message }),
      { status: isMissingConfiguration ? 200 : 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
