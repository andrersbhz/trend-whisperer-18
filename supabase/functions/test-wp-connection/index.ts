import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function decryptField(supabase: any, val: string | null, encKey: string): Promise<string | null> {
  if (!val || !val.startsWith("ENCRYPTED:")) return val;
  const { data, error } = await supabase.rpc("decrypt_credential", { val, enc_key: encKey });
  if (error) {
    console.error("Decrypt error:", error);
    return null;
  }
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
    const rawPwd = settings.wordpress_app_password;
    const isEncrypted = rawPwd.startsWith("ENCRYPTED:");
    console.log(`Password encrypted: ${isEncrypted}, encKey available: ${!!encKey && encKey.length > 0}`);
    
    const wpPassword = await decryptField(supabase, rawPwd, encKey);
    if (!wpPassword) {
      return new Response(
        JSON.stringify({ success: false, error: "Falha ao descriptografar a senha. Tente salvar novamente nas Configurações." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    // Log password info for debugging (length only, not the actual value)
    console.log(`Decrypted password length: ${wpPassword.length}, still encrypted: ${wpPassword.startsWith("ENCRYPTED:")}`);

    let wpUrl = settings.wordpress_url.replace(/\/$/, "");
    if (!/^https?:\/\//i.test(wpUrl)) wpUrl = `https://${wpUrl}`;
    const isPlugin = !settings.wordpress_username || settings.wordpress_username.toLowerCase() === "autoblog-ai";

    console.log(`Testing WP: ${wpUrl}, user: ${settings.wordpress_username || '(plugin)'}, mode: ${isPlugin ? 'plugin' : 'standard'}`);

    let res: Response;
    let testEndpoint: string;
    
    if (isPlugin) {
      testEndpoint = `${wpUrl}/wp-json/autoblog-ai/v1/status`;
      res = await fetch(testEndpoint, {
        headers: { "X-AutoBlog-Key": wpPassword },
      });
    } else {
      testEndpoint = `${wpUrl}/wp-json/wp/v2/users/me`;
      const auth = btoa(`${settings.wordpress_username}:${wpPassword}`);
      console.log(`Auth header (base64 length): ${auth.length}`);
      res = await fetch(testEndpoint, {
        headers: { Authorization: `Basic ${auth}` },
      });
    }

    const responseText = await res.text();
    console.log(`WP response ${res.status}: ${responseText.substring(0, 500)}`);

    if (res.ok) {
      try {
        const data = JSON.parse(responseText);
        const info: Record<string, string> = {};
        if (data.name) info.name = data.name;
        if (data.roles) info.roles = data.roles.join(", ");
        if (data.capabilities) {
          info.can_publish = data.capabilities.publish_posts ? "sim" : "não";
          info.can_edit = data.capabilities.edit_posts ? "sim" : "não";
        }
        return new Response(
          JSON.stringify({ success: true, message: "Conexão OK!", data: info }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } catch {
        return new Response(
          JSON.stringify({ success: true, message: "Conexão OK!" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    } else {
      let errorDetail = `WordPress retornou ${res.status}`;
      try {
        const errJson = JSON.parse(responseText);
        if (errJson.code === "invalid_username") {
          errorDetail = `Usuário "${settings.wordpress_username}" não encontrado no WordPress.`;
        } else if (errJson.code === "incorrect_password") {
          errorDetail = "Senha de aplicativo incorreta. Gere uma nova em WordPress → Usuários → Perfil → Senhas de Aplicativo.";
        } else if (errJson.code === "rest_not_logged_in") {
          errorDetail = "Autenticação falhou. Verifique se a Senha de Aplicativo está correta (não é a senha de login).";
        } else if (errJson.message) {
          errorDetail = `WordPress: ${errJson.message}`;
        }
      } catch {}
      
      return new Response(
        JSON.stringify({ success: false, error: errorDetail }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  } catch (error) {
    console.error("test-wp-connection error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Erro desconhecido" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
