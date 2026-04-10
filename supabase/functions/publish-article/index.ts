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

    if (articleError || !article) throw new Error("Article not found: " + (articleError?.message || ""));

    // Fetch settings
    const { data: settings, error: settingsError } = await supabase
      .from("user_settings")
      .select("*")
      .eq("user_id", userId)
      .single();

    if (settingsError || !settings) throw new Error("Settings not configured. Go to Settings page.");

    // Update status
    await supabase.from("articles").update({ status: "publishing" }).eq("id", articleId);

    const results: { wordpress?: boolean; facebook?: boolean; instagram?: boolean } = {};
    const errors: string[] = [];

    // 1. Publish to WordPress (suporta plugin AutoBlog AI Connector ou REST API padrão)
    if (settings.wordpress_url && settings.wordpress_app_password) {
      try {
        const wpUrl = settings.wordpress_url.replace(/\/$/, "");
        const hasPlugin = !settings.wordpress_username || settings.wordpress_username.toLowerCase() === 'autoblog-ai';

        // Decrypt password server-side
        const wpPassword = await decryptField(supabase, settings.wordpress_app_password, encKey) || settings.wordpress_app_password;

        // Headers conforme o método de autenticação
        const wpHeaders: Record<string, string> = {
          "Content-Type": "application/json",
        };

        let publishEndpoint: string;

        if (hasPlugin) {
          // Modo Plugin AutoBlog AI Connector — usa chave API no header
          wpHeaders["X-AutoBlog-Key"] = wpPassword;
          publishEndpoint = `${wpUrl}/wp-json/autoblog-ai/v1/publish`;
        } else {
          // Modo padrão WP REST API — usa Application Password
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

        // No modo plugin, a imagem é enviada junto no body (URL ou base64)
        // No modo padrão, precisa fazer upload separado
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

          // Yoast SEO meta no modo padrão
          if (article.seo_title || article.meta_description || article.seo_keyword) {
            wpBody.meta = {
              _yoast_wpseo_title: article.seo_title || article.title,
              _yoast_wpseo_metadesc: article.meta_description || "",
              _yoast_wpseo_focuskw: article.seo_keyword || "",
            };
          }
        }

        // Enviar o post
        const wpResponse = await fetch(publishEndpoint, {
          method: "POST",
          headers: wpHeaders,
          body: JSON.stringify(wpBody),
        });

        if (wpResponse.ok) {
          const wpData = await wpResponse.json();
          await supabase.from("articles").update({ wordpress_post_id: String(wpData.id) }).eq("id", articleId);
          await supabase.from("publish_log").insert({
            user_id: userId,
            article_id: articleId,
            platform: "wordpress",
            status: "success",
            published_url: wpData.link,
          });
          results.wordpress = true;
        } else {
          const errText = await wpResponse.text();
          const msg = `WordPress ${wpResponse.status}: ${errText.substring(0, 200)}`;
          errors.push(msg);
          throw new Error(msg);
        }
      } catch (wpErr: any) {
        console.error("WordPress publish failed:", wpErr);
        await supabase.from("publish_log").insert({
          user_id: userId,
          article_id: articleId,
          platform: "wordpress",
          status: "failed",
          error_message: wpErr.message?.substring(0, 500),
        });
      }
    }

    // 2. Post to Facebook (support multiple accounts)
    const { data: fbAccounts } = await supabase
      .from("facebook_accounts")
      .select("*")
      .eq("user_id", userId)
      .eq("is_active", true);

    // Also check legacy settings
    const legacyFb = settings.facebook_page_id && settings.facebook_access_token;
    const allFbAccounts = [
      ...(fbAccounts || []),
      ...(legacyFb ? [{ page_id: settings.facebook_page_id, access_token: settings.facebook_access_token, instagram_account_id: settings.instagram_account_id }] : []),
    ];

    for (const fbAccount of allFbAccounts) {
      try {
        const wpPostUrl = results.wordpress
          ? (await supabase.from("publish_log").select("published_url").eq("article_id", articleId).eq("platform", "wordpress").single()).data?.published_url
          : null;

        const message = `📰 ${article.title}\n\n${article.excerpt || article.meta_description || ""}\n\n${wpPostUrl ? `Leia mais: ${wpPostUrl}` : ""}`.trim();

        const fbResponse = await fetch(
          `https://graph.facebook.com/v18.0/${fbAccount.page_id}/feed`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              message,
              link: wpPostUrl || undefined,
              access_token: fbAccount.access_token,
            }),
          }
        );

        if (fbResponse.ok) {
          const fbData = await fbResponse.json();
          await supabase.from("articles").update({ facebook_post_id: fbData.id }).eq("id", articleId);
          await supabase.from("publish_log").insert({
            user_id: userId,
            article_id: articleId,
            platform: "facebook",
            status: "success",
          });
          results.facebook = true;
        } else {
          const errText = await fbResponse.text();
          throw new Error(`Facebook ${fbResponse.status}: ${errText.substring(0, 200)}`);
        }
      } catch (fbErr: any) {
        console.error("Facebook post failed:", fbErr);
        errors.push(fbErr.message);
        await supabase.from("publish_log").insert({
          user_id: userId,
          article_id: articleId,
          platform: "facebook",
          status: "failed",
          error_message: fbErr.message?.substring(0, 500),
        });
      }

      // 3. Instagram via same account
      if (fbAccount.instagram_account_id && article.featured_image_url && !article.featured_image_url.startsWith("data:")) {
        try {
          const caption = `📰 ${article.title}\n\n${article.excerpt || ""}\n\n#noticias #brasil #${(article.category || "").replace(/\s/g, "")}`;

          const containerResponse = await fetch(
            `https://graph.facebook.com/v18.0/${fbAccount.instagram_account_id}/media`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                image_url: article.featured_image_url,
                caption,
                access_token: fbAccount.access_token,
              }),
            }
          );

          if (containerResponse.ok) {
            const containerData = await containerResponse.json();
            // Wait a bit for processing
            await new Promise(r => setTimeout(r, 3000));

            const publishResponse = await fetch(
              `https://graph.facebook.com/v18.0/${fbAccount.instagram_account_id}/media_publish`,
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  creation_id: containerData.id,
                  access_token: fbAccount.access_token,
                }),
              }
            );

            if (publishResponse.ok) {
              const publishData = await publishResponse.json();
              await supabase.from("articles").update({ instagram_post_id: publishData.id }).eq("id", articleId);
              await supabase.from("publish_log").insert({
                user_id: userId,
                article_id: articleId,
                platform: "instagram",
                status: "success",
              });
              results.instagram = true;
            } else {
              const errText = await publishResponse.text();
              throw new Error(`IG publish ${publishResponse.status}: ${errText.substring(0, 200)}`);
            }
          } else {
            const errText = await containerResponse.text();
            throw new Error(`IG container ${containerResponse.status}: ${errText.substring(0, 200)}`);
          }
        } catch (igErr: any) {
          console.error("Instagram post failed:", igErr);
          errors.push(igErr.message);
          await supabase.from("publish_log").insert({
            user_id: userId,
            article_id: articleId,
            platform: "instagram",
            status: "failed",
            error_message: igErr.message?.substring(0, 500),
          });
        }
      }
    }

    // Update final status
    const anySuccess = results.wordpress || results.facebook || results.instagram;
    const finalStatus = anySuccess ? "published" : "failed";
    await supabase
      .from("articles")
      .update({
        status: finalStatus,
        published_at: finalStatus === "published" ? new Date().toISOString() : null,
      })
      .eq("id", articleId);

    const summary = `WP: ${results.wordpress ? "✅" : "❌"} | FB: ${results.facebook ? "✅" : "❌"} | IG: ${results.instagram ? "✅" : "❌"}`;

    return new Response(
      JSON.stringify({
        success: anySuccess,
        message: anySuccess ? `Artigo publicado! ${summary}` : `Falha na publicação. ${summary}. Erros: ${errors.join("; ").substring(0, 300)}`,
        results,
        errors: errors.length > 0 ? errors : undefined,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("publish-article error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
