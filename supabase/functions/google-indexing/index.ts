import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { url, userId, articleId } = await req.json();
    if (!url || !userId) throw new Error("URL and userId are required");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const encKey = Deno.env.get("DB_ENCRYPTION_KEY") || "";
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch settings
    const { data: settings, error: settingsError } = await supabase
      .from("user_settings")
      .select("google_indexing_key, google_search_console_token")
      .eq("user_id", userId)
      .single();

    if (settingsError) throw settingsError;

    let accessToken = "";

    // 1. Try Google Search Console Token (OAuth) first
    if (settings?.google_search_console_token) {
      try {
        const tokenData = JSON.parse(settings.google_search_console_token);
        accessToken = tokenData.access_token;
        
        // If expired or near expiration, we should refresh it here using tokenData.refresh_token
        // For now, let's assume it's fresh or the user just connected
      } catch (e) {
        console.error("Error parsing GSC token:", e);
      }
    }

    // 2. Fallback to Service Account Key (JSON)
    if (!accessToken && settings?.google_indexing_key) {
      let jsonKey = settings.google_indexing_key;
      if (jsonKey.startsWith("ENCRYPTED:")) {
        const { data: decrypted } = await supabase.rpc("decrypt_credential", { val: jsonKey, enc_key: encKey });
        jsonKey = decrypted || jsonKey;
      }

      try {
        const sa = JSON.parse(jsonKey);
        const { JWT } = await import("https://esm.sh/google-auth-library@9.4.1");
        const client = new JWT({
          email: sa.client_email,
          key: sa.private_key,
          scopes: ["https://www.googleapis.com/auth/indexing"],
        });
        const token = await client.authorize();
        accessToken = token.access_token || "";
      } catch (e) {
        console.error("Error generating SA token:", e);
      }
    }

    if (!accessToken) {
      return new Response(JSON.stringify({ success: false, message: "Google Indexing not configured (OAuth or JSON key required)" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Call Google Indexing API
    const response = await fetch("https://indexing.googleapis.com/v1/urlNotifications:publish", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        url: url,
        type: "URL_UPDATED",
      }),
    });

    const result = await response.json();
    console.log("Google Indexing API result:", result);

    if (response.ok) {
      await supabase.from("google_indexing_history").insert({
        user_id: userId,
        article_id: articleId || null,
        url: url,
        status: 'success',
        response_details: result
      });

      await supabase.from("automation_logs").insert({
        user_id: userId,
        level: 'info',
        module: 'robot',
        message: `Solicitação de indexação enviada ao Google para: ${url}`,
        details: result
      });

      return new Response(JSON.stringify({ success: true, result }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } else {
      const errorMsg = result.error?.message || "Erro na Indexing API";
      
      await supabase.from("google_indexing_history").insert({
        user_id: userId,
        article_id: articleId || null,
        url: url,
        status: 'error',
        response_details: result
      });

      throw new Error(errorMsg);
    }

  } catch (error) {
    console.error("Google Indexing error:", error);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

