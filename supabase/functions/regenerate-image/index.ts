import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const IMAGE_PROMPT_TEMPLATE = (title: string, category: string) =>
  `Create a professional, photorealistic news article featured image about: "${title}" (category: ${category}). Requirements: Editorial/journalistic style, visually represents the article topic, NO text overlay, NO watermarks, NO logos, high quality, 16:9 aspect ratio, vibrant colors, professional lighting, suitable as a WordPress featured image.`;

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

async function generateImageGemini(apiKey: string, title: string, category: string): Promise<string> {
  const models = ["gemini-3.1-flash-image-preview", "gemini-2.5-flash-image"];
  const errors: string[] = [];

  for (const model of models) {
    try {
      return await withRetry(async () => {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
        const resp = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
          body: JSON.stringify({
            contents: [{ parts: [{ text: IMAGE_PROMPT_TEMPLATE(title, category) }] }],
            generationConfig: { responseModalities: ["IMAGE", "TEXT"] },
          }),
        });

        if (!resp.ok) {
          throw createProviderError(`Gemini image ${model}`, resp.status, await readResponseDetails(resp));
        }

        const data = await resp.json();
        const parts = data.candidates?.[0]?.content?.parts || [];
        const imgPart = parts.find((p: any) => p.inlineData?.mimeType?.startsWith("image/"));

        if (!imgPart?.inlineData) {
          throw new ProviderError(`Gemini image ${model} não retornou uma imagem válida.`, 500, false, false);
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

async function generateImageDallE(apiKey: string, title: string, category: string): Promise<string> {
  return await withRetry(async () => {
    const resp = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "dall-e-3",
        prompt: IMAGE_PROMPT_TEMPLATE(title, category),
        n: 1,
        size: "1792x1024",
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


serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const { userId, articleIds, force = false } = body;
    if (!userId || !articleIds?.length) throw new Error("userId and articleIds are required");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Carrega chaves de IA do usuário (Gemini + OpenAI) e fallback Lovable AI
    let geminiApiKey: string | null = null;
    let openaiApiKey: string | null = null;
    const { data: settings } = await supabase
      .from("user_settings")
      .select("gemini_api_key, openai_api_key")
      .eq("user_id", userId)
      .single();

    if (settings?.gemini_api_key) {
      const { data: decrypted } = await supabase.rpc("decrypt_credential", { enc_key: "", val: settings.gemini_api_key });
      if (decrypted && typeof decrypted === "string" && decrypted.length > 5) geminiApiKey = decrypted;
    }
    if (settings?.openai_api_key) {
      const { data: decrypted } = await supabase.rpc("decrypt_credential", { enc_key: "", val: settings.openai_api_key });
      if (decrypted && typeof decrypted === "string" && decrypted.length > 5) openaiApiKey = decrypted;
    }
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY") || null;

    if (!geminiApiKey && !openaiApiKey && !LOVABLE_API_KEY) {
      throw new Error("Nenhum provedor de IA disponível. Configure Gemini ou OpenAI em Configurações.");
    }

    // Fetch articles
    const { data: articles } = await supabase
      .from("articles")
      .select("id, title, category, featured_image_url")
      .eq("user_id", userId)
      .in("id", articleIds);

    if (!articles?.length) throw new Error("Nenhum artigo encontrado.");

    let updated = 0;
    let failed = 0;
    const details: Array<{ articleId: string; title: string; reason: string }> = [];

    // Considera quebrada: source.unsplash.com (descontinuado), picsum (placeholder) ou pexels (legado)
    const isBrokenImageUrl = (url: string | null | undefined): boolean => {
      if (!url) return true;
      return /source\.unsplash\.com|picsum\.photos|images\.pexels\.com/i.test(url);
    };

    for (const article of articles) {
      if (!force && article.featured_image_url && !isBrokenImageUrl(article.featured_image_url)) {
        console.log(`Skipping ${article.id} - already has valid image`);
        continue;
      }

      let imageUrl: string | null = null;
      const providerErrors: string[] = [];

      // Cadeia: Gemini (chave usuário) → OpenAI DALL-E (chave usuário) → Lovable AI Gateway
      if (geminiApiKey) {
        try { imageUrl = await generateImageGemini(geminiApiKey, article.title, article.category); }
        catch (error) { providerErrors.push(`Gemini: ${getErrorMessage(error)}`); }
      }
      if (!imageUrl && openaiApiKey) {
        try { imageUrl = await generateImageDallE(openaiApiKey, article.title, article.category); }
        catch (error) { providerErrors.push(`OpenAI: ${getErrorMessage(error)}`); }
      }
      if (!imageUrl && LOVABLE_API_KEY) {
        try { imageUrl = await generateImageGateway(LOVABLE_API_KEY, article.title, article.category); }
        catch (error) { providerErrors.push(`Lovable AI: ${getErrorMessage(error)}`); }
      }

      if (!imageUrl) {
        failed++;
        const reason = providerErrors[0]?.substring(0, 200) || "Todos os provedores de IA falharam";
        details.push({ articleId: article.id, title: article.title, reason });
        console.error(`All image providers failed for "${article.title}": ${providerErrors.join(" | ").substring(0, 300)}`);
        continue;
      }

      const { error: updateError } = await supabase.from("articles").update({ featured_image_url: imageUrl }).eq("id", article.id);
      if (updateError) {
        failed++;
        details.push({ articleId: article.id, title: article.title, reason: updateError.message });
      } else {
        updated++;
        console.log(`Image set for article: ${article.title}`);
      }

      await sleep(800);
    }

    const message = updated > 0
      ? `${updated} imagens geradas com IA${failed > 0 ? ` (${failed} falharam)` : ""}.`
      : "Nenhuma imagem foi gerada. Verifique suas chaves de IA e cota.";

    return new Response(
      JSON.stringify({ success: updated > 0, message, updated, failed, details: details.slice(0, 3) }),
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
