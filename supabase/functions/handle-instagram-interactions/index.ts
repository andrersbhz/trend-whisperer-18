import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { AuthorizationError, authorizeUserRequest } from "../_shared/authorize-user.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" };
const META_GRAPH_VERSION = Deno.env.get("META_GRAPH_VERSION") || "v21.0";
const GRAPH = `https://graph.facebook.com/${META_GRAPH_VERSION}`;

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

    const { data: accounts, error: accountsError } = await supabase.from("facebook_accounts")
      .select("id,page_id,page_name,access_token,instagram_account_id,instagram_enabled,is_active")
      .eq("user_id", userId)
      .eq("is_active", true)
      .eq("instagram_enabled", true)
      .not("instagram_account_id", "is", null);
    if (accountsError) throw accountsError;

    let newInteractions = 0;
    let postsScanned = 0;
    for (const account of accounts || []) {
      const token = await decryptToken(supabase, account.access_token);
      const igId = account.instagram_account_id;
      if (!token || !igId) continue;

      const mediaResp = await fetch(`${GRAPH}/${encodeURIComponent(igId)}/media?fields=id,caption,permalink,timestamp&limit=12&access_token=${encodeURIComponent(token)}`);
      if (!mediaResp.ok) {
        const raw = await mediaResp.json().catch(() => ({}));
        await supabase.from("automation_logs").insert({
          user_id: userId,
          level: "warn",
          module: "instagram-robot",
          message: `Instagram ${account.page_name}: não foi possível ler as publicações.`,
          details: { status: mediaResp.status, code: raw?.error?.code || null, type: raw?.error?.type || null },
        });
        continue;
      }

      const mediaList = (await mediaResp.json()).data || [];
      postsScanned += mediaList.length;
      for (const media of mediaList) {
        const commentsResp = await fetch(`${GRAPH}/${encodeURIComponent(media.id)}/comments?fields=id,text,username,timestamp,from{id,username}&limit=25&access_token=${encodeURIComponent(token)}`);
        if (!commentsResp.ok) continue;
        const comments = (await commentsResp.json()).data || [];

        for (const comment of comments) {
          const externalId = String(comment.id);
          const { data: existing } = await supabase
            .from("social_interactions")
            .select("id")
            .eq("user_id", userId)
            .eq("platform", "instagram")
            .eq("external_id", externalId)
            .maybeSingle();
          if (existing) continue;

          const { error } = await supabase.from("social_interactions").insert({
            user_id: userId,
            platform: "instagram",
            external_id: externalId,
            page_id: igId,
            author_name: comment.from?.username || comment.username || "Seguidor",
            content: comment.text || "",
            original_link: media.permalink || null,
            status: "pending",
            interaction_type: "comment",
            metadata: { post_id: media.id, post_text: media.caption || "", post_permalink: media.permalink || null },
          });
          if (!error) newInteractions++;
        }
      }
    }

    return new Response(JSON.stringify({ success: true, newInteractions, postsScanned }), { headers: jsonHeaders });
  } catch (error) {
    const status = error instanceof AuthorizationError ? error.status : 500;
    const message = error instanceof AuthorizationError ? error.message : "Falha ao sincronizar Instagram";
    if (!(error instanceof AuthorizationError)) console.error("[handle-instagram-interactions]", error);
    return new Response(JSON.stringify({ success: false, error: message }), { status, headers: jsonHeaders });
  }
});
