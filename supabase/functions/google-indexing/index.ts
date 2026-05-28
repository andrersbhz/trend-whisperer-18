import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { url, userId } = await req.json();
    if (!url || !userId) throw new Error("URL and userId are required");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const encKey = Deno.env.get("DB_ENCRYPTION_KEY") || "";
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch settings
    const { data: settings, error: settingsError } = await supabase
      .from("user_settings")
      .select("google_indexing_key")
      .eq("user_id", userId)
      .single();

    if (settingsError || !settings?.google_indexing_key) {
      return new Response(JSON.stringify({ success: false, message: "Google Indexing key not configured" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Decrypt key
    let jsonKey = settings.google_indexing_key;
    if (jsonKey.startsWith("ENCRYPTED:")) {
      const { data: decrypted } = await supabase.rpc("decrypt_credential", { val: jsonKey, enc_key: encKey });
      jsonKey = decrypted || jsonKey;
    }

    const serviceAccount = JSON.parse(jsonKey);
    
    // Get access token using JWT flow
    // We'll use a simplified implementation of the JWT flow for Google APIs
    async function getAccessToken(sa: any) {
      const header = { alg: "RS256", typ: "JWT" };
      const now = Math.floor(Date.now() / 1000);
      const claim = {
        iss: sa.client_email,
        scope: "https://www.googleapis.com/auth/indexing",
        aud: sa.token_uri,
        exp: now + 3600,
        iat: now,
      };

      // In Deno, we can use 'https://deno.land/x/djwt/mod.ts' or similar
      // But let's use a more robust way via esm.sh google-auth-library
      const { JWT } = await import("https://esm.sh/google-auth-library@9.4.1");
      const client = new JWT({
        email: sa.client_email,
        key: sa.private_key,
        scopes: ["https://www.googleapis.com/auth/indexing"],
      });
      const token = await client.authorize();
      return token.access_token;
    }

    const accessToken = await getAccessToken(serviceAccount);

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
      // Log success
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
      throw new Error(result.error?.message || "Erro desconhecido na Indexing API");
    }

  } catch (error) {
    console.error("Google Indexing error:", error);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
