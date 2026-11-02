import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { getThreadsAppCredentials } from "../_shared/threadsCreds.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const GRAPH = "https://graph.threads.net";
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);
    const userClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: auth } = await userClient.auth.getUser(authHeader.replace("Bearer ", ""));
    if (!auth?.user) return json({ error: "Unauthorized" }, 401);

    const body = await req.json().catch(() => ({}));
    const raw = typeof body?.accessToken === "string" ? body.accessToken.trim() : "";
    if (raw.length < 20 || raw.length > 2000 || /\s/.test(raw)) {
      return json({ error: "Token inválido. Cole o token completo gerado no painel do Threads." }, 400);
    }

    let accessToken = raw;
    let expiresIn = 3600;
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Validate token first
    const meResp = await fetch(`${GRAPH}/v1.0/me?fields=id,username&access_token=${encodeURIComponent(raw)}`);
    const me = await meResp.json().catch(() => ({}));
    if (!meResp.ok || !me?.id) {
      return json({ error: `O Threads recusou o token: ${me?.error?.message || "token inválido ou expirado"}` }, 400);
    }

    // Try to exchange for a 60-day token using the saved app secret
    const { appSecret } = await getThreadsAppCredentials(admin, auth.user.id);
    if (appSecret) {
      const u = new URL(`${GRAPH}/access_token`);
      u.searchParams.set("grant_type", "th_exchange_token");
      u.searchParams.set("client_secret", appSecret);
      u.searchParams.set("access_token", raw);
      const r = await fetch(u.toString());
      const d = await r.json().catch(() => ({}));
      if (r.ok && d?.access_token) {
        accessToken = d.access_token;
        expiresIn = Number(d.expires_in || 5184000);
      } else {
        // Already long-lived or exchange unavailable: keep the original token (assume 60 days)
        expiresIn = 5184000;
      }
    }

    const row = {
      user_id: auth.user.id,
      threads_user_id: String(me.id),
      username: me.username || null,
      access_token: accessToken,
      token_expires_at: new Date(Date.now() + expiresIn * 1000).toISOString(),
      is_active: true,
      updated_at: new Date().toISOString(),
    };
    const { data: existing } = await admin
      .from("threads_accounts")
      .select("id")
      .eq("user_id", auth.user.id)
      .eq("threads_user_id", String(me.id))
      .maybeSingle();
    const { error } = existing
      ? await admin.from("threads_accounts").update(row).eq("id", existing.id)
      : await admin.from("threads_accounts").insert(row);
    if (error) throw error;

    return json({ success: true, username: me.username, long_lived: expiresIn > 86400 });
  } catch (e) {
    console.error("[threads-token-connect]", e);
    return json({ error: "Não foi possível conectar a conta do Threads." }, 500);
  }
});
