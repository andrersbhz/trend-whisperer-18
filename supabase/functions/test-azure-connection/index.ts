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

    const baseEndpoint = endpoint.replace(/\/$/, "");
    const testUrl = `${baseEndpoint}/openai/deployments/${encodeURIComponent(deployment)}/chat/completions?api-version=2024-02-01`;
    const testResp = await fetch(testUrl, {
      method: "POST",
      headers: { "api-key": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({ messages: [{ role: "user", content: "Say 'OK'" }], max_tokens: 5 }),
    });

    if (!testResp.ok) {
      const errText = await testResp.text();
      return new Response(
        JSON.stringify({ success: false, error: `Azure erro ${testResp.status}: ${errText.substring(0, 180)}` }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let models = [{ id: deployment, name: deployment }];
    let recommended = deployment;

    // Azure exposes deployments through the resource deployment endpoint when the key/resource supports it.
    // If listing is not permitted, keep the already validated configured deployment as the available option.
    try {
      const deploymentsResp = await fetch(`${baseEndpoint}/openai/deployments?api-version=2023-03-15-preview`, {
        headers: { "api-key": apiKey },
      });
      if (deploymentsResp.ok) {
        const deploymentsData = await deploymentsResp.json();
        const items = deploymentsData.data || deploymentsData.value || [];
        const mapped = items
          .map((item: any) => ({
            id: item.id || item.name,
            name: item.id || item.name,
            created: item.created_at || item.createdAt || item.created || 0,
          }))
          .filter((item: any) => !!item.id)
          .sort((a: any, b: any) => {
            const aTime = typeof a.created === "number" ? a.created : Date.parse(a.created || "") || 0;
            const bTime = typeof b.created === "number" ? b.created : Date.parse(b.created || "") || 0;
            return bTime - aTime || a.id.localeCompare(b.id);
          });
        if (mapped.length > 0) {
          models = mapped.map(({ id, name }: any) => ({ id, name }));
          recommended = mapped[0].id;
        }
      }
    } catch (listError) {
      console.warn("Azure deployment listing unavailable; using configured deployment.", listError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Conexão Azure Copilot OK!",
        data: { models, recommended },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Erro desconhecido" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
