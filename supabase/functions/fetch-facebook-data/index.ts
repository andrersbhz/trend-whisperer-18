import { Request, Response } from "https://deno.land/x/oak@v12.4.0/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { accessToken, pageId, adAccountId } = await req.json();

    if (!accessToken) {
      throw new Error('Facebook access token is required');
    }

    // 1. Fetch Page Info
    let pageInfo = null;
    if (pageId) {
      const pageRes = await fetch(
        `https://graph.facebook.com/v19.0/${pageId}?fields=name,followers_count,fan_count,username,picture&access_token=${accessToken}`
      );
      pageInfo = await pageRes.json();
    }

    // 2. Fetch Insights (Impressions, Reach, Engagement)
    let insights = null;
    if (pageId) {
      const insightsRes = await fetch(
        `https://graph.facebook.com/v19.0/${pageId}/insights?metric=page_impressions,page_post_engagements,page_video_views&period=day&access_token=${accessToken}`
      );
      insights = await insightsRes.json();
    }

    // 3. Fetch Marketing/Ads Data if adAccountId is provided
    let marketingStats = null;
    if (adAccountId) {
      const marketingRes = await fetch(
        `https://graph.facebook.com/v19.0/${adAccountId}/insights?fields=spend,cpc,cpm,ctr,impressions,clicks,reach&access_token=${accessToken}`
      );
      marketingStats = await marketingRes.json();
    }

    return new Response(
      JSON.stringify({
        page: pageInfo,
        insights: insights?.data || [],
        marketing: marketingStats?.data?.[0] || null,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
