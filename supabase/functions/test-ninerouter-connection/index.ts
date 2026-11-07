import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};
const json = (b: unknown) => new Response(JSON.stringify(b), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ success: false, error: "Não autenticado" });
    const url = Deno.env.get("SUPABASE_URL")!;
    const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const anon = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!);
    const { data: { user } } = await anon.auth.getUser(authHeader.replace("Bearer ", ""));
    if (!user) return json({ success: false, error: "Sessão inválida" });

    let body: any = {};
    try { body = await req.json(); } catch {}
    const { data: s } = await admin.from("user_settings").select("ninerouter_endpoint, ninerouter_api_key").eq("user_id", user.id).maybeSingle();

    let endpoint = String(body.endpoint || s?.ninerouter_endpoint || "").trim().replace(/\/+$/, "");
    if (!/^https:\/\//i.test(endpoint)) return json({ success: false, error: "Informe um endereço que comece com https://" });
    if (!/\/v1$/.test(endpoint)) endpoint += "/v1";

    let key: string | null = body.api_key ? String(body.api_key).trim() : null;
    if (!key && s?.ninerouter_api_key) {
      const { data } = await admin.rpc("decrypt_credential", { enc_key: "", val: s.ninerouter_api_key });
      if (typeof data === "string" && data.length > 5) key = data;
    }

    const resp = await fetch(`${endpoint}/models`, { headers: key ? { Authorization: `Bearer ${key}` } : {} });
    if (resp.status === 401 || resp.status === 403) return json({ success: false, error: "Chave de API recusada pelo 9Router." });
    if (!resp.ok) return json({ success: false, error: `O 9Router respondeu com erro ${resp.status}.` });
    const data = await resp.json().catch(() => ({}));
    const models = (data?.data || []).map((m: any) => ({ id: m.id, owned_by: m.owned_by }));
    return json({ success: true, message: `Conectado! ${models.length} modelos disponíveis.`, models });
  } catch (e) {
    return json({ success: false, error: e instanceof Error ? e.message : "Erro desconhecido" });
  }
});
