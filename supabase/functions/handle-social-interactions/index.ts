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

    // 1. Get all connected Facebook accounts for this user
    const { data: accounts, error: accountsError } = await supabase
      .from("facebook_accounts")
      .select("*")
      .eq("user_id", userId)
      .eq("is_active", true);

    if (accountsError) throw accountsError;

    // 2. Fallback to main settings if no specific accounts connected
    const { data: settings } = await supabase
      .from("user_settings")
      .select("facebook_page_id, facebook_access_token")
      .eq("user_id", userId)
      .single();

    const allPagesToAnalyze: Array<{ page_id: string; access_token: string; page_name?: string }> = [];

    if (accounts && accounts.length > 0) {
      for (const acc of accounts) {
        allPagesToAnalyze.push({
          page_id: acc.page_id,
          access_token: acc.access_token,
          page_name: acc.page_name
        });
      }
    } else if (settings?.facebook_page_id && settings?.facebook_access_token) {
      allPagesToAnalyze.push({
        page_id: settings.facebook_page_id,
        access_token: settings.facebook_access_token,
        page_name: "Página Principal"
      });
    }

    if (allPagesToAnalyze.length === 0) {
      return new Response(JSON.stringify({ message: "Nenhuma página conectada encontrada", newInteractions: 0 }), { 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }

    let totalProcessed = 0;

    for (const page of allPagesToAnalyze) {
      const { page_id: pageId, access_token: token } = page;

      // Decrypt token if it's using the standard encryption pattern (starts with enc:)
      // Though usually tokens in facebook_accounts are already stored or decrypted by RPC
      let finalToken = token;
      if (token.startsWith('enc:')) {
        const { data: decryptedToken } = await supabase.rpc("decrypt_credential", { enc_key: "", val: token });
        finalToken = decryptedToken || token;
      }

      try {
        // Fetch recent posts to find comments
        const postsResp = await fetch(`https://graph.facebook.com/v21.0/${pageId}/feed?fields=id,message,created_time,permalink_url&limit=5&access_token=${finalToken}`);
        
        if (!postsResp.ok) {
          console.error(`Error fetching feed for page ${pageId}:`, await postsResp.text());
          continue;
        }

        const posts = await postsResp.json();

        for (const post of (posts.data || [])) {
          // Fetch comments for each post
          const commentsResp = await fetch(`https://graph.facebook.com/v21.0/${post.id}/comments?fields=id,message,from{name,picture},created_time,permalink_url&limit=10&access_token=${finalToken}`);
          
          if (!commentsResp.ok) {
            console.error(`Error fetching comments for post ${post.id}:`, await commentsResp.text());
            continue;
          }

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
      } catch (pageErr) {
        console.error(`Error processing page ${pageId}:`, pageErr);
      }
    }

    return new Response(JSON.stringify({ success: true, newInteractions: totalProcessed }), { 
      headers: { ...corsHeaders, "Content-Type": "application/json" } 
    });

  } catch (error: any) {
    console.error("Error fetching interactions:", error);
    return new Response(JSON.stringify({ error: error.message }), { 
      status: 500, 
      headers: { ...corsHeaders, "Content-Type": "application/json" } 
    });
  }
});