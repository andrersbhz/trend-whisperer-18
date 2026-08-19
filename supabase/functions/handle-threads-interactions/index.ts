import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { AuthorizationError, authorizeUserRequest } from "../_shared/authorize-user.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" };
const GRAPH = "https://graph.threads.net/v1.0";

async function decryptToken(supabase: any, token: string) {
  if (!token || !token.startsWith("ENCRYPTED:")) return token;
  const { data } = await supabase.rpc("decrypt_credential", { val: token, enc_key: "" });
  return data || token;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: jsonHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const { userId } = await authorizeUserRequest(req, body?.userId || null);

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) throw new Error("Configuração interna do Supabase ausente");
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { data: accounts, error: accountsError } = await supabase
      .from("threads_accounts")
      .select("id,threads_user_id,username,access_token,is_active")
      .eq("user_id", userId)
      .eq("is_active", true);
    if (accountsError) throw accountsError;

    let newInteractions = 0;
    let postsScanned = 0;
    for (const account of accounts || []) {
      const token = await decryptToken(supabase, account.access_token);
      if (!token) continue;

      const postsResp = await fetch(`${GRAPH}/${encodeURIComponent(account.threads_user_id)}/threads?fields=id,text,permalink,timestamp&limit=12&access_token=${encodeURIComponent(token)}`);
      if (!postsResp.ok) {
        const raw = await postsResp.json().catch(() => ({}));
        await supabase.from("automation_logs").insert({
          user_id: userId,
          level: "warn",
          module: "threads-robot",
          message: `Threads @${account.username || account.threads_user_id}: não foi possível ler as publicações.`,
          details: { status: postsResp.status, code: raw?.error?.code || null, type: raw?.error?.type || null },
        });
        continue;
      }

      const posts = (await postsResp.json()).data || [];
      postsScanned += posts.length;
      for (const post of posts) {
        const repliesResp = await fetch(`${GRAPH}/${encodeURIComponent(post.id)}/replies?fields=id,text,timestamp,username,permalink&reverse=false&limit=25&access_token=${encodeURIComponent(token)}`);
        if (!repliesResp.ok) continue;
        const replies = (await repliesResp.json()).data || [];

        for (const reply of replies) {
          const externalId = String(reply.id);
          const { data: existing } = await supabase
            .from("social_interactions")
            .select("id")
            .eq("user_id", userId)
            .eq("platform", "threads")
            .eq("external_id", externalId)
            .maybeSingle();
          if (existing) continue;

          const { error } = await supabase.from("social_interactions").insert({
            user_id: userId,
            platform: "threads",
            external_id: externalId,
            page_id: account.id,
            author_name: reply.username ? `@${reply.username}` : "Seguidor",
            content: reply.text || "",
            original_link: reply.permalink || post.permalink || null,
            status: "pending",
            interaction_type: "comment",
            metadata: { post_id: post.id, post_text: post.text || "", post_permalink: post.permalink || null },
          });
          if (!error) newInteractions++;
        }
      }
    }

    return new Response(JSON.stringify({ success: true, newInteractions, postsScanned }), { headers: jsonHeaders });
  } catch (error) {
    const status = error instanceof AuthorizationError ? error.status : 500;
    const message = error instanceof AuthorizationError ? error.message : "Falha ao sincronizar Threads";
    if (!(error instanceof AuthorizationError)) console.error("[handle-threads-interactions]", error);
    return new Response(JSON.stringify({ success: false, error: message }), { status, headers: jsonHeaders });
  }
});
