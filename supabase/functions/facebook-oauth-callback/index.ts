import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
};

const GRAPH_VERSION = Deno.env.get("META_GRAPH_VERSION") || "v21.0";
const GRAPH_API = `https://graph.facebook.com/${GRAPH_VERSION}`;
const DEFAULT_RETURN_URL = "https://forex.a3solucoesdigitais.com/settings";
const ALLOWED_RETURN_HOSTS = new Set([
  "forex.a3solucoesdigitais.com",
  "trend-whisperer-18.lovable.app",
  "id-preview--9ad27b4d-8990-47e9-8d43-311f0f7d2680.lovable.app",
]);

function getSafeReturnUrl(rawValue: string | null) {
  if (!rawValue) return DEFAULT_RETURN_URL;
  try {
    const url = new URL(rawValue);
    if (!["http:", "https:"].includes(url.protocol)) return DEFAULT_RETURN_URL;
    if (!ALLOWED_RETURN_HOSTS.has(url.hostname)) return DEFAULT_RETURN_URL;
    return url.toString();
  } catch {
    return DEFAULT_RETURN_URL;
  }
}

function getReturnUrlFromState(state: string | null) {
  if (!state) return DEFAULT_RETURN_URL;
  const parts = state.split("::");
  if (parts.length < 2) return DEFAULT_RETURN_URL;
  try {
    return getSafeReturnUrl(decodeURIComponent(parts.slice(1).join("::")));
  } catch {
    return DEFAULT_RETURN_URL;
  }
}

function htmlResponse(title: string, message: string, success: boolean, redirectUrl = DEFAULT_RETURN_URL) {
  const safeRedirectUrl = getSafeReturnUrl(redirectUrl);
  const targetOrigin = new URL(safeRedirectUrl).origin;
  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="referrer" content="no-referrer" />
  <title>${title}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #0b0b14; color: #e5e5e5; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; padding: 1rem; }
    .card { background: #16161f; border: 1px solid #2a2a3a; border-radius: 12px; padding: 2rem; max-width: 420px; text-align: center; box-shadow: 0 10px 40px rgba(0,0,0,0.5); }
    .icon { font-size: 3rem; margin-bottom: 1rem; }
    h1 { margin: 0 0 0.5rem; font-size: 1.25rem; color: ${success ? "#a78bfa" : "#f87171"}; }
    p { margin: 0 0 1.5rem; color: #a3a3b8; font-size: 0.9rem; line-height: 1.5; }
    button { background: linear-gradient(135deg, #a78bfa, #ec4899); color: white; border: none; padding: 0.6rem 1.5rem; border-radius: 8px; font-weight: 600; cursor: pointer; font-size: 0.9rem; }
    button:hover { opacity: 0.9; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">${success ? "✅" : "❌"}</div>
    <h1>${title}</h1>
    <p>${message}</p>
    <button id="oauth-finish">${success ? "Voltar ao app" : "Tentar novamente"}</button>
  </div>
  <script>
    const redirectUrl = ${JSON.stringify(safeRedirectUrl)};
    const targetOrigin = ${JSON.stringify(targetOrigin)};
    const payload = { type: 'fb-oauth-done', success: ${success} };
    const finish = () => {
      if (window.opener) {
        window.opener.postMessage(payload, targetOrigin);
        window.close();
      } else {
        window.location.assign(redirectUrl);
      }
    };
    document.getElementById('oauth-finish')?.addEventListener('click', finish);
    if (window.opener) {
      window.opener.postMessage(payload, targetOrigin);
      setTimeout(() => window.close(), 1500);
    } else {
      setTimeout(() => window.location.assign(redirectUrl), 1800);
    }
  </script>
</body>
</html>`;
  return new Response(html, {
    status: 200,
    headers: {
      ...corsHeaders,
      "Content-Type": "text/html; charset=utf-8",
      "Referrer-Policy": "no-referrer",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
    },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    const error = url.searchParams.get("error");
    const errorDesc = url.searchParams.get("error_description");

    const returnUrl = getReturnUrlFromState(state);

    if (error) {
      return htmlResponse("Conexão cancelada", errorDesc || error, false, returnUrl);
    }
    if (!code || !state) {
      return htmlResponse("Erro", "Parâmetros 'code' ou 'state' ausentes.", false, returnUrl);
    }

    const appId = Deno.env.get("FACEBOOK_APP_ID");
    const appSecret = Deno.env.get("FACEBOOK_APP_SECRET");
    if (!appId || !appSecret) {
      return htmlResponse("Erro de configuração", "FACEBOOK_APP_ID ou FACEBOOK_APP_SECRET não estão configurados.", false, returnUrl);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: stateRow } = await supabase
      .from("facebook_oauth_states")
      .select("user_id, expires_at")
      .eq("state", state)
      .maybeSingle();

    if (!stateRow) {
      return htmlResponse("Sessão expirada", "Estado OAuth inválido. Tente conectar novamente.", false, returnUrl);
    }
    if (new Date(stateRow.expires_at) < new Date()) {
      await supabase.from("facebook_oauth_states").delete().eq("state", state);
      return htmlResponse("Sessão expirada", "O link expirou. Tente conectar novamente.", false, returnUrl);
    }

    const userId = stateRow.user_id;
    await supabase.from("facebook_oauth_states").delete().eq("state", state);

    const redirectUri = `${Deno.env.get("SUPABASE_URL")}/functions/v1/facebook-oauth-callback`;

    const tokenUrl = new URL(`${GRAPH_API}/oauth/access_token`);
    tokenUrl.searchParams.set("client_id", appId);
    tokenUrl.searchParams.set("client_secret", appSecret);
    tokenUrl.searchParams.set("redirect_uri", redirectUri);
    tokenUrl.searchParams.set("code", code);

    const tokenResp = await fetch(tokenUrl.toString());
    if (!tokenResp.ok) {
      const errBody = await tokenResp.text();
      console.error("Token exchange failed:", errBody);
      return htmlResponse("Erro ao trocar código", "Não foi possível concluir a autenticação com a Meta.", false, returnUrl);
    }
    const tokenData = await tokenResp.json();
    const shortToken = tokenData.access_token;

    const longUrl = new URL(`${GRAPH_API}/oauth/access_token`);
    longUrl.searchParams.set("grant_type", "fb_exchange_token");
    longUrl.searchParams.set("client_id", appId);
    longUrl.searchParams.set("client_secret", appSecret);
    longUrl.searchParams.set("fb_exchange_token", shortToken);
    const longResp = await fetch(longUrl.toString());
    const longData = longResp.ok ? await longResp.json() : { access_token: shortToken };
    const userToken = longData.access_token || shortToken;

    const fields = "id,name,access_token,category,picture{url},fan_count,instagram_business_account{id,name,username,profile_picture_url,followers_count}";
    const pagesResp = await fetch(
      `${GRAPH_API}/me/accounts?fields=${fields}&limit=200&access_token=${encodeURIComponent(userToken)}`
    );
    if (!pagesResp.ok) {
      const errBody = await pagesResp.text();
      console.error("Pages fetch failed:", errBody);
      return htmlResponse("Erro ao buscar páginas", "Não foi possível carregar as páginas administradas por esta conta.", false, returnUrl);
    }
    const pagesData = await pagesResp.json();
    const pages = pagesData.data || [];

    if (pages.length === 0) {
      return htmlResponse("Nenhuma página", "Sua conta não administra nenhuma página do Facebook. Verifique no Business Manager.", false, returnUrl);
    }

    let savedCount = 0;
    for (const page of pages) {
      const igId = page.instagram_business_account?.id || null;
      const pageName = page.name || null;
      const pageId = page.id;
      const pageToken = page.access_token;
      const pictureUrl = page.picture?.data?.url || null;

      const { data: existing } = await supabase
        .from("facebook_accounts")
        .select("id")
        .eq("user_id", userId)
        .eq("page_id", pageId)
        .maybeSingle();

      if (existing) {
        const { error: updErr } = await supabase
          .from("facebook_accounts")
          .update({
            page_name: pageName,
            access_token: pageToken,
            instagram_account_id: igId,
            picture_url: pictureUrl,
            is_active: true,
          })
          .eq("id", existing.id);
        if (!updErr) savedCount++;
        else console.error("Update failed for", pageId, updErr);
      } else {
        const { error: insErr } = await supabase.from("facebook_accounts").insert({
          user_id: userId,
          page_id: pageId,
          page_name: pageName,
          access_token: pageToken,
          instagram_account_id: igId,
          picture_url: pictureUrl,
          is_active: true,
        });
        if (!insErr) savedCount++;
        else console.error("Insert failed for", pageId, insErr);
      }
    }

    return htmlResponse(
      "Conectado com sucesso!",
      `${savedCount} de ${pages.length} página(s) do Facebook conectadas.`,
      true,
      returnUrl
    );
  } catch (err: any) {
    console.error("facebook-oauth-callback error:", err);
    return htmlResponse("Erro inesperado", "Não foi possível concluir a conexão. Tente novamente.", false);
  }
});
