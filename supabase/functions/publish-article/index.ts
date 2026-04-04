import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { articleId, userId } = await req.json();
    if (!articleId || !userId) throw new Error("articleId and userId are required");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch article
    const { data: article } = await supabase
      .from("articles")
      .select("*")
      .eq("id", articleId)
      .eq("user_id", userId)
      .single();

    if (!article) throw new Error("Article not found");

    // Fetch settings
    const { data: settings } = await supabase
      .from("user_settings")
      .select("*")
      .eq("user_id", userId)
      .single();

    if (!settings) throw new Error("Settings not configured. Go to Settings page.");

    // Update status
    await supabase.from("articles").update({ status: "publishing" }).eq("id", articleId);

    const results: { wordpress?: boolean; facebook?: boolean; instagram?: boolean } = {};

    // 1. Publish to WordPress
    if (settings.wordpress_url && settings.wordpress_username && settings.wordpress_app_password) {
      try {
        const wpUrl = settings.wordpress_url.replace(/\/$/, "");
        const auth = btoa(`${settings.wordpress_username}:${settings.wordpress_app_password}`);

        // Upload featured image first if available
        let featuredMediaId = null;
        if (article.featured_image_url && article.featured_image_url.startsWith("data:image")) {
          try {
            const base64Data = article.featured_image_url.split(",")[1];
            const binaryData = Uint8Array.from(atob(base64Data), (c) => c.charCodeAt(0));

            const mediaResponse = await fetch(`${wpUrl}/wp-json/wp/v2/media`, {
              method: "POST",
              headers: {
                Authorization: `Basic ${auth}`,
                "Content-Type": "image/png",
                "Content-Disposition": `attachment; filename="${article.seo_keyword?.replace(/\s/g, "-") || "image"}.png"`,
              },
              body: binaryData,
            });

            if (mediaResponse.ok) {
              const mediaData = await mediaResponse.json();
              featuredMediaId = mediaData.id;
            }
          } catch (imgErr) {
            console.error("WP image upload failed:", imgErr);
          }
        }

        const wpBody: any = {
          title: article.title,
          content: article.content,
          status: "publish",
          excerpt: article.excerpt || "",
          meta: {
            _yoast_wpseo_title: article.seo_title || article.title,
            _yoast_wpseo_metadesc: article.meta_description || "",
            _yoast_wpseo_focuskw: article.seo_keyword || "",
          },
        };

        if (featuredMediaId) {
          wpBody.featured_media = featuredMediaId;
        }

        const wpResponse = await fetch(`${wpUrl}/wp-json/wp/v2/posts`, {
          method: "POST",
          headers: {
            Authorization: `Basic ${auth}`,
            "Content-Type": "application/json",
          },
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
          throw new Error(`WordPress error: ${wpResponse.status} - ${errText}`);
        }
      } catch (wpErr: any) {
        console.error("WordPress publish failed:", wpErr);
        await supabase.from("publish_log").insert({
          user_id: userId,
          article_id: articleId,
          platform: "wordpress",
          status: "failed",
          error_message: wpErr.message,
        });
      }
    }

    // 2. Post to Facebook
    if (settings.facebook_page_id && settings.facebook_access_token) {
      try {
        const wpPostUrl = results.wordpress
          ? (await supabase.from("publish_log").select("published_url").eq("article_id", articleId).eq("platform", "wordpress").single()).data?.published_url
          : null;

        const message = `📰 ${article.title}\n\n${article.excerpt || article.meta_description || ""}\n\n${wpPostUrl ? `Leia mais: ${wpPostUrl}` : ""}`;

        const fbResponse = await fetch(
          `https://graph.facebook.com/v18.0/${settings.facebook_page_id}/feed`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              message,
              access_token: settings.facebook_access_token,
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
          throw new Error(`Facebook error: ${fbResponse.status} - ${errText}`);
        }
      } catch (fbErr: any) {
        console.error("Facebook post failed:", fbErr);
        await supabase.from("publish_log").insert({
          user_id: userId,
          article_id: articleId,
          platform: "facebook",
          status: "failed",
          error_message: fbErr.message,
        });
      }
    }

    // 3. Post to Instagram
    if (settings.instagram_account_id && settings.facebook_access_token && article.featured_image_url) {
      try {
        // Instagram requires a public image URL. Skip if base64.
        if (!article.featured_image_url.startsWith("data:")) {
          const caption = `📰 ${article.title}\n\n${article.excerpt || ""}\n\n#noticias #brasil #${article.category}`;

          // Create media container
          const containerResponse = await fetch(
            `https://graph.facebook.com/v18.0/${settings.instagram_account_id}/media`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                image_url: article.featured_image_url,
                caption,
                access_token: settings.facebook_access_token,
              }),
            }
          );

          if (containerResponse.ok) {
            const containerData = await containerResponse.json();

            // Publish
            const publishResponse = await fetch(
              `https://graph.facebook.com/v18.0/${settings.instagram_account_id}/media_publish`,
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  creation_id: containerData.id,
                  access_token: settings.facebook_access_token,
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
            }
          }
        }
      } catch (igErr: any) {
        console.error("Instagram post failed:", igErr);
        await supabase.from("publish_log").insert({
          user_id: userId,
          article_id: articleId,
          platform: "instagram",
          status: "failed",
          error_message: igErr.message,
        });
      }
    }

    // Update final status
    const finalStatus = results.wordpress || results.facebook || results.instagram ? "published" : "failed";
    await supabase
      .from("articles")
      .update({ status: finalStatus, published_at: finalStatus === "published" ? new Date().toISOString() : null })
      .eq("id", articleId);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Artigo publicado! WP: ${results.wordpress ? "✅" : "❌"} | FB: ${results.facebook ? "✅" : "❌"} | IG: ${results.instagram ? "✅" : "❌"}`,
        results,
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
