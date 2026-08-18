import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const GRAPH_VERSION = Deno.env.get("META_GRAPH_VERSION") || "v21.0";

const BASIC_SCOPES = [
  "email",
  "public_profile",
  "pages_show_list",
  "pages_read_engagement",
];

const PUBLISHING_SCOPES = [
  "pages_manage_posts",
  "pages_manage_metadata",
  "pages_read_user_content",
  "instagram_basic",
  "instagram_content_publish",
  "read_insights",
  "business_management",
];

const DEFAULT_RETURN_URL = "https://forex.a3solucoesdigitais.com/settings";
const ALLOWED_RETURN_HOSTS = new Set([
  "forex.a3solucoesdigitais.com",
  "trend-whisperer-18.lovable.app",
  "id-preview--9ad27b4d-8990-47e9-8d43-311f0f7d2680.lovable.app",
]);

function getSafeReturnUrl(rawValue: unknown) {
  if (typeof rawValue !== "string" || !rawValue) return DEFAULT_RETURN_URL;
  try {
    const url = new URL(rawValue);
    if (!["http:", "https:"].includes(url.protocol)) return DEFAULT_RETURN_URL;
    if (!ALLOWED_RETURN_HOSTS.has(url.hostname)) return DEFAULT_RETURN_URL;
    return url.toString();
  } catch {
    return DEFAULT_RETURN_URL;
  }
}

function getRequestedScopes(rawMode: unknown) {
  const mode = rawMode === "basic" ? "basic" : "publishing";
  return mode === "basic"
    ? BASIC_SCOPES
    : [...BASIC_SCOPES, ...PUBLISHING_SCOPES];
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json", "Allow": "POST" },
    });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const appId = Deno.env.get("FACEBOOK_APP_ID");
    if (!supabaseUrl || !anonKey || !serviceRoleKey || !appId) {
      throw new Error("OAuth environment is not fully configured");
    }

    const supabase = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userErr } = await supabase.auth.getUser(token);
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const requestBody = await req.json().catch(() => ({}));
    const returnUrl = getSafeReturnUrl(requestBody?.returnUrl);
    const scopes = getRequestedScopes(requestBody?.mode);

    const stateNonce = crypto.randomUUID() + crypto.randomUUID().replace(/-/g, "");
    const state = `${stateNonce}::${encodeURIComponent(returnUrl)}`;

    const adminSupabase = createClient(supabaseUrl, serviceRoleKey);
    const { error: insertErr } = await adminSupabase
      .from("facebook_oauth_states")
      .insert({ state, user_id: userData.user.id });
    if (insertErr) throw insertErr;

    await adminSupabase
      .from("facebook_oauth_states")
      .delete()
      .lt("expires_at", new Date().toISOString());

    const redirectUri = `${supabaseUrl}/functions/v1/facebook-oauth-callback`;
    const authUrl = new URL(`https://www.facebook.com/${GRAPH_VERSION}/dialog/oauth`);
    authUrl.searchParams.set("client_id", appId);
    authUrl.searchParams.set("redirect_uri", redirectUri);
    authUrl.searchParams.set("state", state);
    authUrl.searchParams.set("scope", scopes.join(","));
    authUrl.searchParams.set("response_type", "code");

    return new Response(JSON.stringify({ authUrl: authUrl.toString(), scopes }), {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      },
    });
  } catch (error: any) {
    console.error("facebook-oauth-start error:", error);
    return new Response(JSON.stringify({ error: "Unable to start Meta authentication" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
