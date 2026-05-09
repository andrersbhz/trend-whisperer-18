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

    // 1. Get user pages and tokens
    const { data: pagesData } = await supabase.functions.invoke('fetch-meta-metrics', { body: { userId } });
    const pages = pagesData?.pages || [];

    if (pages.length === 0) {
      return new Response(JSON.stringify({ message: "No connected pages found", newInteractions: 0 }), { 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }

    let totalProcessed = 0;

    for (const page of pages) {
      const pageId = page.page_id;
      // We need the page access token which should be in the page object or fetched again
      // fetch-meta-metrics returns the metrics, but not necessarily the token in a way we can use here easily
      // Let's assume we can get it from settings or the page object if handle-social-interactions is called after fetch-meta-metrics
      
      // For now, we'll try to fetch the token from facebook_accounts or user_settings
      const { data: account } = await supabase
        .from("facebook_accounts")
        .select("access_token")
        .eq("page_id", pageId)
        .eq("user_id", userId)
        .maybeSingle();
      
      let token = account?.access_token;
      if (!token) {
        const { data: settings } = await supabase.from("user_settings").select("facebook_access_token").eq("user_id", userId).single();
        token = settings?.facebook_access_token;
      }

      if (!token) continue;

      // Decrypt if necessary (assuming it might be encrypted)
      const { data: decryptedToken } = await supabase.rpc("decrypt_credential", { enc_key: "", val: token });
      const finalToken = decryptedToken || token;

      // 2. Fetch recent posts to find comments
      const postsResp = await fetch(`https://graph.facebook.com/v21.0/${pageId}/feed?fields=id,message,created_time,permalink_url&limit=5&access_token=${finalToken}`);
      const posts = await postsResp.json();

      for (const post of (posts.data || [])) {
        // Fetch comments for each post
        const commentsResp = await fetch(`https://graph.facebook.com/v21.0/${post.id}/comments?fields=id,message,from{name,picture},created_time,permalink_url&limit=10&access_token=${finalToken}`);
        const comments = await commentsResp.json();

        for (const comment of (comments.data || [])) {
          // Check if already exists
          const { data: existing } = await supabase
            .from("social_interactions")
            .select("id")
            .eq("external_id", comment.id)
            .maybeSingle();

          if (!existing) {
            await supabase.from("social_interactions").insert({
              user_id: userId,
              platform: "facebook",
              external_id: comment.id,
              page_id: pageId,
              author_name: comment.from?.name || "Anônimo",
              author_avatar: comment.from?.picture?.data?.url,
              content: comment.message,
              original_link: comment.permalink_url || post.permalink_url,
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
    console.error("Error fetching interactions:", error);
    return new Response(JSON.stringify({ error: error.message }), { 
      status: 500, 
      headers: { ...corsHeaders, "Content-Type": "application/json" } 
    });
  }
});