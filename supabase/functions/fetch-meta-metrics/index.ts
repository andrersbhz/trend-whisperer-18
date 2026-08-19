import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { AuthorizationError, authorizeUserRequest } from "../_shared/authorize-user.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};
const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" };
const META_GRAPH_VERSION = Deno.env.get("META_GRAPH_VERSION") || "v21.0";
const GRAPH_API = `https://graph.facebook.com/${META_GRAPH_VERSION}`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: jsonHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const { userId } = await authorizeUserRequest(req, body?.userId || null);

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) throw new Error("Configuração interna do Supabase ausente");
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { data: settings } = await supabase
      .from("user_settings")
      .select("facebook_page_id, facebook_access_token")
      .eq("user_id", userId)
      .maybeSingle();

    const { data: fbAccounts, error: accountsError } = await supabase
      .from("facebook_accounts")
      .select("*")
      .eq("user_id", userId)
      .eq("is_active", true);
    if (accountsError) throw accountsError;

    const pages: Array<{ pageId: string; accessToken: string; pageName: string }> = [];

    if (settings?.facebook_page_id && settings?.facebook_access_token) {
      const { data: decryptedToken } = await supabase.rpc("decrypt_credential", {
        enc_key: "",
        val: settings.facebook_access_token,
      });
      pages.push({
        pageId: settings.facebook_page_id,
        accessToken: decryptedToken || settings.facebook_access_token,
        pageName: "Página Principal",
      });
    }

    for (const acc of fbAccounts || []) {
      if (pages.some((page) => page.pageId === acc.page_id)) continue;
      const { data: decryptedToken } = await supabase.rpc("decrypt_credential", {
        enc_key: "",
        val: acc.access_token,
      });
      pages.push({
        pageId: acc.page_id,
        accessToken: decryptedToken || acc.access_token,
        pageName: acc.page_name || acc.page_id,
      });
    }

    if (pages.length === 0) {
      return new Response(JSON.stringify({
        success: true,
        pages: [],
        notice: "Nenhuma página do Facebook configurada. Conecte uma página em Configurações.",
      }), { status: 200, headers: jsonHeaders });
    }

    const allMetrics: any[] = [];

    for (const page of pages) {
      const pageMetrics: any = {
        page_id: page.pageId,
        page_name: page.pageName,
        facebook: null,
        instagram: null,
      };
      const pageId = encodeURIComponent(page.pageId);
      const accessToken = encodeURIComponent(page.accessToken);

      try {
        const pageInfoResp = await fetch(
          `${GRAPH_API}/${pageId}?fields=name,fan_count,followers_count,talking_about_count,were_here_count,category,link,picture&access_token=${accessToken}`
        );
        if (pageInfoResp.ok) {
          pageMetrics.facebook = { ...(await pageInfoResp.json()) };
          pageMetrics.page_name = pageMetrics.facebook.name || page.pageName;
        } else {
          const err = await pageInfoResp.json().catch(() => ({}));
          console.error(`Page info error for ${page.pageId}:`, err?.error?.code || pageInfoResp.status);
          pageMetrics.facebook = { error: err.error?.message || "Erro ao acessar página" };
          allMetrics.push(pageMetrics);
          continue;
        }

        const insightsMetrics = [
          "page_post_engagements",
          "page_impressions",
          "page_engaged_users",
          "page_fan_adds",
        ];

        pageMetrics.facebook.insights = {};
        for (const metricName of insightsMetrics) {
          try {
            const insightsResp = await fetch(
              `${GRAPH_API}/${pageId}/insights?metric=${metricName}&period=day&since=${getDateDaysAgo(28)}&until=${getDateDaysAgo(0)}&access_token=${accessToken}`
            );

            if (insightsResp.ok) {
              const insightsData = await insightsResp.json();
              const metric = insightsData.data?.[0];
              if (metric) {
                const values = metric.values || [];
                const total = values.reduce((sum: number, value: any) => sum + (typeof value.value === "number" ? value.value : 0), 0);
                const latestValue = values[values.length - 1]?.value;
                const last7 = values.slice(-7);
                const prev7 = values.slice(-14, -7);
                const last7Total = last7.reduce((sum: number, value: any) => sum + (typeof value.value === "number" ? value.value : 0), 0);
                const prev7Total = prev7.reduce((sum: number, value: any) => sum + (typeof value.value === "number" ? value.value : 0), 0);
                const growth = prev7Total > 0 ? ((last7Total - prev7Total) / prev7Total) * 100 : 0;

                pageMetrics.facebook.insights[metricName] = {
                  total,
                  latest: typeof latestValue === "object" ? total : (latestValue ?? total),
                  growth: Math.round(growth),
                  daily: values.map((value: any) => ({
                    date: value.end_time?.split("T")[0],
                    value: typeof value.value === "number" ? value.value : 0,
                  })),
                };
              }
            } else {
              const err = await insightsResp.json().catch(() => ({}));
              console.warn(`Metric ${metricName} not available for ${page.pageId}:`, err.error?.code || insightsResp.status);
            }
          } catch (error) {
            console.error(`Error fetching ${metricName}:`, error instanceof Error ? error.message : "erro");
          }
        }

        const postsResp = await fetch(
          `${GRAPH_API}/${pageId}/posts?fields=id,message,created_time,shares,likes.limit(0).summary(true),comments.limit(0).summary(true),reactions.limit(0).summary(true),full_picture,permalink_url,type&limit=250&access_token=${accessToken}`
        );
        if (postsResp.ok) {
          const postsData = await postsResp.json();
          const posts = (postsData.data || []).map((post: any) => ({
            id: post.id,
            message: post.message?.substring(0, 100),
            created_time: post.created_time,
            type: post.type,
            permalink: post.permalink_url,
            image: post.full_picture,
            likes: post.likes?.summary?.total_count || 0,
            comments: post.comments?.summary?.total_count || 0,
            reactions: post.reactions?.summary?.total_count || 0,
            shares: post.shares?.count || 0,
          }));

          pageMetrics.facebook.posts = posts;
          pageMetrics.facebook.post_stats = {
            total_posts: posts.length,
            total_likes: posts.reduce((sum: number, post: any) => sum + post.likes, 0),
            total_comments: posts.reduce((sum: number, post: any) => sum + post.comments, 0),
            total_reactions: posts.reduce((sum: number, post: any) => sum + post.reactions, 0),
            total_shares: posts.reduce((sum: number, post: any) => sum + post.shares, 0),
            avg_engagement: posts.length > 0
              ? Math.round(posts.reduce((sum: number, post: any) => sum + post.likes + post.comments + post.shares, 0) / posts.length)
              : 0,
          };
        }

        const igResp = await fetch(
          `${GRAPH_API}/${pageId}?fields=instagram_business_account&access_token=${accessToken}`
        );
        if (igResp.ok) {
          const igData = await igResp.json();
          const igIdRaw = igData.instagram_business_account?.id;

          if (igIdRaw) {
            const igId = encodeURIComponent(igIdRaw);
            const igProfileResp = await fetch(
              `${GRAPH_API}/${igId}?fields=id,name,username,biography,followers_count,follows_count,media_count,profile_picture_url,website&access_token=${accessToken}`
            );
            if (igProfileResp.ok) pageMetrics.instagram = { ...(await igProfileResp.json()) };
            if (!pageMetrics.instagram) pageMetrics.instagram = {};
            pageMetrics.instagram.insights = {};

            const processTimeSeries = (metric: any) => {
              const values = metric.values || [];
              const total = values.reduce((sum: number, value: any) => sum + (typeof value.value === "number" ? value.value : 0), 0);
              const last7 = values.slice(-7);
              const prev7 = values.slice(-14, -7);
              const last7Total = last7.reduce((sum: number, value: any) => sum + (typeof value.value === "number" ? value.value : 0), 0);
              const prev7Total = prev7.reduce((sum: number, value: any) => sum + (typeof value.value === "number" ? value.value : 0), 0);
              const growth = prev7Total > 0 ? ((last7Total - prev7Total) / prev7Total) * 100 : 0;
              pageMetrics.instagram.insights[metric.name] = {
                total,
                growth: Math.round(growth),
                daily: values.map((value: any) => ({
                  date: value.end_time?.split("T")[0],
                  value: typeof value.value === "number" ? value.value : 0,
                })),
              };
            };

            try {
              const daySeriesResp = await fetch(
                `${GRAPH_API}/${igId}/insights?metric=reach,follower_count&period=day&since=${getDateDaysAgo(28)}&until=${getDateDaysAgo(0)}&access_token=${accessToken}`
              );
              if (daySeriesResp.ok) {
                const data = await daySeriesResp.json();
                for (const metric of data.data || []) processTimeSeries(metric);
              } else {
                console.error("IG day insights error:", daySeriesResp.status);
              }
            } catch (error) {
              console.error("IG day insights fetch failed:", error instanceof Error ? error.message : "erro");
            }

            try {
              const totalValueResp = await fetch(
                `${GRAPH_API}/${igId}/insights?metric=profile_views,website_clicks&metric_type=total_value&period=day&since=${getDateDaysAgo(28)}&until=${getDateDaysAgo(0)}&access_token=${accessToken}`
              );
              if (totalValueResp.ok) {
                const data = await totalValueResp.json();
                for (const metric of data.data || []) {
                  const totalValue = metric.total_value?.value;
                  pageMetrics.instagram.insights[metric.name] = {
                    total: typeof totalValue === "number" ? totalValue : 0,
                    growth: 0,
                    daily: [],
                  };
                }
              } else {
                console.error("IG total_value insights error:", totalValueResp.status);
              }
            } catch (error) {
              console.error("IG total_value insights fetch failed:", error instanceof Error ? error.message : "erro");
            }

            const igMediaResp = await fetch(
              `${GRAPH_API}/${igId}/media?fields=id,caption,media_type,media_url,thumbnail_url,permalink,timestamp,like_count,comments_count&limit=250&access_token=${accessToken}`
            );
            if (igMediaResp.ok) {
              const igMediaData = await igMediaResp.json();
              pageMetrics.instagram.posts = (igMediaData.data || []).map((media: any) => ({
                id: media.id,
                caption: media.caption?.substring(0, 100),
                type: media.media_type,
                media_url: media.media_url || media.thumbnail_url,
                permalink: media.permalink,
                timestamp: media.timestamp,
                likes: media.like_count || 0,
                comments: media.comments_count || 0,
              }));

              const igPosts = pageMetrics.instagram.posts;
              pageMetrics.instagram.post_stats = {
                total_posts: igPosts.length,
                total_likes: igPosts.reduce((sum: number, post: any) => sum + post.likes, 0),
                total_comments: igPosts.reduce((sum: number, post: any) => sum + post.comments, 0),
                avg_engagement: igPosts.length > 0
                  ? Math.round(igPosts.reduce((sum: number, post: any) => sum + post.likes + post.comments, 0) / igPosts.length)
                  : 0,
              };
            }

            const igDemoResp = await fetch(
              `${GRAPH_API}/${igId}/insights?metric=audience_city,audience_country,audience_gender_age&period=lifetime&access_token=${accessToken}`
            );
            if (igDemoResp.ok) {
              const demoData = await igDemoResp.json();
              pageMetrics.instagram.demographics = {};
              for (const metric of demoData.data || []) {
                pageMetrics.instagram.demographics[metric.name] = metric.values?.[0]?.value || {};
              }
            }
          }
        }
      } catch (error) {
        console.error(`Error fetching metrics for page ${page.pageId}:`, error instanceof Error ? error.message : "erro");
        pageMetrics.error = "Erro ao buscar métricas da página";
      }

      if (!pageMetrics.error) {
        await supabase
          .from("facebook_accounts")
          .update({ last_metrics: pageMetrics, metrics_updated_at: new Date().toISOString() })
          .eq("user_id", userId)
          .eq("page_id", page.pageId);
      }

      allMetrics.push(pageMetrics);
    }

    return new Response(JSON.stringify({ success: true, pages: allMetrics }), { headers: jsonHeaders });
  } catch (error) {
    const status = error instanceof AuthorizationError ? error.status : 500;
    const message = error instanceof AuthorizationError ? error.message : "Falha ao buscar métricas Meta";
    if (!(error instanceof AuthorizationError)) console.error("fetch-meta-metrics error:", error);
    return new Response(JSON.stringify({ error: message }), { status, headers: jsonHeaders });
  }
});

function getDateDaysAgo(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().split("T")[0];
}
