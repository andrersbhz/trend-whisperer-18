import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

function redirect(url: string) {
  return new Response(null, { status: 302, headers: { Location: url } });
}

serve(async (req) => {
  const requestUrl = new URL(req.url);
  const code = requestUrl.searchParams.get("code");
  const state = requestUrl.searchParams.get("state");
  const oauthError = requestUrl.searchParams.get("error_message") || requestUrl.searchParams.get("error");

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  let returnUrl = "https://trend-whisperer-18.lovable.app/social";

  try {
    if (!state) throw new Error("OAuth state ausente");
    const { data: stateRow } = await admin
      .from("threads_oauth_states")
      .select("user_id,return_url,expires_at")
      .eq("state", state)
      .maybeSingle();
    if (!stateRow) throw new Error("OAuth state inválido ou expirado");
    returnUrl = stateRow.return_url || returnUrl;
    await admin.from("threads_oauth_states").delete().eq("state", state);

    if (new Date(stateRow.expires_at).getTime() < Date.now()) throw new Error("OAuth state expirado");
    if (oauthError) throw new Error(oauthError);
    if (!code) throw new Error("Código OAuth ausente");

    const appId = Deno.env.get("THREADS_APP_ID");
    const appSecret = Deno.env.get("THREADS_APP_SECRET");
    if (!appId || !appSecret) throw new Error("THREADS_APP_ID/THREADS_APP_SECRET não configurados");

    const redirectUri = `${Deno.env.get("SUPABASE_URL")}/functions/v1/threads-oauth-callback`;
    const tokenBody = new URLSearchParams({
      client_id: appId,
      client_secret: appSecret,
      grant_type: "authorization_code",
      redirect_uri: redirectUri,
      code,
    });
    const tokenResp = await fetch("https://graph.threads.net/oauth/access_token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: tokenBody,
    });
    if (!tokenResp.ok) throw new Error("Falha ao autorizar a conta Threads");
    const tokenData = await tokenResp.json();
    const accessToken = tokenData.access_token as string;
    if (!accessToken) throw new Error("Threads não retornou access_token");

    const profileResp = await fetch(
      `https://graph.threads.net/v1.0/me?fields=id,username&access_token=${encodeURIComponent(accessToken)}`
    );
    if (!profileResp.ok) throw new Error("Não foi possível ler o perfil Threads");
    const profile = await profileResp.json();

    const expiresAt = tokenData.expires_in
      ? new Date(Date.now() + Number(tokenData.expires_in) * 1000).toISOString()
      : null;

    const { error } = await admin.from("threads_accounts").upsert(
      {
        user_id: stateRow.user_id,
        threads_user_id: String(profile.id),
        username: profile.username || null,
        access_token: accessToken,
        token_expires_at: expiresAt,
        scopes: ["threads_basic", "threads_content_publish", "threads_manage_insights"],
        is_active: true,
        disconnected_at: null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,threads_user_id" }
    );
    if (error) throw error;

    const target = new URL(returnUrl);
    target.searchParams.set("threads", "connected");
    return redirect(target.toString());
  } catch (e) {
    const target = new URL(returnUrl);
    target.searchParams.set("threads", "error");
    target.searchParams.set("message", e instanceof Error ? e.message.substring(0, 180) : "Erro desconhecido");
    return redirect(target.toString());
  }
});
