import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { authorizeUserRequest, AuthorizationError } from "../_shared/authorize-user.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const GRAPH = "https://graph.threads.net/v1.0";

async function decryptToken(supabase: any, token: string) {
  if (!token || !token.startsWith("ENCRYPTED:")) return token;
  const { data } = await supabase.rpc("decrypt_credential", { val: token, enc_key: "" });
  return data || token;
}

async function graphJson(url: string) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  try {
    const response = await fetch(url, { signal: controller.signal });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data?.error?.message || `Threads API ${response.status}`);
    return data;
  } finally {
    clearTimeout(timer);
  }
}

function normalizeMetric(metric: any) {
  const raw = metric?.total_value?.value ?? metric?.values?.[0]?.value ?? metric?.value ?? 0;
  return typeof raw === "number" ? raw : 0;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const auth = await authorizeUserRequest(req, body?.userId || null);
    const userId = auth.userId;
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: accounts, error } = await admin
      .from("threads_accounts")
      .select("id,threads_user_id,username,access_token,token_expires_at,scopes,is_active")
      .eq("user_id", userId)
      .eq("is_active", true);
    if (error) throw error;

    const results: any[] = [];
    for (const account of accounts || []) {
      const token = await decryptToken(admin, account.access_token);
      const hasInsights = Array.isArray(account.scopes) && account.scopes.includes("threads_manage_insights");
      const expired = account.token_expires_at && new Date(account.token_expires_at).getTime() <= Date.now();

      const base = {
        id: account.id,
        threads_user_id: account.threads_user_id,
        username: account.username,
        connected: true,
        has_insights_permission: hasInsights,
        token_expired: Boolean(expired),
      };

      if (!token || expired) {
        results.push({ ...base, metrics: null, needs_reconnect: true, error: "Reconecte a conta Threads para atualizar as métricas." });
        continue;
      }
      if (!hasInsights) {
        results.push({ ...base, metrics: null, needs_reconnect: true, error: "Reconecte a conta uma vez para liberar métricas do Threads." });
        continue;
      }

      try {
        const profile = await graphJson(`${GRAPH}/${account.threads_user_id}?fields=id,username,threads_profile_picture_url,threads_biography&access_token=${encodeURIComponent(token)}`);
        const metricNames = ["views", "likes", "replies", "reposts", "quotes", "followers_count"];
        const metrics: Record<string, number> = {};

        for (const metric of metricNames) {
          try {
            const insight = await graphJson(`${GRAPH}/${account.threads_user_id}/threads_insights?metric=${encodeURIComponent(metric)}&access_token=${encodeURIComponent(token)}`);
            const item = Array.isArray(insight?.data) ? insight.data[0] : null;
            metrics[metric] = normalizeMetric(item);
          } catch {
            metrics[metric] = 0;
          }
        }

        let recent_posts = 0;
        try {
          const posts = await graphJson(`${GRAPH}/${account.threads_user_id}/threads?fields=id,timestamp&limit=25&access_token=${encodeURIComponent(token)}`);
          recent_posts = Array.isArray(posts?.data) ? posts.data.length : 0;
        } catch {
          recent_posts = 0;
        }

        const snapshot = {
          profile: {
            username: profile?.username || account.username || null,
            picture_url: profile?.threads_profile_picture_url || null,
            biography: profile?.threads_biography || null,
          },
          metrics: { ...metrics, recent_posts },
          updated_at: new Date().toISOString(),
        };

        await admin
          .from("threads_accounts")
          .update({ last_metrics: snapshot, metrics_updated_at: snapshot.updated_at })
          .eq("id", account.id)
          .eq("user_id", userId);

        results.push({ ...base, ...snapshot, needs_reconnect: false });
      } catch (e) {
        results.push({ ...base, metrics: null, needs_reconnect: false, error: e instanceof Error ? e.message : "Falha ao consultar métricas" });
      }
    }

    return new Response(JSON.stringify({ success: true, accounts: results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const status = e instanceof AuthorizationError ? e.status : 500;
    return new Response(JSON.stringify({ success: false, error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
