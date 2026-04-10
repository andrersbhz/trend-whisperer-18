import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function decryptField(supabase: any, val: string | null, encKey: string): Promise<string | null> {
  if (!val || !val.startsWith("ENCRYPTED:")) return val;
  const { data } = await supabase.rpc("decrypt_credential", { val, enc_key: encKey });
  return data || val;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Not authenticated");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const encKey = Deno.env.get("DB_ENCRYPTION_KEY") || "";
    const supabase = createClient(supabaseUrl, supabaseKey);

    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!);
    const { data: { user }, error: authError } = await anonClient.auth.getUser(authHeader.replace("Bearer ", ""));
    if (authError || !user) throw new Error("Invalid token");

    const { data: settings } = await supabase
      .from("user_settings")
      .select("wordpress_url, wordpress_username, wordpress_app_password")
      .eq("user_id", user.id)
      .single();

    if (!settings?.wordpress_url || !settings?.wordpress_app_password) {
      return new Response(
        JSON.stringify({ success: false, error: "WordPress URL e senha não configurados" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Decrypt password server-side
    const wpPassword = await decryptField(supabase, settings.wordpress_app_password, encKey) || settings.wordpress_app_password;

    const wpUrl = settings.wordpress_url.replace(/\/$/, "");
    const isPlugin = !settings.wordpress_username || settings.wordpress_username.toLowerCase() === "autoblog-ai";

    let res: Response;
    if (isPlugin) {
      res = await fetch(`${wpUrl}/wp-json/autoblog-ai/v1/status`, {
        headers: { "X-AutoBlog-Key": wpPassword },
      });
    } else {
      const auth = btoa(`${settings.wordpress_username}:${wpPassword}`);
      res = await fetch(`${wpUrl}/wp-json/wp/v2/users/me`, {
        headers: { Authorization: `Basic ${auth}` },
      });
    }

    if (res.ok) {
      const data = await res.json();
      return new Response(
        JSON.stringify({ success: true, message: "Conexão OK!", data: { name: data.name || data.site_name || "WordPress" } }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } else {
      return new Response(
        JSON.stringify({ success: false, error: `WordPress retornou ${res.status}` }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  } catch (error) {
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Erro desconhecido" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
