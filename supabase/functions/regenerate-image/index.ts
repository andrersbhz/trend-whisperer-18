import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// O prompt da imagem é DERIVADO do image_prompt configurado + conteúdo do artigo.
function buildImagePrompt(title: string, content: string | null, visualElements: string | null | undefined, imagePrompt: string | null | undefined): string {
  if (!imagePrompt || imagePrompt.trim().length < 5) {
    throw new Error("O 'Prompt de Imagem IA' não está configurado. Por favor, vá em Configurações e defina o estilo visual obrigatório.");
  }

  const userImageGuidance = `### DIRETRIZES OBRIGATÓRIAS DE ESTILO DO USUÁRIO ###\n${imagePrompt.trim()}\n`;
  const contentSnippet = content ? `\n### CONTEXTO DETALHADO DA HISTÓRIA ###\n${content.replace(/<[^>]*>/g, "").substring(0, 1000)}...` : "";

  return `${userImageGuidance}

### INSTRUÇÕES DE COMPOSIÇÃO ###
1. REFERÊNCIA PRINCIPAL: Use o título do artigo como base absoluta para a cena.
2. IMPACTO VISUAL: A imagem deve ser realista, impactante e cinematográfica, desenhada para maximizar cliques (CTR).
3. TEXTO INTEGRADO: Inclua uma chamada curta e forte na imagem usando gatilhos mentais. Resuma o título se necessário para que o texto seja minimalista, legível e visualmente atraente.
4. REPRESENTAÇÃO FIEL: Retrate fielmente as pessoas, locais ou eventos mencionados no título/contexto.
5. PROPORÇÃO: A imagem deve ser composta para o formato horizontal 5:4 (1350x1080 pixels).

### DADOS DO ARTIGO ###
TÍTULO: ${title}${contentSnippet}
ELEMENTOS SUGERIDOS: ${visualElements || "Cena dramática e realista que resume o impacto da notícia"}.

### REQUISITOS TÉCNICOS ###
Realismo de alta qualidade, 4k, iluminação profissional, proporção horizontal 5:4, sem marcas d'água, pouco texto mas com mensagem poderosa.`;
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

async function generateImageGemini(apiKey: string, title: string, content: string | null, visualElements: string | null, imagePrompt: string | null): Promise<string> {
  // Modelos experimentais que podem suportar geração de imagem
  const models = ["gemini-2.0-flash-exp", "gemini-1.5-flash"];
  const errors: string[] = [];

  for (const model of models) {
    try {
      return await withRetry(async () => {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
        const resp = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
          body: JSON.stringify({
            contents: [{ parts: [{ text: buildImagePrompt(title, content, visualElements, imagePrompt) }] }],
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

async function generateImageDallE(apiKey: string, title: string, content: string | null, visualElements: string | null, imagePrompt: string | null): Promise<string> {
  return await withRetry(async () => {
    const resp = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "dall-e-3",
        prompt: buildImagePrompt(title, content, visualElements, imagePrompt),
        n: 1,
        size: "1024x1024", // DALL-E 3 doesn't support 5:4 exactly, sticking to high quality 1:1 or 1792x1024 for landscape
        quality: "standard",
        response_format: "b64_json",
      }),
    });

    if (!resp.ok) {
      throw createProviderError("OpenAI DALL-E", resp.status, await readResponseDetails(resp));
    }

    const data = await resp.json();
    const b64 = data.data?.[0]?.b64_json;
    if (!b64) {
      throw new ProviderError("OpenAI DALL-E não retornou uma imagem válida.", 500, false, false);
    }

    return `data:image/png;base64,${b64}`;
  }, 1, 2000);
}

// Fallback gratuito e resiliente usando Pollinations.ai
async function generateImagePollinations(title: string, content: string | null, visualElements: string | null, imagePrompt: string | null): Promise<string> {
  const prompt = buildImagePrompt(title, content, visualElements, imagePrompt);
  const encodedPrompt = encodeURIComponent(prompt);
  const seed = Math.floor(Math.random() * 1000000);
  const url = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=1350&height=1080&nologo=true&seed=${seed}`;
  
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
      .select("gemini_api_key, openai_api_key, writer_prompt, image_mode, image_prompt")
      .eq("user_id", userId)
      .single();
    
    // Prioritize user-configured image_prompt, fallback to writer_prompt if missing, or use default
    const imagePrompt: string = settings?.image_prompt?.trim() || settings?.writer_prompt?.trim() || "Fotografia realista de alta qualidade";
    const imageMode = settings?.image_mode || "ai";

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

      // Cadeia: Gemini (se configurado) -> OpenAI (se configurado) -> Pollinations (fallback garantido)
      if (geminiApiKey) {
        try { imageUrl = await generateImageGemini(geminiApiKey, article.title, (article as any).content || null, (article as any).visual_elements || null, imagePrompt); }
        catch (error) { providerErrors.push(`Gemini: ${getErrorMessage(error)}`); }
      }
      
      if (!imageUrl && openaiApiKey) {
        try { imageUrl = await generateImageDallE(openaiApiKey, article.title, (article as any).content || null, (article as any).visual_elements || null, imagePrompt); }
        catch (error) { providerErrors.push(`OpenAI: ${getErrorMessage(error)}`); }
      }

      // Fallback final: Pollinations (sempre funciona se houver internet)
      if (!imageUrl) {
        try {
          imageUrl = await generateImagePollinations(article.title, (article as any).content || null, (article as any).visual_elements || null, imagePrompt);
          console.log(`Fallback Pollinations used for "${article.title}"`);
        } catch (error) {
          providerErrors.push(`Pollinations: ${getErrorMessage(error)}`);
        }
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