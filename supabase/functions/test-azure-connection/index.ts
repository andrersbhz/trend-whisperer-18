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

    let apiKey = bodyParams.azure_openai_api_key || null;
    let endpoint = bodyParams.azure_openai_endpoint || null;
    let deployment = bodyParams.azure_openai_deployment_name || null;

    if (!apiKey || !endpoint || !deployment) {
      const { data: settings } = await supabase
        .from("user_settings")
        .select("azure_openai_api_key, azure_openai_endpoint, azure_openai_deployment_name")
        .eq("user_id", user.id)
        .single();

      if (!apiKey && settings?.azure_openai_api_key) {
        const { data: decrypted } = await supabase.rpc("decrypt_credential", { enc_key: "", val: settings.azure_openai_api_key });
        apiKey = decrypted;
      }
      if (!endpoint) endpoint = settings?.azure_openai_endpoint;
      if (!deployment) deployment = settings?.azure_openai_deployment_name;
    }

    if (!apiKey || !endpoint || !deployment) {
      return new Response(
        JSON.stringify({ success: false, error: "Configurações da Azure incompletas." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Azure doesn't have a standardized "list models" endpoint like OpenAI.
    // However, we can use the deployments list if the user has a Management API setup,
    // but here we usually have a specific deployment name.
    // For now, we'll return the current deployment as the active model and a few common options.
    
    const url = `${endpoint.replace(/\/$/, "")}/openai/deployments/${deployment}/chat/completions?api-version=2024-02-01`;
    
    const resp = await fetch(url, {
      method: "POST",
      headers: { "api-key": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: [{ role: "user", content: "Say 'OK'" }],
        max_tokens: 5
      }),
    });

    if (resp.ok) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "Conexão Azure Copilot OK!",
          data: {
            models: [
              { id: deployment, name: `Deployment Atual: ${deployment}` },
              { id: "gpt-4o", name: "GPT-4o (Azure)" },
              { id: "gpt-4-turbo", name: "GPT-4 Turbo (Azure)" },
              { id: "gpt-35-turbo", name: "GPT-3.5 Turbo (Azure)" }
            ],
            recommended: deployment
          }
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } else {
      const errText = await resp.text();
      return new Response(
        JSON.stringify({ success: false, error: `Azure erro ${resp.status}: ${errText.substring(0, 100)}` }),
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