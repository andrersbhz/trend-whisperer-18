import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
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

async function invokeFunction(name: string, userId: string) {
  const base = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!base || !serviceKey) throw new Error("Configuração interna do Supabase ausente");

  const response = await fetch(`${base}/functions/v1/${name}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${serviceKey}`,
      "apikey": serviceKey,
    },
    body: JSON.stringify({ userId }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.error || `${name} falhou`);
  return data;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: jsonHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const { userId } = await authorizeUserRequest(req, body?.userId || null);

    const [instagram, threads] = await Promise.allSettled([
      invokeFunction("handle-instagram-interactions", userId),
      invokeFunction("handle-threads-interactions", userId),
    ]);

    const processed = await invokeFunction("process-human-social-replies", userId);

    const instagramData = instagram.status === "fulfilled" ? instagram.value : { success: false, error: "Falha ao sincronizar Instagram" };
    const threadsData = threads.status === "fulfilled" ? threads.value : { success: false, error: "Falha ao sincronizar Threads" };

    return new Response(JSON.stringify({
      success: true,
      newInteractions: (instagramData?.newInteractions || 0) + (threadsData?.newInteractions || 0),
      postsScanned: (instagramData?.postsScanned || 0) + (threadsData?.postsScanned || 0),
      replied: processed?.replied || 0,
      liked: processed?.liked || 0,
      failed: processed?.failed || 0,
      engine: "rule-based-no-lovable",
      networks: { instagram: instagramData, threads: threadsData },
    }), { headers: jsonHeaders });
  } catch (error) {
    const status = error instanceof AuthorizationError ? error.status : 500;
    const message = error instanceof AuthorizationError ? error.message : "Falha ao processar respostas sociais";
    if (!(error instanceof AuthorizationError)) console.error("[process-social-replies]", error);
    return new Response(JSON.stringify({ success: false, error: message }), {
      status,
      headers: jsonHeaders,
    });
  }
});
