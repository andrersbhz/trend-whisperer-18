import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { requireServiceOrAdmin } from "../_shared/security.ts";

const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    await requireServiceOrAdmin(req);
    const { userId, plan } = await req.json();
    const limits: Record<string, number> = { basico: 1, avancado: 10, enterprise: 50 };
    if (!userId || !limits[plan]) return new Response(JSON.stringify({ error: "Plano inválido" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { error } = await admin.from("profiles").update({ subscription_plan: plan, blog_limit: limits[plan] }).eq("id", userId);
    if (error) throw error;
    return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    const status = error instanceof Error && /negado|autentic|sessão/i.test(error.message) ? 403 : 500;
    return new Response(JSON.stringify({ error: status === 500 ? "Erro interno" : (error as Error).message }), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
