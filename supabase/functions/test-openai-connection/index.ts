import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Not authenticated");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!);
    const { data: { user }, error: authError } = await anonClient.auth.getUser(authHeader.replace("Bearer ", ""));
    if (authError || !user) throw new Error("Invalid token");

    let bodyParams: any = {};
    try { bodyParams = await req.json(); } catch {}

    // Use key from body (live form) or decrypt from DB
    let apiKey: string | null = bodyParams.openai_api_key || null;

    if (!apiKey) {
      const { data: settings } = await supabase
        .from("user_settings")
        .select("openai_api_key")
        .eq("user_id", user.id)
        .single();

      if (settings?.openai_api_key) {
        const { data: decrypted } = await supabase.rpc("decrypt_credential", {
          enc_key: "",
          val: settings.openai_api_key,
        });
        if (decrypted && typeof decrypted === "string" && decrypted.length > 5) {
          apiKey = decrypted;
        }
      }
    }

    if (!apiKey) {
      return new Response(
        JSON.stringify({ success: false, error: "Chave da OpenAI não configurada. Insira sua chave e tente novamente." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate key format
    if (!apiKey.startsWith("sk-")) {
      return new Response(
        JSON.stringify({ success: false, error: "Formato de chave inválido. A chave da OpenAI deve começar com 'sk-'." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Test with a minimal models list call (cheapest endpoint)
    const resp = await fetch("https://api.openai.com/v1/models", {
      headers: { Authorization: `Bearer ${apiKey}` },
    });

    if (resp.ok) {
      const data = await resp.json();
      const modelCount = data.data?.length || 0;
      const hasGpt4o = data.data?.some((m: any) => m.id.includes("gpt-4o"));
      return new Response(
        JSON.stringify({
          success: true,
          message: "Conexão OK!",
          data: {
            models_available: `${modelCount} modelos`,
            gpt4o_access: hasGpt4o ? "sim" : "não",
          },
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } else {
      const errText = await resp.text();
      let errorDetail = `OpenAI retornou ${resp.status}`;
      
      // Cloudflare 522 checking
      if (resp.status === 522) {
        errorDetail = "Erro 522 (Connection Timed Out): A OpenAI está inacessível no momento ou a conexão expirou. Tente novamente em instantes.";
      } else {
        try {
          const errJson = JSON.parse(errText);
          if (resp.status === 401) {
            errorDetail = "Chave inválida ou expirada. Verifique sua chave em platform.openai.com/api-keys.";
          } else if (resp.status === 429) {
            errorDetail = "Limite de requisições atingido ou sem saldo. Verifique seu billing em platform.openai.com.";
          } else if (errJson.error?.message) {
            errorDetail = errJson.error.message;
          }
        } catch {}
      }

      return new Response(
        JSON.stringify({ success: false, error: errorDetail }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  } catch (error) {
    console.error("test-openai-connection error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Erro desconhecido" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
