import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const META_GRAPH = "https://graph.facebook.com/v21.0";
const THREADS_GRAPH = "https://graph.threads.net/v1.0";

async function decryptField(supabase: any, value: string | null) {
  if (!value || !value.startsWith("ENCRYPTED:")) return value;
  const { data } = await supabase.rpc("decrypt_credential", { val: value, enc_key: "" });
  return data || null;
}

async function probe(url: string) {
  const res = await fetch(url);
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization") || "";
    const bearer = authHeader.replace(/^Bearer\s+/i, "").trim();
    if (!bearer) throw new Error("Unauthorized");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const authed = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: auth } = await authed.auth.getUser(bearer);
    if (!auth.user) throw new Error("Unauthorized");

    const admin = createClient(supabaseUrl, serviceKey);
    const [metaRes, threadsRes] = await Promise.all([
      admin.from("facebook_accounts").select("*").eq("user_id", auth.user.id),
      admin.from("threads_accounts").select("*").eq("user_id", auth.user.id),
    ]);

    const results: any[] = [];
    for (const account of metaRes.data || []) {
      const token = await decryptField(admin, account.access_token);
      if (!token) {
        results.push({ key: `facebook:${account.page_id}`, platform: "facebook", ok: false, error: "Token ausente" });
        continue;
      }
      const fb = await probe(`${META_GRAPH}/${account.page_id}?fields=id,name&access_token=${encodeURIComponent(token)}`);
      results.push({ key: `facebook:${account.page_id}`, platform: "facebook", ok: fb.ok, status: fb.status, name: account.page_name, error: fb.ok ? null : fb.data?.error?.message || "Falha de autenticação" });

      if (account.instagram_account_id) {
        const ig = await probe(`${META_GRAPH}/${account.instagram_account_id}?fields=id,username&access_token=${encodeURIComponent(token)}`);
        results.push({ key: `instagram:${account.instagram_account_id}`, platform: "instagram", ok: ig.ok, status: ig.status, name: ig.data?.username || account.page_name, error: ig.ok ? null : ig.data?.error?.message || "Falha de autenticação" });
      }
    }

    for (const account of threadsRes.data || []) {
      const token = await decryptField(admin, account.access_token);
      if (!token) {
        results.push({ key: `threads:${account.id}`, platform: "threads", ok: false, error: "Token ausente" });
        continue;
      }
      const th = await probe(`${THREADS_GRAPH}/${account.threads_user_id}?fields=id,username&access_token=${encodeURIComponent(token)}`);
      results.push({ key: `threads:${account.id}`, platform: "threads", ok: th.ok, status: th.status, name: th.data?.username || account.username, error: th.ok ? null : th.data?.error?.message || "Falha de autenticação" });
    }

    return new Response(JSON.stringify({ success: true, checkedAt: new Date().toISOString(), results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Erro desconhecido" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
