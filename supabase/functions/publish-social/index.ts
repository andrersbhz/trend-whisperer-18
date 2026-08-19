import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { AuthorizationError, authorizeUserRequest } from "../_shared/authorize-user.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" };
const META_GRAPH_VERSION = Deno.env.get("META_GRAPH_VERSION") || "v21.0";
const META_GRAPH = `https://graph.facebook.com/${META_GRAPH_VERSION}`;
const THREADS_GRAPH = "https://graph.threads.net/v1.0";

function cleanText(value: string | null | undefined) {
  return (value || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function cleanError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error || "Erro desconhecido");
  return message.replace(/access_token=[^&\s]+/gi, "access_token=[redacted]").slice(0, 500);
}

function safeUrl(value: unknown, options: { httpsOnly?: boolean } = {}) {
  if (value == null || value === "") return null;
  const raw = String(value).trim();
  if (!raw || raw.length > 2048) throw new Error("URL inválida");
  const url = new URL(raw);
  if (options.httpsOnly) {
    if (url.protocol !== "https:") throw new Error("A imagem precisa usar HTTPS");
  } else if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error("URL precisa usar HTTP ou HTTPS");
  }
  if (url.username || url.password) throw new Error("URL com credenciais não é permitida");
  return url.toString();
}

function buildArticleCaption(article: any, linkUrl: string | null) {
  const title = cleanText(article.title);
  const summary = cleanText(article.excerpt || article.meta_description || article.content).slice(0, 1500);
  return [title, summary, linkUrl ? `Leia mais: ${linkUrl}` : null].filter(Boolean).join("\n\n").slice(0, 2100);
}

async function decryptField(supabase: any, value: string | null) {
  if (!value || !value.startsWith("ENCRYPTED:")) return value;
  const { data, error } = await supabase.rpc("decrypt_credential", { val: value, enc_key: "" });
  if (error) throw error;
  return data || null;
}

async function metaJson(url: string, init?: RequestInit) {
  const ctrl = new AbortController();
  const timeout = setTimeout(() => ctrl.abort(), 20_000);
  try {
    const response = await fetch(url, { ...init, signal: ctrl.signal });
    const text = await response.text();
    let body: any = null;
    try { body = text ? JSON.parse(text) : {}; } catch { body = {}; }
    if (!response.ok) throw new Error(body?.error?.message || `Meta API HTTP ${response.status}`);
    return body;
  } finally {
    clearTimeout(timeout);
  }
}

async function publishInstagram(igId: string, token: string, caption: string, imageUrl: string) {
  const container = await metaJson(`${META_GRAPH}/${encodeURIComponent(igId)}/media`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ image_url: imageUrl, caption, access_token: token }),
  });

  for (let attempt = 0; attempt < 12; attempt++) {
    await new Promise((resolve) => setTimeout(resolve, attempt === 0 ? 1200 : 2200));
    const status = await metaJson(
      `${META_GRAPH}/${encodeURIComponent(container.id)}?fields=status_code,status&access_token=${encodeURIComponent(token)}`
    );
    if (status.status_code === "FINISHED") break;
    if (status.status_code === "ERROR" || attempt === 11) throw new Error(status.status || "Falha ao processar mídia no Instagram");
  }

  const published = await metaJson(`${META_GRAPH}/${encodeURIComponent(igId)}/media_publish`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ creation_id: container.id, access_token: token }),
  });

  let permalink: string | null = null;
  try {
    const media = await metaJson(`${META_GRAPH}/${encodeURIComponent(published.id)}?fields=permalink&access_token=${encodeURIComponent(token)}`);
    permalink = media.permalink || null;
  } catch { /* best effort */ }
  return { id: published.id as string, permalink };
}

async function publishFacebook(
  pageId: string,
  token: string,
  caption: string,
  imageUrl: string | null,
  linkUrl: string | null,
) {
  if (imageUrl) {
    const photoCaption = [caption, linkUrl && !caption.includes(linkUrl) ? linkUrl : null]
      .filter(Boolean)
      .join("\n\n")
      .slice(0, 5000);
    const published = await metaJson(`${META_GRAPH}/${encodeURIComponent(pageId)}/photos`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: imageUrl, caption: photoCaption, access_token: token, published: true }),
    });
    const remoteId = String(published.post_id || published.id);
    return { id: remoteId, permalink: remoteId ? `https://www.facebook.com/${remoteId}` : null };
  }

  const body: Record<string, string> = { message: caption, access_token: token };
  if (linkUrl) body.link = linkUrl;
  const published = await metaJson(`${META_GRAPH}/${encodeURIComponent(pageId)}/feed`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return { id: published.id as string, permalink: published.id ? `https://www.facebook.com/${published.id}` : null };
}

async function publishThreads(userId: string, token: string, caption: string, imageUrl: string | null, linkUrl: string | null) {
  const text = [caption, linkUrl && !caption.includes(linkUrl) ? linkUrl : null].filter(Boolean).join("\n\n").slice(0, 500);
  const createBody: Record<string, string> = {
    media_type: imageUrl ? "IMAGE" : "TEXT",
    text,
    access_token: token,
  };
  if (imageUrl) createBody.image_url = imageUrl;

  const container = await metaJson(`${THREADS_GRAPH}/${encodeURIComponent(userId)}/threads`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(createBody),
  });
  const published = await metaJson(`${THREADS_GRAPH}/${encodeURIComponent(userId)}/threads_publish`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ creation_id: container.id, access_token: token }),
  });
  return { id: published.id as string, permalink: null as string | null };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: jsonHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const { userId } = await authorizeUserRequest(req, body?.userId || null);

    const articleId: string | null = body.articleId ? String(body.articleId) : null;
    const targetKeys: string[] = Array.isArray(body.targetKeys)
      ? body.targetKeys.filter((key: unknown) => typeof key === "string" && key.length <= 200).slice(0, 50)
      : [];

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) throw new Error("Configuração interna do Supabase ausente");
    const admin = createClient(supabaseUrl, serviceRoleKey);

    let article: any = null;
    let caption = cleanText(body.content?.caption).slice(0, 5000);
    let imageUrl = safeUrl(body.content?.imageUrl || null, { httpsOnly: true });
    let linkUrl = safeUrl(body.content?.linkUrl || null);

    if (articleId) {
      const { data, error } = await admin
        .from("articles")
        .select("*")
        .eq("id", articleId)
        .eq("user_id", userId)
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new Error("Artigo não encontrado");
      article = data;
      imageUrl = imageUrl || safeUrl(article.featured_image_url || null, { httpsOnly: true });

      if (!linkUrl) {
        const { data: log } = await admin.from("publish_log")
          .select("published_url")
          .eq("article_id", articleId)
          .eq("platform", "wordpress")
          .eq("status", "success")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        linkUrl = safeUrl(log?.published_url || null);
      }
      if (!caption) caption = buildArticleCaption(article, linkUrl);
    }

    if (!caption) throw new Error("Legenda obrigatória");

    const [{ data: metaAccounts, error: metaError }, { data: threadsAccounts, error: threadsError }] = await Promise.all([
      admin.from("facebook_accounts").select("*").eq("user_id", userId).eq("is_active", true),
      admin.from("threads_accounts").select("*").eq("user_id", userId).eq("is_active", true),
    ]);
    if (metaError) throw metaError;
    if (threadsError) throw threadsError;

    const results: Array<{ accountKey: string; target: string; channel: string; ok: boolean; id?: string; permalink?: string | null; error?: string }> = [];
    const wants = (key: string) => targetKeys.length === 0 || targetKeys.includes(key);

    const saveLog = async (
      platform: string,
      key: string,
      name: string,
      ok: boolean,
      remoteId?: string,
      permalink?: string | null,
      error?: string,
    ) => {
      const { error: logError } = await admin.from("social_publications").insert({
        user_id: userId,
        article_id: articleId,
        platform,
        account_key: key,
        account_name: name,
        status: ok ? "success" : "failed",
        remote_id: remoteId || null,
        permalink: permalink || null,
        caption,
        image_url: imageUrl,
        link_url: linkUrl,
        error_message: error ? cleanError(error) : null,
        published_at: ok ? new Date().toISOString() : null,
      });
      if (logError) console.error("[publish-social] Falha ao salvar log:", logError.message);
    };

    for (const account of metaAccounts || []) {
      const accountToken = await decryptField(admin, account.access_token);
      if (!accountToken) continue;

      const fbKey = `facebook:${account.page_id}`;
      if (account.facebook_enabled !== false && wants(fbKey)) {
        try {
          const published = await publishFacebook(account.page_id, accountToken, caption, imageUrl, linkUrl);
          results.push({ accountKey: fbKey, target: account.page_name || account.page_id, channel: "facebook", ok: true, ...published });
          await saveLog("facebook", fbKey, account.page_name || account.page_id, true, published.id, published.permalink);
        } catch (error) {
          const message = cleanError(error);
          results.push({ accountKey: fbKey, target: account.page_name || account.page_id, channel: "facebook", ok: false, error: message });
          await saveLog("facebook", fbKey, account.page_name || account.page_id, false, undefined, null, message);
        }
      }

      if (account.instagram_account_id && account.instagram_enabled !== false) {
        const igKey = `instagram:${account.instagram_account_id}`;
        if (wants(igKey)) {
          if (!imageUrl) {
            const message = "Instagram exige uma imagem pública em HTTPS";
            results.push({ accountKey: igKey, target: account.page_name, channel: "instagram", ok: false, error: message });
            await saveLog("instagram", igKey, account.page_name, false, undefined, null, message);
          } else {
            try {
              const published = await publishInstagram(account.instagram_account_id, accountToken, caption.slice(0, 2200), imageUrl);
              results.push({ accountKey: igKey, target: account.page_name, channel: "instagram", ok: true, ...published });
              await saveLog("instagram", igKey, account.page_name, true, published.id, published.permalink);
              if (articleId) {
                await admin.from("articles")
                  .update({ instagram_post_id: published.id })
                  .eq("id", articleId)
                  .eq("user_id", userId);
              }
            } catch (error) {
              const message = cleanError(error);
              results.push({ accountKey: igKey, target: account.page_name, channel: "instagram", ok: false, error: message });
              await saveLog("instagram", igKey, account.page_name, false, undefined, null, message);
            }
          }
        }
      }
    }

    for (const account of threadsAccounts || []) {
      const key = `threads:${account.id}`;
      if (!wants(key)) continue;
      const accountToken = await decryptField(admin, account.access_token);
      if (!accountToken) {
        const message = "Threads sem token ativo";
        results.push({ accountKey: key, target: account.username ? `@${account.username}` : account.threads_user_id, channel: "threads", ok: false, error: message });
        await saveLog("threads", key, account.username || account.threads_user_id, false, undefined, null, message);
        continue;
      }

      try {
        const published = await publishThreads(account.threads_user_id, accountToken, caption, imageUrl, linkUrl);
        results.push({ accountKey: key, target: account.username ? `@${account.username}` : account.threads_user_id, channel: "threads", ok: true, ...published });
        await saveLog("threads", key, account.username || account.threads_user_id, true, published.id, published.permalink);
      } catch (error) {
        const message = cleanError(error);
        results.push({ accountKey: key, target: account.username ? `@${account.username}` : account.threads_user_id, channel: "threads", ok: false, error: message });
        await saveLog("threads", key, account.username || account.threads_user_id, false, undefined, null, message);
      }
    }

    const okCount = results.filter((result) => result.ok).length;
    return new Response(JSON.stringify({
      success: okCount > 0,
      message: results.length
        ? `Publicado com sucesso em ${okCount}/${results.length} destino(s).`
        : "Nenhuma conta conectada foi selecionada.",
      results,
    }), { headers: jsonHeaders });
  } catch (error) {
    const status = error instanceof AuthorizationError ? error.status : 500;
    const message = error instanceof AuthorizationError ? error.message : cleanError(error);
    if (!(error instanceof AuthorizationError)) console.error("[publish-social]", message);
    return new Response(JSON.stringify({ success: false, error: message }), {
      status,
      headers: jsonHeaders,
    });
  }
});
