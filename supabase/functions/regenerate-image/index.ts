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

  throw new ProviderError(errors.join(" | "), 500, false, errors.some((message) => isBillingIssue(0, message)));
}

async function generateImageGateway(lovableApiKey: string, title: string, category: string): Promise<string> {
  const models = ["google/gemini-3.1-flash-image-preview", "google/gemini-2.5-flash-image"];
  const errors: string[] = [];

  for (const model of models) {
    try {
      return await withRetry(async () => {
        const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: { Authorization: `Bearer ${lovableApiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model,
            messages: [{ role: "user", content: IMAGE_PROMPT_TEMPLATE(title, category) }],
            modalities: ["image", "text"],
          }),
        });

        if (!resp.ok) {
          throw createProviderError(`Lovable AI image ${model}`, resp.status, await readResponseDetails(resp));
        }

        const data = await resp.json();
        const imageUrl = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;

        if (!imageUrl) {
          throw new ProviderError(`Lovable AI image ${model} não retornou uma imagem válida.`, 500, false, false);
        }

        return imageUrl;
      }, 1, 2000);
    } catch (error) {
      const message = getErrorMessage(error);
      console.warn(message);
      errors.push(message);
    }
  }

  throw new ProviderError(errors.join(" | "), 500, false, errors.some((message) => isBillingIssue(0, message)));
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { userId, articleIds } = await req.json();
    if (!userId || !articleIds?.length) throw new Error("userId and articleIds are required");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get Gemini key
    const { data: settings } = await supabase.from("user_settings").select("gemini_api_key").eq("user_id", userId).single();
    let geminiApiKey: string | null = null;
    if (settings?.gemini_api_key) {
      const { data: decrypted } = await supabase.rpc("decrypt_credential", { enc_key: "", val: settings.gemini_api_key });
      if (decrypted && typeof decrypted === "string" && decrypted.length > 5) geminiApiKey = decrypted;
    }
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!geminiApiKey && !LOVABLE_API_KEY) throw new Error("Nenhuma chave de IA configurada.");

    // Fetch articles without images
    const { data: articles } = await supabase
      .from("articles")
      .select("id, title, category, featured_image_url")
      .eq("user_id", userId)
      .in("id", articleIds);

    if (!articles?.length) throw new Error("Nenhum artigo encontrado.");

    let updated = 0;
    let failed = 0;
    let quotaFailures = 0;
    const details: Array<{ articleId: string; title: string; reason: string }> = [];

    for (const article of articles) {
      if (article.featured_image_url) { console.log(`Skipping ${article.id} - already has image`); continue; }

      let imageUrl: string | null = null;
      const providerErrors: string[] = [];

      if (geminiApiKey) {
        try {
          imageUrl = await generateImageGemini(geminiApiKey, article.title, article.category);
        } catch (error) {
          const message = getErrorMessage(error);
          providerErrors.push(message);
          if (isBillingIssue(0, message)) quotaFailures += 1;
        }
      }

      if (!imageUrl && LOVABLE_API_KEY) {
        try {
          imageUrl = await generateImageGateway(LOVABLE_API_KEY, article.title, article.category);
        } catch (error) {
          const message = getErrorMessage(error);
          providerErrors.push(message);
          if (isBillingIssue(0, message)) quotaFailures += 1;
        }
      }

      if (imageUrl) {
        await supabase.from("articles").update({ featured_image_url: imageUrl }).eq("id", article.id);
        updated++;
        console.log(`Image generated for article: ${article.title}`);
      } else {
        failed++;
        const reason = providerErrors[0] || "Nenhum provedor retornou imagem.";
        details.push({ articleId: article.id, title: article.title, reason });
        console.warn(`Failed to generate image for: ${article.title} | ${reason}`);
      }

      await sleep(1200);
    }

    const success = updated > 0;
    const message = success
      ? failed > 0
        ? `${updated} imagens geradas. ${failed} falharam por limite de cota ou indisponibilidade temporária.`
        : `${updated} imagens geradas com sucesso!`
      : quotaFailures > 0
        ? "Nenhuma imagem foi gerada: a Gemini atingiu limite/cota e o fallback também falhou ou está sem créditos. Verifique sua cota e tente novamente em alguns minutos."
        : "Nenhuma imagem foi gerada agora por indisponibilidade temporária dos provedores. Tente novamente em alguns minutos.";

    return new Response(
      JSON.stringify({ success, message, updated, failed, details: details.slice(0, 3) }),
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
