import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    const isCron = req.headers.get("User-Agent")?.includes("Postman") || authHeader === `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`;

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    console.log("[automation-engine] Iniciando varredura de automação...");

    // 1. Buscar todos os usuários com automação ligada
    const { data: users, error: usersError } = await supabase
      .from("user_settings")
      .select("user_id")
      .eq("automation_enabled", true);

    if (usersError) throw usersError;

    if (!users || users.length === 0) {
      return new Response(JSON.stringify({ message: "Nenhum usuário com automação ativa." }), { 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }

    console.log(`[automation-engine] Processando ${users.length} usuários...`);

    const results = [];

    for (const user of users) {
      try {
        console.log(`[automation-engine] Executando para usuário: ${user.user_id}`);
        
        // Sincronizar interações
        const syncResp = await supabase.functions.invoke("handle-social-interactions", {
          body: { userId: user.user_id }
        });

        // Processar respostas
        const replyResp = await supabase.functions.invoke("process-social-replies", {
          body: { userId: user.user_id }
        });

        results.push({
          userId: user.user_id,
          sync: syncResp.data,
          replies: replyResp.data
        });
      } catch (userErr) {
        console.error(`[automation-engine] Erro no usuário ${user.user_id}:`, userErr);
        results.push({ userId: user.user_id, error: userErr.message });
      }
    }

    return new Response(JSON.stringify({ success: true, processed: users.length, results }), { 
      headers: { ...corsHeaders, "Content-Type": "application/json" } 
    });

  } catch (error: any) {
    console.error("[automation-engine] Erro fatal:", error);
    return new Response(JSON.stringify({ error: error.message }), { 
      status: 500, 
      headers: { ...corsHeaders, "Content-Type": "application/json" } 
    });
  }
});
