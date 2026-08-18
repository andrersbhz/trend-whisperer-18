import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { AuthorizationError, authorizeUserRequest } from "../_shared/authorize-user.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" };

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: jsonHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const { userId } = await authorizeUserRequest(req, body?.userId || null);

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) throw new Error("Configuração interna do Supabase ausente");
    const admin = createClient(supabaseUrl, serviceRoleKey);

    const { data: settings, error } = await admin
      .from("user_settings")
      .select("google_search_console_token")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw error;

    const raw = settings?.google_search_console_token;
    if (!raw) {
      return new Response(JSON.stringify({ connected: false, reason: "Conta Google não conectada" }), { headers: jsonHeaders });
    }

    let tokenData: Record<string, unknown> = {};
    try {
      tokenData = typeof raw === "string" ? JSON.parse(raw) : raw;
    } catch {
      return new Response(JSON.stringify({ connected: false, reason: "Token armazenado inválido" }), { headers: jsonHeaders });
    }

    const hasRefreshToken = typeof tokenData.refresh_token === "string" && tokenData.refresh_token.length > 0;
    const accessToken = typeof tokenData.access_token === "string" ? tokenData.access_token : "";
    const expiresAt = typeof tokenData.expires_at === "number" ? tokenData.expires_at : 0;
    const accessValid = accessToken.length > 0 && (!expiresAt || expiresAt > Date.now());

    return new Response(JSON.stringify({
      connected: hasRefreshToken || accessValid,
      needsRefresh: Boolean(hasRefreshToken && !accessValid),
      source: "native-google-oauth",
    }), { headers: jsonHeaders });
  } catch (error) {
    const status = error instanceof AuthorizationError ? error.status : 500;
    const message = error instanceof AuthorizationError ? error.message : "Falha ao verificar conexão Google";
    if (!(error instanceof AuthorizationError)) console.error("google-search-console-status error:", error);
    return new Response(JSON.stringify({ connected: false, error: message }), { status, headers: jsonHeaders });
  }
});
