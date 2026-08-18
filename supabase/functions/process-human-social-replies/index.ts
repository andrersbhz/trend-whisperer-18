import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { AuthorizationError, authorizeUserRequest } from "../_shared/authorize-user.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" };
const META_GRAPH_VERSION = Deno.env.get("META_GRAPH_VERSION") || "v21.0";
const FB_GRAPH = `https://graph.facebook.com/${META_GRAPH_VERSION}`;
const THREADS_GRAPH = "https://graph.threads.net/v1.0";

async function decryptToken(supabase: any, token: string) {
  if (!token || !token.startsWith("ENCRYPTED:")) return token;
  const { data } = await supabase.rpc("decrypt_credential", { val: token, enc_key: "" });
  return data || token;
}

function norm(text: string) {
  return (text || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function seed(value: string) {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) hash = Math.imul(hash ^ value.charCodeAt(i), 16777619);
  return Math.abs(hash >>> 0);
}

function pick<T>(items: T[], source: string) {
  return items[seed(source) % items.length];
}

function kind(text: string) {
  const n = norm(text);
  if (/obrigad|valeu|parabens|excelente|otimo|amei|adorei|top|show/.test(n)) return "positive";
  if (/fake|mentira|errado|absurdo|ridiculo|pessimo|horrivel|discordo/.test(n)) return "negative";
  if (/\?|como |quando |onde |por que|porque|qual |quem /.test(n)) return "question";
  if (/kkkk|haha|rsrs|😂|🤣/.test(text)) return "humor";
  return "neutral";
}

function topic(text: string) {
  return (text || "")
    .replace(/https?:\/\/\S+/g, "")
    .replace(/[#@][\wÀ-ÿ]+/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 180);
}

async function facebookContext(id: string, token: string) {
  try {
    const response = await fetch(`${FB_GRAPH}/${encodeURIComponent(id)}?fields=message,parent{message,permalink_url}&access_token=${encodeURIComponent(token)}`);
    if (!response.ok) return "";
    const data = await response.json();
    return data?.parent?.message || data?.message || "";
  } catch {
    return "";
  }
}

function humanReply(item: any, post: string) {
  const responseKind = kind(item.content || "");
  const postTopic = topic(post);
  const name = (item.author_name || "").replace(/^@/, "").split(" ")[0];
  const lead = name && name.length < 20 ? `${name}, ` : "";
  const subject = postTopic
    ? `Sobre esse ponto da publicação — ${postTopic.length > 105 ? postTopic.slice(0, 105) + "…" : postTopic} — `
    : "Sobre esse assunto, ";

  const openings: Record<string, string[]> = {
    positive: [
      "que bom que esse tema chamou sua atenção.",
      "obrigado por participar dessa conversa.",
      "legal ver você entrando nesse debate.",
    ],
    negative: [
      "entendo sua colocação e é válido trazer uma visão diferente.",
      "obrigado por discordar de forma aberta; esse contraponto também faz parte do debate.",
      "seu ponto acrescenta uma perspectiva diferente à discussão.",
    ],
    question: [
      "boa pergunta; ela toca justamente em uma parte importante do assunto.",
      "essa dúvida é pertinente e ajuda a aprofundar o tema.",
      "esse é um ponto que merece ser discutido com atenção.",
    ],
    humor: [
      "boa 😄, mas esse assunto ainda rende uma discussão interessante.",
      "😄 essa foi boa. Indo ao ponto do tema, vale aprofundar a conversa.",
    ],
    neutral: [
      "obrigado por colocar sua opinião aqui.",
      "seu comentário ajuda a ampliar a conversa.",
      "esse ponto é interessante e merece ser explorado.",
    ],
  };

  const questions = [
    "Qual aspecto disso mais pesa na sua opinião?",
    "Você acha que esse cenário tende a melhorar ou piorar? Por quê?",
    "Na sua experiência, o que mais influencia essa questão?",
    "Você vê algum outro lado desse assunto que deveria entrar no debate?",
    "O que faria você mudar de opinião sobre esse ponto?",
    "Qual seria, na sua visão, a melhor forma de lidar com isso?",
  ];

  const question = pick(questions, `q:${item.external_id}:${item.content}`);
  return `${lead}${pick(openings[responseKind], item.external_id)} ${subject}${question}`.replace(/\s+/g, " ").slice(0, 450);
}

async function likeFacebook(id: string, token: string) {
  try {
    const response = await fetch(`${FB_GRAPH}/${encodeURIComponent(id)}/likes`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `access_token=${encodeURIComponent(token)}`,
    });
    return response.ok;
  } catch {
    return false;
  }
}

async function replyFacebook(id: string, message: string, token: string) {
  const response = await fetch(`${FB_GRAPH}/${encodeURIComponent(id)}/comments`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `message=${encodeURIComponent(message)}&access_token=${encodeURIComponent(token)}`,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.error?.message || "Falha Facebook");
  return data.id;
}

async function replyInstagram(id: string, message: string, token: string) {
  const response = await fetch(`${FB_GRAPH}/${encodeURIComponent(id)}/replies`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, access_token: token }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.error?.message || "Falha Instagram");
  return data.id;
}

async function replyThreads(id: string, message: string, token: string) {
  const create = await fetch(`${THREADS_GRAPH}/me/threads`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ media_type: "TEXT", text: message, reply_to_id: id, access_token: token }),
  });
  const createData = await create.json().catch(() => ({}));
  if (!create.ok) throw new Error(createData?.error?.message || "Falha Threads");

  const publish = await fetch(`${THREADS_GRAPH}/me/threads_publish`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ creation_id: createData.id, access_token: token }),
  });
  const publishData = await publish.json().catch(() => ({}));
  if (!publish.ok) throw new Error(publishData?.error?.message || "Falha Threads");
  return publishData.id;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: jsonHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const { userId } = await authorizeUserRequest(req, body?.userId || null);

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) throw new Error("Configuração interna do Supabase ausente");
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const [settingsResult, metaResult, threadsResult, itemsResult] = await Promise.all([
      supabase.from("user_settings").select("automation_enabled").eq("user_id", userId).maybeSingle(),
      supabase.from("facebook_accounts").select("page_id,access_token,instagram_account_id,facebook_enabled,instagram_enabled,is_active").eq("user_id", userId).eq("is_active", true),
      supabase.from("threads_accounts").select("id,access_token,is_active").eq("user_id", userId).eq("is_active", true),
      supabase.from("social_interactions").select("*").eq("user_id", userId).eq("status", "pending").eq("interaction_type", "comment").order("created_at", { ascending: true }).limit(24),
    ]);

    if (settingsResult.error) throw settingsResult.error;
    if (metaResult.error) throw metaResult.error;
    if (threadsResult.error) throw threadsResult.error;
    if (itemsResult.error) throw itemsResult.error;

    if (!settingsResult.data?.automation_enabled) {
      return new Response(JSON.stringify({ success: true, message: "Robô desligado", replied: 0, liked: 0, failed: 0 }), { headers: jsonHeaders });
    }

    const facebookTokens = new Map<string, string>();
    const instagramTokens = new Map<string, string>();
    const threadsTokens = new Map<string, string>();

    for (const account of metaResult.data || []) {
      const token = await decryptToken(supabase, account.access_token);
      if (account.facebook_enabled && token) facebookTokens.set(account.page_id, token);
      if (account.instagram_enabled && account.instagram_account_id && token) instagramTokens.set(account.instagram_account_id, token);
    }
    for (const account of threadsResult.data || []) {
      const token = await decryptToken(supabase, account.access_token);
      if (token) threadsTokens.set(account.id, token);
    }

    let replied = 0;
    let liked = 0;
    let failed = 0;

    for (const item of itemsResult.data || []) {
      let context = item.metadata?.post_text || "";
      let remoteId = "";
      let didLike = false;

      try {
        if (item.platform === "facebook") {
          const token = facebookTokens.get(item.page_id) || "";
          if (!token) throw new Error("Facebook sem token");
          context = await facebookContext(item.external_id, token);
          const response = humanReply(item, context);
          didLike = await likeFacebook(item.external_id, token);
          remoteId = await replyFacebook(item.external_id, response, token);

          await supabase.from("social_interactions")
            .update({ ai_response: response, status: "replied", processed_at: new Date().toISOString() })
            .eq("id", item.id)
            .eq("user_id", userId);
          await supabase.from("automation_logs").insert({
            user_id: userId,
            level: "info",
            module: "human-social-robot",
            message: `facebook: respondeu ${item.author_name}`,
            details: { resposta: response, contexto: topic(context), reply_id: remoteId, curtiu: didLike, motor: "contextual-debate-no-lovable" },
          });
        } else if (item.platform === "instagram") {
          const token = instagramTokens.get(item.page_id) || "";
          if (!token) throw new Error("Instagram sem token");
          const response = humanReply(item, context);
          remoteId = await replyInstagram(item.external_id, response, token);

          await supabase.from("social_interactions")
            .update({ ai_response: response, status: "replied", processed_at: new Date().toISOString() })
            .eq("id", item.id)
            .eq("user_id", userId);
          await supabase.from("automation_logs").insert({
            user_id: userId,
            level: "info",
            module: "human-social-robot",
            message: `instagram: respondeu ${item.author_name}`,
            details: { resposta: response, contexto: topic(context), reply_id: remoteId, motor: "contextual-debate-no-lovable" },
          });
        } else if (item.platform === "threads") {
          const token = threadsTokens.get(item.page_id) || "";
          if (!token) throw new Error("Threads sem token");
          const response = humanReply(item, context);
          remoteId = await replyThreads(item.external_id, response, token);

          await supabase.from("social_interactions")
            .update({ ai_response: response, status: "replied", processed_at: new Date().toISOString() })
            .eq("id", item.id)
            .eq("user_id", userId);
          await supabase.from("automation_logs").insert({
            user_id: userId,
            level: "info",
            module: "human-social-robot",
            message: `threads: respondeu ${item.author_name}`,
            details: { resposta: response, contexto: topic(context), reply_id: remoteId, motor: "contextual-debate-no-lovable" },
          });
        } else {
          continue;
        }

        replied++;
        if (didLike) liked++;
      } catch (error) {
        failed++;
        const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
        await supabase.from("social_interactions")
          .update({ status: "error", processed_at: new Date().toISOString() })
          .eq("id", item.id)
          .eq("user_id", userId);
        await supabase.from("automation_logs").insert({
          user_id: userId,
          level: "warn",
          module: "human-social-robot",
          message: `${item.platform}: falha ao interagir com ${item.author_name}`,
          details: { error: errorMessage, interaction_id: item.id },
        });
      }

      await new Promise((resolve) => setTimeout(resolve, 900 + (seed(item.external_id) % 2200)));
    }

    return new Response(JSON.stringify({ success: true, replied, liked, failed, engine: "contextual-debate-no-lovable" }), { headers: jsonHeaders });
  } catch (error) {
    const status = error instanceof AuthorizationError ? error.status : 500;
    const message = error instanceof AuthorizationError ? error.message : "Falha ao processar respostas sociais";
    if (!(error instanceof AuthorizationError)) console.error("[process-human-social-replies]", error);
    return new Response(JSON.stringify({ success: false, error: message }), { status, headers: jsonHeaders });
  }
});
