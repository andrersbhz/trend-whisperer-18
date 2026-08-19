import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
};
const DEFAULT_RETURN_URL = "https://forex.a3solucoesdigitais.com/settings";
const ALLOWED_RETURN_HOSTS = new Set([
  "forex.a3solucoesdigitais.com",
  "trend-whisperer-18.lovable.app",
  "id-preview--9ad27b4d-8990-47e9-8d43-311f0f7d2680.lovable.app",
]);

function safeReturnUrl(rawValue: unknown) {
  if (typeof rawValue !== "string" || !rawValue) return DEFAULT_RETURN_URL;
  try {
    const url = new URL(rawValue);
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) return DEFAULT_RETURN_URL;
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
    return safeReturnUrl(decodeURIComponent(parts.slice(1).join("::")));
  } catch {
    return DEFAULT_RETURN_URL;
  }
}

function htmlResponse(title: string, message: string, success: boolean, redirectUrl = DEFAULT_RETURN_URL) {
  const safeRedirect = safeReturnUrl(redirectUrl);
  const origin = new URL(safeRedirect).origin;
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
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">${success ? "✅" : "❌"}</div>
    <h1>${title}</h1>
    <p>${message}</p>
    <button id="done">${success ? "Voltar ao app" : "Tentar novamente"}</button>
  </div>
  <script>
    const redirectUrl = ${JSON.stringify(safeRedirect)};
    const targetOrigin = ${JSON.stringify(origin)};
    const done = () => {
      if (window.opener) {
        window.opener.postMessage({ type: 'google-oauth-done', success: ${success} }, targetOrigin);
        window.close();
      } else {
        window.location.assign(redirectUrl);
      }
    };
    document.getElementById('done').addEventListener('click', done);
    if (window.opener) {
      window.opener.postMessage({ type: 'google-oauth-done', success: ${success} }, targetOrigin);
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
      "Cache-Control": "no-store",
      "Referrer-Policy": "no-referrer",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'",
    },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    const oauthError = url.searchParams.get("error");
    const returnUrl = getReturnUrlFromState(state);

    if (oauthError) return htmlResponse("Conexão cancelada", "A autorização do Google foi cancelada.", false, returnUrl);
    if (!code || !state) return htmlResponse("Erro", "Parâmetros de autorização ausentes.", false, returnUrl);

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) return htmlResponse("Erro de configuração", "Configuração interna indisponível.", false, returnUrl);
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { data: stateRow } = await supabase
      .from("google_search_console_oauth_states")
      .select("user_id, expires_at")
      .eq("state", state)
      .maybeSingle();

    if (!stateRow || new Date(stateRow.expires_at) < new Date()) {
      if (stateRow) await supabase.from("google_search_console_oauth_states").delete().eq("state", state);
      return htmlResponse("Sessão expirada", "Estado OAuth inválido ou expirado.", false, returnUrl);
    }

    const userId = stateRow.user_id;
    await supabase.from("google_search_console_oauth_states").delete().eq("state", state);

    const { data: savedCreds } = await supabase.rpc("get_google_oauth_credentials_for_backend", { p_user_id: userId });
    const clientId = savedCreds?.client_id || Deno.env.get("GOOGLE_CLIENT_ID") || "";
    const clientSecret = savedCreds?.client_secret || Deno.env.get("GOOGLE_CLIENT_SECRET") || "";
    if (!clientId || !clientSecret) {
      return htmlResponse("Erro de configuração", "Client ID ou Client Secret do Google não configurados no sistema.", false, returnUrl);
    }

    const redirectUri = `${supabaseUrl}/functions/v1/google-search-console-callback`;
    const tokenResp = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ code, client_id: clientId, client_secret: clientSecret, redirect_uri: redirectUri, grant_type: "authorization_code" }),
    });

    if (!tokenResp.ok) {
      console.error("google-search-console-callback token exchange failed:", tokenResp.status);
      return htmlResponse("Erro ao conectar", "O Google recusou a troca de credenciais. Tente conectar novamente.", false, returnUrl);
    }

    const tokenData = await tokenResp.json();
    tokenData.expires_at = Date.now() + (tokenData.expires_in ?? 3600) * 1000;

    const { error: updateError } = await supabase
      .from("user_settings")
      .update({ google_search_console_token: JSON.stringify(tokenData) })
      .eq("user_id", userId);
    if (updateError) throw updateError;

    return htmlResponse("Conectado com sucesso!", "Sua conta Google foi conectada ao Search Console.", true, returnUrl);
  } catch (error) {
    console.error("google-search-console-callback error:", error instanceof Error ? error.message : "erro desconhecido");
    return htmlResponse("Erro inesperado", "Não foi possível concluir a conexão. Tente novamente.", false);
  }
});
