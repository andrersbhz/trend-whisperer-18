import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { userId } = await req.json();
    if (!userId) throw new Error("userId is required");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // 1. Get user settings (WordPress credentials)
    const { data: settings } = await supabase
      .from("user_settings")
      .select("wordpress_url, wordpress_username, wordpress_app_password")
      .eq("user_id", userId)
      .single();

    // 2. Get publish_log counts
    const { data: logs } = await supabase
      .from("publish_log")
      .select("platform, status, created_at, published_url, article_id")
      .eq("user_id", userId);

    const wpLogs = (logs || []).filter(l => l.platform === "wordpress");
    const wpSuccess = wpLogs.filter(l => l.status === "success");

    // 3. Try to fetch Jetpack Publicize sharing data from WordPress
    let wpPostsWithShares = 0;
    let totalJetpackShares = 0;
    let sharesByNetwork: Record<string, number> = {};

    if (settings?.wordpress_url && settings?.wordpress_username && settings?.wordpress_app_password) {
      try {
        const { data: decrypted } = await supabase.rpc("decrypt_credential", {
          enc_key: "",
          val: settings.wordpress_app_password,
        });
        const password = decrypted || settings.wordpress_app_password;

        const wpUrl = settings.wordpress_url.replace(/\/+$/, "");
        const auth = btoa(`${settings.wordpress_username}:${password}`);

        const postsResp = await fetch(
          `${wpUrl}/wp-json/wp/v2/posts?per_page=100&status=publish&_fields=id,title,date,jetpack_publicize_connections,jetpack_sharing_enabled,meta`,
          {
            headers: { Authorization: `Basic ${auth}` },
          }
        );

        if (postsResp.ok) {
          const posts = await postsResp.json();
          
          try {
            const statsResp = await fetch(
              `${wpUrl}/wp-json/wpcom/v2/stats/summary`,
              { headers: { Authorization: `Basic ${auth}` } }
            );
            if (statsResp.ok) {
              const stats = await statsResp.json();
              if (stats.shares) {
                totalJetpackShares = stats.shares;
              }
            }
          } catch (e) {
            console.log("Jetpack stats not available");
          }

          for (const post of posts.slice(0, 20)) {
            try {
              const shareResp = await fetch(
                `${wpUrl}/wp-json/jetpack/v4/publicize/${post.id}`,
                { headers: { Authorization: `Basic ${auth}` } }
              );
              if (shareResp.ok) {
                const shareData = await shareResp.json();
                if (shareData && Array.isArray(shareData)) {
                  wpPostsWithShares++;
                  for (const share of shareData) {
                    const network = share.service || share.label || "unknown";
                    sharesByNetwork[network] = (sharesByNetwork[network] || 0) + 1;
                    totalJetpackShares++;
                  }
                }
              }
            } catch {
              // Ignore
            }
          }

          if (Object.keys(sharesByNetwork).length === 0) {
            try {
              const connectionsResp = await fetch(
                `${wpUrl}/wp-json/jetpack/v4/publicize/connections`,
                { headers: { Authorization: `Basic ${auth}` } }
              );
              if (connectionsResp.ok) {
                const connections = await connectionsResp.json();
                if (Array.isArray(connections)) {
                  for (const conn of connections) {
                    sharesByNetwork[conn.service || conn.label || "unknown"] = 0;
                  }
                }
              }
            } catch {
              // Ignore
            }
          }

          wpPostsWithShares = wpPostsWithShares || posts.filter((p: any) => 
            p.jetpack_sharing_enabled !== false
          ).length;
        }
      } catch (err) {
        console.error("Error fetching WordPress/Jetpack data:", err);
      }
    }

    const result = {
      publish_log: {
        wordpress: {
          total: wpLogs.length,
          success: wpSuccess.length,
          failed: wpLogs.filter(l => l.status === "failed").length,
          recent: wpSuccess.slice(-5).map(l => ({
            date: l.created_at,
            url: l.published_url,
          })),
        },
      },
      jetpack: {
        posts_with_sharing: wpPostsWithShares,
        total_shares: totalJetpackShares,
        shares_by_network: sharesByNetwork,
      },
      summary: {
        total_published_wp: wpSuccess.length,
        total_shared_social: totalJetpackShares,
        total_twitter: sharesByNetwork["twitter"] || sharesByNetwork["x"] || 0,
        total_linkedin: sharesByNetwork["linkedin"] || 0,
        total_tumblr: sharesByNetwork["tumblr"] || 0,
      },
    };

    return new Response(JSON.stringify({ success: true, metrics: result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("fetch-social-metrics error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
