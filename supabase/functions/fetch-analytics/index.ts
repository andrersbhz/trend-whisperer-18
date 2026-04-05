import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { userId } = await req.json();
    if (!userId) throw new Error("userId is required");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Get user settings for GA property
    const { data: settings } = await supabase
      .from("user_settings")
      .select("google_analytics_property_id")
      .eq("user_id", userId)
      .single();

    if (!settings?.google_analytics_property_id) {
      throw new Error("Google Analytics não configurado");
    }

    // Generate simulated analytics data based on the property
    // In production, this would call Google Analytics Data API
    const now = new Date();
    const dailyViews = [];
    for (let i = 29; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      dailyViews.push({
        date: `${date.getDate()}/${date.getMonth() + 1}`,
        views: Math.floor(Math.random() * 500) + 100,
      });
    }

    const analytics = {
      pageviews: dailyViews.reduce((sum, d) => sum + d.views, 0),
      sessions: Math.floor(dailyViews.reduce((sum, d) => sum + d.views, 0) * 0.7),
      users: Math.floor(dailyViews.reduce((sum, d) => sum + d.views, 0) * 0.5),
      bounceRate: Math.floor(Math.random() * 30) + 35,
      avgSessionDuration: `${Math.floor(Math.random() * 3) + 1}:${String(Math.floor(Math.random() * 60)).padStart(2, "0")}`,
      topPages: [
        { page: "/artigo-principal", views: Math.floor(Math.random() * 200) + 50 },
        { page: "/esportes", views: Math.floor(Math.random() * 150) + 40 },
        { page: "/politica", views: Math.floor(Math.random() * 120) + 30 },
        { page: "/saude", views: Math.floor(Math.random() * 100) + 20 },
        { page: "/celebridades", views: Math.floor(Math.random() * 80) + 15 },
      ],
      trafficSources: [
        { source: "Google", value: Math.floor(Math.random() * 40) + 30 },
        { source: "Facebook", value: Math.floor(Math.random() * 20) + 10 },
        { source: "Instagram", value: Math.floor(Math.random() * 15) + 5 },
        { source: "Direto", value: Math.floor(Math.random() * 15) + 5 },
        { source: "Outros", value: Math.floor(Math.random() * 10) + 3 },
      ],
      dailyViews,
    };

    return new Response(JSON.stringify({ analytics }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
