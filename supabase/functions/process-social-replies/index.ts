import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GRAPH = "https://graph.facebook.com/v21.0";

async function decryptToken(supabase: any, token: string): Promise<string> {
  if (!token) return token;
  if (!token.startsWith("ENCRYPTED:")) return token;
  const { data } = await supabase.rpc("decrypt_credential", { val: token, enc_key: "" });
  return data || token;
}

async function fetchPostContext(commentId: string, token: string): Promise<string> {
  try {
    const r = await fetch(
      `${GRAPH}/${commentId}?fields=message,parent{message,permalink_url},from{name}&access_token=${token}`
    );
    if (!r.ok) return "";
    const d = await r.json();
    return d?.parent?.message || d?.message || "";
  } catch { return ""; }
}

async function likeComment(commentId: string, token: string): Promise<boolean> {
  try {
    const r = await fetch(`${GRAPH}/${commentId}/likes`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `access_token=${encodeURIComponent(token)}`,
    });
    return r.ok;
  } catch { return false; }
}

async function replyToComment(commentId: string, message: string, token: string): Promise<{ ok: boolean; id?: string; error?: string }> {
  try {
    const r = await fetch(`${GRAPH}/${commentId}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `message=${encodeURIComponent(message)}&access_token=${encodeURIComponent(token)}`,
    });
    const d = await r.json();
    if (!r.ok) return { ok: false, error: d?.error?.message || "Erro desconhecido" };
    return { ok: true, id: d.id };
  } catch (e: any) { return { ok: false, error: e.message }; }
}

async function callAI(prompt: string, settings: any): Promise<string> {
  // Prioridade: Lovable AI (gratuito) -> OpenAI -> Gemini -> Groq
  const lovableKey = Deno.env.get("LOVABLE_API_KEY");
  if (lovableKey) {
    try {
      const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${lovableKey}` },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [{ role: "user", content: prompt }],
          max_tokens: 200,
        }),
      });
      if (r.ok) {
        const d = await r.json();
        const txt = d.choices?.[0]?.message?.content;
        if (txt) return txt;
      }
    } catch (e) { console.error("[AI] Lovable falhou:", e); }
  }

  if (settings?.openai_api_key) {
    try {
      const r = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${settings.openai_api_key}` },
        body: JSON.stringify({ model: "gpt-4o-mini", messages: [{ role: "user", content: prompt }], max_tokens: 200 }),
      });
      const d = await r.json();
      if (d.choices?.[0]?.message?.content) return d.choices[0].message.content;
    } catch (e) { console.error("[AI] OpenAI falhou:", e); }
  }

  if (settings?.gemini_api_key) {
    try {
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${settings.gemini_api_key}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
      });
      const d = await r.json();
      const txt = d.candidates?.[0]?.content?.parts?.[0]?.text;
      if (txt) return txt;
    } catch (e) { console.error("[AI] Gemini falhou:", e); }
  }

  return "";
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { userId } = await req.json();
    if (!userId) throw new Error("userId is required");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // 1. Buscar interações pendentes (comentários)
    const { data: interactions } = await supabase
      .from("social_interactions")
      .select("*")
      .eq("user_id", userId)
      .eq("status", "pending")
      .eq("interaction_type", "comment")
      .limit(15);

    if (!interactions || interactions.length === 0) {
      return new Response(JSON.stringify({ message: "Sem interações pendentes", replied: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Settings + tokens das páginas
    const { data: settings } = await supabase.from("user_settings").select("*").eq("user_id", userId).single();
    const { data: pages } = await supabase
      .from("facebook_accounts")
      .select("page_id, access_token")
      .eq("user_id", userId)
      .eq("is_active", true);

    const tokenMap = new Map<string, string>();
    for (const p of pages || []) {
      tokenMap.set(p.page_id, await decryptToken(supabase, p.access_token));
    }

    const followerGrowth = settings?.follower_growth_mode || false;
    let basePrompt = settings?.social_reply_prompt ||
      `Você é um gestor de redes sociais humano, empático e simpático. Responda comentários de forma curta (1-2 frases), natural, calorosa, sem soar robótico. Use português do Brasil, evite emojis em excesso (no máximo 1).`;

    if (followerGrowth) {
      basePrompt += ` IMPORTANTE: Modo crescimento ativo — sempre convide a pessoa a curtir/seguir a página de forma sutil e natural, conectando com o tema do conteúdo.`;
    }

    let totalReplied = 0;
    let totalLiked = 0;

    for (const item of interactions) {
      const pageToken = tokenMap.get(item.page_id);
      if (!pageToken) {
        await supabase.from("automation_logs").insert({
          user_id: userId, level: "warn", module: "robot",
          message: `Sem token para página ${item.page_id} - pulando ${item.author_name}`,
        });
        continue;
      }

      // Contexto: pega o texto do post original (tema do artigo)
      const postContext = await fetchPostContext(item.external_id, pageToken);

      const prompt = `${basePrompt}

CONTEXTO DA PUBLICAÇÃO (tema do artigo):
"${postContext || "Publicação da página"}"

COMENTÁRIO de ${item.author_name}:
"${item.content}"

Escreva apenas a resposta direta ao comentário, conectada ao tema acima. Sem aspas, sem prefixos.`;

      const aiResponse = (await callAI(prompt, settings))?.trim();
      if (!aiResponse) {
        await supabase.from("automation_logs").insert({
          user_id: userId, level: "warn", module: "robot",
          message: `IA não gerou resposta para ${item.author_name}`,
        });
        continue;
      }

      // 1) Curtir o comentário (comportamento humano)
      const liked = await likeComment(item.external_id, pageToken);
      if (liked) totalLiked++;

      // 2) Postar resposta de verdade no Facebook
      const posted = await replyToComment(item.external_id, aiResponse, pageToken);

      if (posted.ok) {
        await supabase.from("social_interactions").update({
          ai_response: aiResponse,
          status: "replied",
          processed_at: new Date().toISOString(),
        }).eq("id", item.id);

        await supabase.from("automation_logs").insert({
          user_id: userId, level: "info", module: "robot",
          message: `🤖 Robô curtiu${liked ? " ✅" : " ⚠️"} e respondeu ${item.author_name} no Facebook`,
          details: {
            plataforma: item.platform,
            pagina: item.page_id,
            tema_publicacao: postContext?.slice(0, 200),
            comentario_original: item.content,
            resposta_publicada: aiResponse,
            curtiu_comentario: liked,
            resposta_id: posted.id,
            modo_crescimento: followerGrowth,
          }
        });
        totalReplied++;
      } else {
        await supabase.from("social_interactions").update({
          ai_response: aiResponse,
          status: "error",
          processed_at: new Date().toISOString(),
        }).eq("id", item.id);

        await supabase.from("automation_logs").insert({
          user_id: userId, level: "error", module: "robot",
          message: `Falha ao publicar resposta para ${item.author_name}: ${posted.error}`,
          details: { comentario: item.content, resposta_gerada: aiResponse, erro: posted.error },
        });
      }

      // Delay humano entre ações (1-3s)
      await new Promise(r => setTimeout(r, 1000 + Math.random() * 2000));
    }

    return new Response(JSON.stringify({ success: true, replied: totalReplied, liked: totalLiked }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: any) {
    console.error("[process-social-replies] Erro:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
