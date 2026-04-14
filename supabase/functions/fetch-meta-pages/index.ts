import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const GRAPH_API = "https://graph.facebook.com/v19.0";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { accessToken } = await req.json();
    if (!accessToken) throw new Error("accessToken is required");

    // Fetch all pages the user manages
    const pagesRes = await fetch(
      `${GRAPH_API}/me/accounts?fields=id,name,access_token,category,picture{url},fan_count,instagram_business_account{id,name,username,profile_picture_url,followers_count}&limit=100`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    if (!pagesRes.ok) {
      const err = await pagesRes.json();
      throw new Error(err.error?.message || `Meta API error: ${pagesRes.status}`);
    }

    const pagesData = await pagesRes.json();

    const pages = (pagesData.data || []).map((page: any) => ({
      page_id: page.id,
      page_name: page.name,
      category: page.category || null,
      picture_url: page.picture?.data?.url || null,
      fan_count: page.fan_count || 0,
      page_access_token: page.access_token,
      instagram: page.instagram_business_account
        ? {
            id: page.instagram_business_account.id,
            name: page.instagram_business_account.name,
            username: page.instagram_business_account.username,
            profile_picture_url: page.instagram_business_account.profile_picture_url,
            followers_count: page.instagram_business_account.followers_count,
          }
        : null,
    }));

    return new Response(JSON.stringify({ pages }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("fetch-meta-pages error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
