import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { getThreadsAppCredentials } from "../_shared/threadsCreds.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GRAPH = "https://graph.threads.net/v1.0";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ success: false, error: "Não autorizado" }, 401);

    const client = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: auth } = await client.auth.getUser(authHeader.replace("Bearer ", ""));
    if (!auth?.user) return json({ success: false, error: "Não autorizado" }, 401);

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { appId, appSecret } = await getThreadsAppCredentials(admin, auth.user.id);

    if (!appId || !appSecret) {
      return json({
        success: false,
        stage: "credentials",
        error: "Informe o ID do app do Threads e a chave secreta do app.",
      });
    }

    const { data: accounts } = await admin
      .from("threads_accounts")
      .select("id, username, threads_user_id, access_token, is_active")
      .eq("user_id", auth.user.id)
      .eq("is_active", true);

    if (!accounts || accounts.length === 0) {
      return json({
        success: true,
        stage: "credentials",
        connected: false,
        message: "Credenciais salvas. Agora clique em Conectar para autorizar sua conta do Threads.",
      });
    }

    const checked: any[] = [];
    for (const account of accounts) {
      let token = account.access_token as string;
      if (token?.startsWith("ENCRYPTED:")) {
        const { data: decrypted } = await admin.rpc("decrypt_credential", { val: token, enc_key: "" });
        token = decrypted || token;
      }
      const resp = await fetch(`${GRAPH}/me?fields=id,username&access_token=${encodeURIComponent(token)}`);
      const body = await resp.text();
      checked.push({
        username: account.username,
        ok: resp.ok,
        detail: resp.ok ? undefined : body.substring(0, 200),
      });
    }

    const allOk = checked.every((item) => item.ok);
    return json({
      success: allOk,
      stage: "accounts",
      connected: true,
      accounts: checked,
      message: allOk
        ? `Conexão ativa: ${checked.map((c) => "@" + (c.username || "conta")).join(", ")}`
        : "Alguma conta do Threads precisa ser reconectada.",
    });
  } catch (error) {
    return json({ success: false, error: error instanceof Error ? error.message : "Erro desconhecido" }, 500);
  }
});
