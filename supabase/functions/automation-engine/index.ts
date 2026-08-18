import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-automation-secret, x-client-info, apikey, content-type",
};

const jsonHeaders = {
  ...corsHeaders,
  "Content-Type": "application/json",
  "Cache-Control": "no-store",
};

function isAuthorizedAutomationCall(req: Request) {
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const automationSecret = Deno.env.get("AUTOMATION_CRON_SECRET");
  const bearer = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "").trim();
  const cronSecret = req.headers.get("X-Automation-Secret")?.trim();

  if (serviceRoleKey && bearer === serviceRoleKey) return true;
  if (automationSecret && cronSecret === automationSecret) return true;
  return false;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: jsonHeaders,
    });
  }

  if (!isAuthorizedAutomationCall(req)) {
    console.warn("[automation-engine] Tentativa não autorizada bloqueada");
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: jsonHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) throw new Error("Configuração interna do Supabase ausente");

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    console.log("[automation-engine] Iniciando varredura de automação...");

    const { data: users, error: usersError } = await supabase
      .from("user_settings")
      .select("user_id")
      .eq("automation_enabled", true);

    if (usersError) throw usersError;

    if (!users || users.length === 0) {
      return new Response(JSON.stringify({ message: "Nenhum usuário com automação ativa." }), {
        headers: jsonHeaders,
      });
    }

    console.log(`[automation-engine] Processando ${users.length} usuários...`);

    for (const user of users) {
      try {
        await supabase.from("automation_logs").insert({
          user_id: user.user_id,
          level: "info",
          module: "automation",
          message: "Iniciando ciclo de automação 24/7",
        });

        const syncResp = await supabase.functions.invoke("handle-social-interactions", {
          body: { userId: user.user_id },
        });

        if (syncResp.error) {
          await supabase.from("automation_logs").insert({
            user_id: user.user_id,
            level: "error",
            module: "sync",
            message: `Falha na sincronização: ${syncResp.error.message || "Erro desconhecido"}`,
            details: { message: syncResp.error.message || "Erro desconhecido" },
          });
        } else {
          await supabase.from("automation_logs").insert({
            user_id: user.user_id,
            level: "info",
            module: "sync",
            message: `Sincronização concluída: ${syncResp.data?.postsScanned || 0} postagens analisadas e ${syncResp.data?.newInteractions || 0} novas interações.`,
            details: syncResp.data,
          });
        }

        const replyResp = await supabase.functions.invoke("process-social-replies", {
          body: { userId: user.user_id },
        });

        if (replyResp.error) {
          await supabase.from("automation_logs").insert({
            user_id: user.user_id,
            level: "error",
            module: "reply",
            message: `Falha ao gerar respostas: ${replyResp.error.message || "Erro desconhecido"}`,
            details: { message: replyResp.error.message || "Erro desconhecido" },
          });
        } else {
          await supabase.from("automation_logs").insert({
            user_id: user.user_id,
            level: "info",
            module: "reply",
            message: `Respostas geradas: ${replyResp.data?.replied || 0} novas interações respondidas.`,
            details: replyResp.data,
          });
        }

        const growthResp = await supabase.functions.invoke("handle-social-growth", {
          body: { userId: user.user_id },
        });

        if (growthResp.error) {
          await supabase.from("automation_logs").insert({
            user_id: user.user_id,
            level: "warn",
            module: "growth",
            message: `Aviso no ciclo de crescimento: ${growthResp.error.message || "Erro desconhecido"}`,
            details: { message: growthResp.error.message || "Erro desconhecido" },
          });
        } else {
          const { followed = 0, unfollowed = 0 } = growthResp.data || {};
          if (followed > 0 || unfollowed > 0) {
            await supabase.from("automation_logs").insert({
              user_id: user.user_id,
              level: "info",
              module: "growth",
              message: `Ciclo de crescimento concluído: ${followed} seguidos, ${unfollowed} deixados de seguir.`,
              details: growthResp.data,
            });
          }
        }
      } catch (userErr) {
        const message = userErr instanceof Error ? userErr.message : "Erro desconhecido";
        console.error("[automation-engine] Erro durante ciclo de um usuário:", message);
        await supabase.from("automation_logs").insert({
          user_id: user.user_id,
          level: "error",
          module: "automation",
          message: `Erro fatal no ciclo: ${message}`,
          details: { message },
        });
      }
    }

    return new Response(JSON.stringify({ success: true, processed: users.length }), {
      headers: jsonHeaders,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro desconhecido";
    console.error("[automation-engine] Erro fatal:", message);
    return new Response(JSON.stringify({ error: "Falha ao executar automação" }), {
      status: 500,
      headers: jsonHeaders,
    });
  }
});
