import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { AuthorizationError, authorizeUserRequest } from "../_shared/authorize-user.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const jsonHeaders = {
  ...corsHeaders,
  "Content-Type": "application/json",
  "Cache-Control": "no-store",
};

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

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { data: settings, error: settingsError } = await supabase
      .from("user_settings")
      .select("follower_growth_mode")
      .eq("user_id", userId)
      .maybeSingle();

    if (settingsError) throw settingsError;

    if (!settings?.follower_growth_mode) {
      return new Response(JSON.stringify({ success: true, message: "Modo crescimento desativado", followed: 0, unfollowed: 0, opportunities: 0 }), {
        headers: jsonHeaders,
      });
    }

    // A API oficial do Instagram não oferece endpoints para seguir/desseguir usuários.
    // Em vez de simular uma ação inexistente, mantemos uma fila de oportunidades baseada em interações reais.
    const { data: interactions, error: interactionsError } = await supabase
      .from("social_interactions")
      .select("id,platform,external_id,author_name,author_avatar,interaction_type,created_at")
      .eq("user_id", userId)
      .in("platform", ["instagram", "facebook", "threads"])
      .order("created_at", { ascending: false })
      .limit(50);

    if (interactionsError) throw interactionsError;

    const unique = new Map<string, any>();
    for (const item of interactions || []) {
      const key = `${item.platform}:${item.author_name || item.external_id}`;
      if (!unique.has(key)) unique.set(key, item);
    }

    const opportunities = Array.from(unique.values()).slice(0, 20);

    await supabase.from("automation_logs").insert({
      user_id: userId,
      level: "info",
      module: "growth",
      message: `${opportunities.length} oportunidades de relacionamento identificadas. Follow automático não é executado porque a API oficial não disponibiliza essa ação.`,
      details: {
        action: "growth-opportunities",
        supported_follow_api: false,
        opportunities: opportunities.map((x) => ({ platform: x.platform, author: x.author_name, interaction_type: x.interaction_type })),
      },
    });

    return new Response(JSON.stringify({
      success: true,
      followed: 0,
      unfollowed: 0,
      opportunities: opportunities.length,
      supportedFollowApi: false,
      message: "Oportunidades identificadas sem simular follows inexistentes.",
    }), { headers: jsonHeaders });
  } catch (error) {
    const status = error instanceof AuthorizationError ? error.status : 500;
    const message = error instanceof AuthorizationError ? error.message : "Falha ao executar ciclo de crescimento";
    if (!(error instanceof AuthorizationError)) console.error("[handle-social-growth]", error);
    return new Response(JSON.stringify({ success: false, error: message }), {
      status,
      headers: jsonHeaders,
    });
  }
});
