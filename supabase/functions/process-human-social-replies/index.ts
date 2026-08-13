import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const FB_GRAPH = "https://graph.facebook.com/v21.0";
const THREADS_GRAPH = "https://graph.threads.net/v1.0";

async function decryptToken(supabase: any, token: string) {
  if (!token || !token.startsWith("ENCRYPTED:")) return token;
  const { data } = await supabase.rpc("decrypt_credential", { val: token, enc_key: "" });
  return data || token;
}

function normalize(text: string) {
  return (text || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function hashSeed(value: string) {
  let h = 2166136261;
  for (let i = 0; i < value.length; i++) h = Math.imul(h ^ value.charCodeAt(i), 16777619);
  return Math.abs(h >>> 0);
}

function choose<T>(items: T[], seed: string): T {
  return items[hashSeed(seed) % items.length];
}

function classify(text: string) {
  const t = normalize(text);
  if (/obrigad|valeu|gratid|parabens|excelente|otimo|amei|adorei|top|show|perfeito/.test(t)) return "positive";
  if (/fake|mentira|errado|absurdo|ridiculo|pessimo|horrivel|discordo|nao gostei/.test(t)) return "negative";
  if (/\?|como |quando |onde |por que|porque|qual |quais |quem |pode |tem como/.test(t)) return "question";
  if (/kkkk|haha|rsrs|😂|🤣/.test(text)) return "humor";
  if (text.trim().length <= 12) return "short";
  return "neutral";
}

function buildHumanReply(item: any, growthMode: boolean) {
  const kind = classify(item.content || "");
  const name = (item.author_name || "").replace(/^@/, "").split(" ")[0];
  const lead = name && name.length <= 20 ? `${name}, ` : "";
  const pools: Record<string, string[]> = {
    positive: [
      `${lead}que bom saber disso. Obrigado por acompanhar!`,
      `${lead}ficamos felizes que tenha gostado. Valeu por estar por aqui!`,
      `${lead}obrigado pelo carinho e por participar da conversa.`,
      `${lead}bom demais ler isso. Obrigado por acompanhar nosso conteúdo!`,
    ],
    negative: [
      `${lead}entendo seu ponto. Obrigado por trazer uma visão diferente para a conversa.`,
      `${lead}valeu por comentar. Opiniões diferentes ajudam a ampliar o debate.`,
      `${lead}obrigado por compartilhar sua percepção. Vamos considerar esse ponto.`,
      `${lead}entendi sua colocação. Obrigado por participar com respeito.`,
    ],
    question: [
      `${lead}boa pergunta. Vamos verificar esse ponto com atenção para manter a informação correta.`,
      `${lead}essa é uma dúvida importante. Obrigado por levantar o tema.`,
      `${lead}ótima observação. Esse ponto merece mesmo uma explicação mais detalhada.`,
      `${lead}boa questão. Vamos manter esse assunto no radar nas próximas atualizações.`,
    ],
    humor: [
      `${lead}essa foi boa 😄 obrigado por entrar na conversa!`,
      `${lead}você melhorou a seção de comentários hoje 😄`,
      `${lead}boa! 😄 Valeu por acompanhar.`,
    ],
    short: [
      `${lead}valeu por comentar!`,
      `${lead}obrigado por acompanhar!`,
      `${lead}bom ter você por aqui!`,
      `${lead}obrigado pela interação!`,
    ],
    neutral: [
      `${lead}obrigado por compartilhar sua opinião.`,
      `${lead}valeu por participar da conversa!`,
      `${lead}obrigado por acompanhar e deixar seu comentário.`,
      `${lead}bom ter sua participação por aqui.`,
    ],
  };
  let reply = choose(pools[kind] || pools.neutral, `${item.external_id}:${item.content}`);
  if (growthMode && kind !== "negative" && hashSeed(item.external_id) % 3 === 0) {
    reply += choose([
      " Se curtir esse tipo de conteúdo, acompanhe a página para ver os próximos.",
      " Se esse tema te interessa, acompanhe a gente por aqui.",
      " Tem mais conteúdo desse tipo por aqui — acompanhe a página se fizer sentido para você.",
    ], `growth:${item.external_id}`);
  }
  return reply.slice(0, 450);
}

async function likeFacebookComment(commentId: string, token: string) {
  try {
    const r = await fetch(`${FB_GRAPH}/${commentId}/likes`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `access_token=${encodeURIComponent(token)}`,
    });
    return r.ok;
  } catch { return false; }
}

async function replyFacebook(commentId: string, message: string, token: string) {
  const r = await fetch(`${FB_GRAPH}/${commentId}/comments`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `message=${encodeURIComponent(message)}&access_token=${encodeURIComponent(token)}`,
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d?.error?.message || "Falha ao responder Facebook");
  return d.id as string;
}

async function replyInstagram(commentId: string, message: string, token: string) {
  const r = await fetch(`${FB_GRAPH}/${commentId}/replies`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, access_token: token }),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d?.error?.message || "Falha ao responder Instagram");
  return d.id as string;
}

async function replyThreads(replyId: string, message: string, token: string) {
  const create = await fetch(`${THREADS_GRAPH}/me/threads`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ media_type: "TEXT", text: message, reply_to_id: replyId, access_token: token }),
  });
  const created = await create.json().catch(() => ({}));
  if (!create.ok) throw new Error(created?.error?.message || "Falha ao criar resposta Threads");

  const publish = await fetch(`${THREADS_GRAPH}/me/threads_publish`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ creation_id: created.id, access_token: token }),
  });
  const published = await publish.json().catch(() => ({}));
  if (!publish.ok) throw new Error(published?.error?.message || "Falha ao publicar resposta Threads");
  return published.id as string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { userId } = await req.json();
    if (!userId) throw new Error("userId is required");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const [{ data: settings }, { data: metaAccounts }, { data: threadsAccounts }, { data: interactions }] = await Promise.all([
      supabase.from("user_settings").select("automation_enabled,follower_growth_mode").eq("user_id", userId).maybeSingle(),
      supabase.from("facebook_accounts").select("id,page_id,page_name,access_token,instagram_account_id,facebook_enabled,instagram_enabled,is_active").eq("user_id", userId).eq("is_active", true),
      supabase.from("threads_accounts").select("id,threads_user_id,username,access_token,is_active").eq("user_id", userId).eq("is_active", true),
      supabase.from("social_interactions").select("*").eq("user_id", userId).eq("status", "pending").eq("interaction_type", "comment").order("created_at", { ascending: true }).limit(24),
    ]);

    if (!settings?.automation_enabled) {
      return new Response(JSON.stringify({ success: true, message: "Robô desligado", replied: 0, liked: 0 }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const fbTokens = new Map<string, string>();
    const igTokens = new Map<string, string>();
    for (const a of metaAccounts || []) {
      const token = await decryptToken(supabase, a.access_token);
      if (a.facebook_enabled && token) fbTokens.set(a.page_id, token);
      if (a.instagram_enabled && a.instagram_account_id && token) igTokens.set(a.instagram_account_id, token);
    }
    const threadsTokens = new Map<string, string>();
    for (const a of threadsAccounts || []) {
      const token = await decryptToken(supabase, a.access_token);
      if (token) threadsTokens.set(a.id, token);
    }

    let replied = 0;
    let liked = 0;
    let failed = 0;

    for (const item of interactions || []) {
      const response = buildHumanReply(item, Boolean(settings?.follower_growth_mode));
      let token = "";
      let remoteId = "";
      let didLike = false;

      try {
        if (item.platform === "facebook") {
          token = fbTokens.get(item.page_id) || "";
          if (!token) throw new Error("Página Facebook desconectada ou sem token");
          didLike = await likeFacebookComment(item.external_id, token);
          remoteId = await replyFacebook(item.external_id, response, token);
        } else if (item.platform === "instagram") {
          token = igTokens.get(item.page_id) || "";
          if (!token) throw new Error("Instagram desconectado ou sem token");
          remoteId = await replyInstagram(item.external_id, response, token);
        } else if (item.platform === "threads") {
          token = threadsTokens.get(item.page_id) || "";
          if (!token) throw new Error("Threads desconectado ou sem token");
          remoteId = await replyThreads(item.external_id, response, token);
        } else {
          continue;
        }

        await supabase.from("social_interactions").update({
          ai_response: response,
          status: "replied",
          processed_at: new Date().toISOString(),
        }).eq("id", item.id);

        await supabase.from("automation_logs").insert({
          user_id: userId,
          level: "info",
          module: "human-social-robot",
          message: `${item.platform}: respondeu ${item.author_name}${didLike ? " e curtiu o comentário" : ""}`,
          details: { interaction_id: item.id, resposta: response, reply_id: remoteId, curtiu_comentario: didLike, motor: "rule-based-no-lovable" },
        });
        replied++;
        if (didLike) liked++;
      } catch (error) {
        failed++;
        await supabase.from("social_interactions").update({ status: "error", processed_at: new Date().toISOString(), ai_response: response }).eq("id", item.id);
        await supabase.from("automation_logs").insert({
          user_id: userId,
          level: "warn",
          module: "human-social-robot",
          message: `${item.platform}: falha ao interagir com ${item.author_name}`,
          details: { error: error instanceof Error ? error.message : String(error), interaction_id: item.id },
        });
      }

      await new Promise((resolve) => setTimeout(resolve, 900 + (hashSeed(item.external_id) % 2200)));
    }

    return new Response(JSON.stringify({ success: true, replied, liked, failed, engine: "rule-based-no-lovable" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ success: false, error: error instanceof Error ? error.message : String(error) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
