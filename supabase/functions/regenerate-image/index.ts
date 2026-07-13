import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// O prompt da imagem é composto OBRIGATORIAMENTE pelo prompt configurado nas configurações e o título da notícia.
function buildImagePrompt(title: string, content: string | null, visualElements: string | null | undefined, imagePrompt: string | null | undefined, fmt?: { width: number; height: number; label: string }): string {
  if (!imagePrompt || imagePrompt.trim().length < 5) {
    throw new Error("O 'Prompt de Imagem IA' não está configurado em Configurações > Geral. Este prompt é obrigatório.");
  }

  // Segue EXATAMENTE o Prompt de Imagem IA das configurações.
  // Apenas injeta o título da notícia como assunto e o formato/proporção como requisito técnico.
  const base = imagePrompt.trim().replace(/\{\{?\s*title\s*\}?\}/gi, title);
  const hasTitleToken = base !== imagePrompt.trim();

  const parts: string[] = [base];
  if (!hasTitleToken) {
    parts.push(`Título da notícia (assunto da imagem): ${title}`);
  }
  if (fmt) {
    parts.push(`Proporção/formato obrigatório: ${fmt.label} (${fmt.width}x${fmt.height}px).`);
  }
  return parts.join("\n\n");
}

const IMAGE_FORMATS: Record<string, { width: number; height: number; dalle: "1024x1024" | "1024x1792" | "1792x1024"; label: string }> = {
  instagram_square:   { width: 1080, height: 1080, dalle: "1024x1024", label: "Instagram Feed Quadrado 1:1" },
  instagram_portrait: { width: 1080, height: 1350, dalle: "1024x1792", label: "Instagram Feed Retrato 4:5" },
  instagram_story:    { width: 1080, height: 1920, dalle: "1024x1792", label: "Instagram Story 9:16" },
  facebook_post:      { width: 1200, height: 630,  dalle: "1792x1024", label: "Facebook Post 1.91:1" },
  facebook_square:    { width: 1200, height: 1200, dalle: "1024x1024", label: "Facebook Quadrado 1:1" },
  facebook_story:     { width: 1080, height: 1920, dalle: "1024x1792", label: "Facebook Story 9:16" },
  linkedin_post:      { width: 1200, height: 627,  dalle: "1792x1024", label: "LinkedIn Post 1.91:1" },
  linkedin_square:    { width: 1200, height: 1200, dalle: "1024x1024", label: "LinkedIn Quadrado 1:1" },
};

function getImageFormat(key?: string | null) {
  return IMAGE_FORMATS[key || ""] || IMAGE_FORMATS.instagram_portrait;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

class ProviderError extends Error {
  status: number;
  retryable: boolean;
  billing: boolean;

  constructor(message: string, status = 500, retryable = false, billing = false) {
    super(message);
    this.name = "ProviderError";
    this.status = status;
    this.retryable = retryable;
    this.billing = billing;
  }
}

async function readResponseDetails(resp: Response) {
  const text = await resp.text();
  return text.slice(0, 500);
}

function isBillingIssue(status: number, details: string) {
  return status === 402 || /payment_required|not enough credits|spending cap|resource_exhausted|quota|monthly spending cap/i.test(details);
}

function isRetryableIssue(status: number, details: string) {
  return [408, 429, 500, 502, 503, 504].includes(status) || /temporar|timeout|unavailable|overloaded|rate limit/i.test(details);
}

function createProviderError(provider: string, status: number, details: string) {
  const billing = isBillingIssue(status, details);
  const retryable = isRetryableIssue(status, details) && !billing;
  return new ProviderError(`${provider} ${status}: ${details}`, status, retryable, billing);
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

async function withRetry<T>(operation: () => Promise<T>, retries = 2, baseDelayMs = 1500): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      const providerError = error instanceof ProviderError
        ? error
        : new ProviderError(getErrorMessage(error));

      if (attempt >= retries || !providerError.retryable) {
        throw providerError;
      }

      const delay = baseDelayMs * (attempt + 1);
      console.warn(`Retrying after transient image error in ${delay}ms: ${providerError.message}`);
      await sleep(delay);
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

async function generateImageGemini(apiKey: string, title: string, content: string | null, visualElements: string | null, imagePrompt: string | null, fmt?: { width: number; height: number; label: string }): Promise<string> {
  // Modelos experimentais que podem suportar geração de imagem
  const models = ["gemini-2.0-flash-exp", "gemini-2.5-flash"];
  const errors: string[] = [];

  for (const model of models) {
    try {
      return await withRetry(async () => {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
        const resp = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
          body: JSON.stringify({
            contents: [{ parts: [{ text: buildImagePrompt(title, content, visualElements, imagePrompt, fmt) }] }],
            generationConfig: { 
              responseModalities: ["IMAGE"],
            },
          }),
        });

        if (!resp.ok) {
          throw createProviderError(`Gemini image ${model}`, resp.status, await readResponseDetails(resp));
        }

        const data = await resp.json();
        const parts = data.candidates?.[0]?.content?.parts || [];
        const imgPart = parts.find((p: any) => p.inlineData?.mimeType?.startsWith("image/"));

        if (!imgPart?.inlineData) {
          throw new ProviderError(`Gemini image ${model} não retornou uma imagem direta.`, 500, false, false);
        }

        return `data:${imgPart.inlineData.mimeType};base64,${imgPart.inlineData.data}`;
      }, 1, 2000);
    } catch (error) {
      const message = getErrorMessage(error);
      console.warn(message);
      errors.push(message);
    }
  }

  throw new ProviderError(errors.join(" | ") || "Falha ao gerar imagem com Gemini", 500, false, errors.some((message) => isBillingIssue(0, message)));
}

async function generateImageLovable(title: string, content: string | null, visualElements: string | null, imagePrompt: string | null, fmt?: { width: number; height: number; label: string }, knowledgeUrls: string[] = []): Promise<string> {
  const lovableKey = Deno.env.get("LOVABLE_API_KEY");
  if (!lovableKey) throw new ProviderError("LOVABLE_API_KEY não disponível no ambiente.", 500, false, false);
  const basePrompt = buildImagePrompt(title, content, visualElements, imagePrompt, fmt);
  const refs = (knowledgeUrls || []).slice(0, 10).filter((u) => typeof u === "string" && u.startsWith("http"));
  const promptText = refs.length
    ? `${basePrompt}\n\nCONHECIMENTO VISUAL DE REFERÊNCIA: Você recebeu ${refs.length} imagem(ns) de referência anexadas nesta mensagem. Analise cuidadosamente o estilo visual, paleta de cores, composição, iluminação, tipografia e elementos gráficos delas e SE INSPIRE nesses modelos ao gerar a nova arte. A nova imagem deve seguir o prompt acima em conjunto com o estilo/identidade visual demonstrado nas referências.`
    : basePrompt;

  const userContent: any[] = [{ type: "text", text: promptText }];
  for (const url of refs) {
    userContent.push({ type: "image_url", image_url: { url } });
  }

  const models = ["google/gemini-2.5-flash-image", "google/gemini-3-pro-image"];
  const errs: string[] = [];
  for (const model of models) {
    try {
      return await withRetry(async () => {
        const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: { Authorization: `Bearer ${lovableKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model,
            messages: [{ role: "user", content: userContent }],
            modalities: ["image", "text"],
          }),
        });
        if (!resp.ok) throw createProviderError(`Lovable AI ${model}`, resp.status, await readResponseDetails(resp));
        const data = await resp.json();
        const imgUrl = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;
        if (!imgUrl) throw new ProviderError(`Lovable AI ${model} não retornou imagem.`, 500, false, false);
        return imgUrl as string;
      }, 1, 1500);
    } catch (e) {
      errs.push(getErrorMessage(e));
    }
  }
  throw new ProviderError(errs.join(" | ") || "Falha ao gerar imagem via Lovable AI", 500, false, false);
}

async function generateImageDallE(apiKey: string, title: string, content: string | null, visualElements: string | null, imagePrompt: string | null, fmt?: { width: number; height: number; label: string; dalle: string }): Promise<string> {
  const dalleSize = (fmt?.dalle as "1024x1024" | "1024x1792" | "1792x1024") || "1024x1024";
  return await withRetry(async () => {
    const resp = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "dall-e-3",
        prompt: buildImagePrompt(title, content, visualElements, imagePrompt, fmt),
        n: 1,
        size: dalleSize,
        quality: "hd"
      }),
    });

    if (!resp.ok) {
      throw createProviderError("OpenAI DALL-E", resp.status, await readResponseDetails(resp));
    }

    const data = await resp.json();
    const imageUrl = data.data?.[0]?.url;
    if (!imageUrl) {
      throw new ProviderError("OpenAI DALL-E não retornou uma URL de imagem válida.", 500, false, false);
    }

    return imageUrl;
  }, 1, 2000);
}

// Fallback gratuito e resiliente usando Pollinations.ai
async function generateImagePollinations(title: string, content: string | null, visualElements: string | null, imagePrompt: string | null, fmt?: { width: number; height: number; label: string }): Promise<string> {
  const f = fmt || { width: 1080, height: 1350, label: "Instagram Feed Retrato 4:5" };
  const prompt = buildImagePrompt(title, content, visualElements, imagePrompt, f);
  const encodedPrompt = encodeURIComponent(prompt);
  const seed = Math.floor(Math.random() * 1000000);
  const url = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=${f.width}&height=${f.height}&nologo=true&seed=${seed}`;
  
  // Tenta validar se a URL está ok
  try {
    const resp = await fetch(url);
    if (!resp.ok) throw new Error("Pollinations failed");
    return url;
  } catch {
    // Se falhar o fetch (raro), apenas retorna a URL e deixa o browser carregar
    return url;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const { userId, articleIds, force = false } = body;
    if (!userId || !articleIds?.length) throw new Error("userId and articleIds are required");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Carrega chaves de IA do usuário
    let geminiApiKey: string | null = null;
    let openaiApiKey: string | null = null;
    const { data: settings } = await supabase
      .from("user_settings")
      .select("gemini_api_key, openai_api_key, writer_prompt, image_mode, image_prompt, image_format, image_knowledge_urls")
      .eq("user_id", userId)
      .single();
    
    // O prompt de imagem é obrigatório vindo de image_prompt conforme solicitado pelo usuário.
    const imagePrompt: string = settings?.image_prompt?.trim();
    if (!imagePrompt && force) {
      throw new Error("O 'Prompt de Imagem IA' não está configurado. Por favor, vá em Configurações > Geral.");
    }
    const imageMode = settings?.image_mode || "ai";
    const fmt = getImageFormat((settings as any)?.image_format);

    if (imageMode !== "ai" && !force) {
      throw new Error(`A regeneração por IA está desativada. Altere o Modo de Imagem para "Gerada por IA" nas configurações.`);
    }

    if (settings?.gemini_api_key) {
      const { data: decrypted } = await supabase.rpc("decrypt_credential", { enc_key: "", val: settings.gemini_api_key });
      if (decrypted && typeof decrypted === "string" && decrypted.length > 5) geminiApiKey = decrypted;
    }
    if (settings?.openai_api_key) {
      const { data: decrypted } = await supabase.rpc("decrypt_credential", { enc_key: "", val: settings.openai_api_key });
      if (decrypted && typeof decrypted === "string" && decrypted.length > 5) openaiApiKey = decrypted;
    }

    // Fetch articles
    const { data: articles } = await supabase
      .from("articles")
      .select("id, title, category, featured_image_url, visual_elements, content")
      .eq("user_id", userId)
      .in("id", articleIds);

    if (!articles?.length) throw new Error("Nenhum artigo encontrado.");

    let updated = 0;
    let failed = 0;
    let skipped = 0;
    const details: Array<{ articleId: string; title: string; reason: string; imageUrl?: string }> = [];
    const startTime = Date.now();
    const MAX_DURATION_MS = 120_000;
    const MAX_PER_CALL = 5;

    const isBrokenImageUrl = (url: string | null | undefined): boolean => {
      if (!url) return true;
      return /source\.unsplash\.com|picsum\.photos|images\.pexels\.com/i.test(url);
    };

    let processed = 0;
    for (const article of articles) {
      if (!force && article.featured_image_url && !isBrokenImageUrl(article.featured_image_url)) {
        continue;
      }

      if (Date.now() - startTime > MAX_DURATION_MS || processed >= MAX_PER_CALL) {
        skipped++;
        continue;
      }
      processed++;

      let imageUrl: string | null = null;
      const providerErrors: string[] = [];

      // Geração via Lovable AI Gateway (estilo chat) usando o Prompt de Imagem IA das Configurações.
      try {
        imageUrl = await generateImageLovable(article.title, (article as any).content || null, (article as any).visual_elements || null, imagePrompt, fmt);
      } catch (error) {
        providerErrors.push(`Lovable AI: ${getErrorMessage(error)}`);
      }

      if (!imageUrl) {
        failed++;
        const reason = providerErrors[0]?.substring(0, 200) || "Todos os provedores de IA falharam";
        details.push({ articleId: article.id, title: article.title, reason });
        continue;
      }

      const { error: updateError } = await supabase.from("articles").update({ featured_image_url: imageUrl }).eq("id", article.id);
      if (updateError) {
        failed++;
        details.push({ articleId: article.id, title: article.title, reason: updateError.message });
      } else {
        updated++;
        details.push({ articleId: article.id, title: article.title, reason: "Success", imageUrl: imageUrl });
      }

      await sleep(500);
    }

    const message = updated > 0
      ? `${updated} imagens processadas com sucesso.`
      : "Nenhuma imagem foi gerada. Verifique suas configurações de IA.";

    return new Response(
      JSON.stringify({ 
        success: updated > 0, 
        message, 
        updated, 
        failed, 
        skipped, 
        details: details.slice(0, 5),
        imageUrl: articleIds.length === 1 && details[0]?.imageUrl ? details[0].imageUrl : undefined
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("regenerate-image error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});