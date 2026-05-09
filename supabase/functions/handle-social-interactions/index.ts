import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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

    // 1. Fetch user settings and decrypted keys
    const { data: settings } = await supabase.from("user_settings").select("*").eq("user_id", userId).single();
    
    // We'll need a way to get the Facebook Access Token from credentials or settings
    // Assuming it's in a specific field or we fetch from a known connection
    const fbAccessToken = settings?.facebook_access_token; // This might need decryption or adjustment based on how it's stored

    if (!fbAccessToken) {
      return new Response(JSON.stringify({ message: "Facebook connection not found" }), { 
        status: 200, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }

    // 2. Fetch recent comments from Meta API (Simplified logic)
    // In a real scenario, we'd iterate through pages
    const { data: pages } = await supabase.functions.invoke('fetch-meta-metrics', { body: { userId } });
    
    let totalProcessed = 0;
    
    for (const page of (pages?.pages || [])) {
      const pageId = page.page_id;
      const pageAccessToken = page.access_token || fbAccessToken;

      // Get recent posts to find comments
      const postsResp = await fetch(`https://graph.facebook.com/v21.0/${pageId}/feed?limit=5&access_token=${pageAccessToken}`);
      const posts = await postsResp.json();

      for (const post of (posts.data || [])) {
        const commentsResp = await fetch(`https://graph.facebook.com/v21.0/${post.id}/comments?limit=10&access_token=${pageAccessToken}`);
        const comments = await commentsResp.json();

        for (const comment of (comments.data || [])) {
          // Check if already processed
          const { data: existing } = await supabase
            .from("social_interactions")
            .select("id")
            .eq("external_id", comment.id)
            .maybeSingle();

          if (!existing) {
            // Save interaction
            await supabase.from("social_interactions").insert({
              user_id: userId,
              platform: "facebook",
              external_id: comment.id,
              page_id: pageId,
              author_name: comment.from?.name,
              content: comment.message,
              status: "pending"
            });
            totalProcessed++;
          }
        }
      }
    }

    return new Response(JSON.stringify({ success: true, newInteractions: totalProcessed }), { 
      headers: { ...corsHeaders, "Content-Type": "application/json" } 
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { 
      status: 500, 
      headers: { ...corsHeaders, "Content-Type": "application/json" } 
    });
  }
});
