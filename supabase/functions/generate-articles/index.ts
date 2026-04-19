import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ── Helpers ───────────────────────────────────────────────────────────────

function stripHtml(text: string): string {
  return text.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
}

function sanitizeSeoFields(parsed: AIResponse): AIResponse {
  return {
    ...parsed,
    title: stripHtml(parsed.title),
    excerpt: stripHtml(parsed.excerpt),
    seo_keyword: stripHtml(parsed.seo_keyword),
    seo_title: stripHtml(parsed.seo_title),
    meta_description: stripHtml(parsed.meta_description),
    slug: parsed.slug,
    image_alt: stripHtml(parsed.image_alt),
    image_caption: stripHtml(parsed.image_caption),
  };
}

// ── Retry helper ─────────────────────────────────────────────────────────

function isTransientError(msg: string): boolean {
  return /429|503|504|RESOURCE_EXHAUSTED|UNAVAILABLE|high demand|temporarily|timeout/i.test(msg);
}

function isBillingError(msg: string): boolean {
  return /402|payment_required|Not enough credits|spending cap|RESOURCE_EXHAUSTED/i.test(msg);
}

async function withRetry<T>(fn: () => Promise<T>, maxRetries = 2, baseDelayMs = 5000): Promise<T> {
  let lastErr: Error | null = null;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err: any) {
      lastErr = err instanceof Error ? err : new Error(String(err));
      const msg = lastErr.message;
      if (attempt < maxRetries && isTransientError(msg) && !isBillingError(msg)) {
        const delay = baseDelayMs * (attempt + 1);
        console.log(`[Retry] Attempt ${attempt + 1} failed (transient), retrying in ${delay}ms...`);
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }
      throw lastErr;
    }
  }
  throw lastErr;
}

// ── AI provider abstraction ──────────────────────────────────────────────

interface AIResponse { title: string; content: string; excerpt: string; seo_keyword: string; seo_title: string; meta_description: string; slug: string; image_alt: string; image_caption: string; }

const ARTICLE_TOOL_PARAMS = {
  title: "Título H1 do artigo, máximo 60 caracteres",
  content: "Conteúdo HTML completo (1800-2400 chars)",
  excerpt: "Resumo para redes sociais (máx 160 chars)",
  seo_keyword: "Focus keyword do Yoast SEO (3-5 palavras)",
  seo_title: "Título SEO até 60 chars",
  meta_description: "Meta descrição 120-155 chars",
  slug: "Slug para URL",
  image_alt: "Texto alternativo da imagem",
  image_caption: "Legenda da imagem",
};

async function callGeminiDirect(apiKey: string, systemPrompt: string, userPrompt: string): Promise<AIResponse> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

  const functionDeclaration = {
    name: "create_article",
    description: "Cria um artigo completo para publicação no WordPress com todos os campos SEO.",
    parameters: {
      type: "OBJECT",
      properties: Object.fromEntries(Object.entries(ARTICLE_TOOL_PARAMS).map(([k, v]) => [k, { type: "STRING", description: v }])),
      required: Object.keys(ARTICLE_TOOL_PARAMS),
    },
  };

  const resp = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: systemPrompt }] },
      contents: [{ role: "user", parts: [{ text: userPrompt }] }],
      tools: [{ function_declarations: [functionDeclaration] }],
      tool_config: { function_calling_config: { mode: "ANY", allowed_function_names: ["create_article"] } },
    }),
  });

  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`Gemini API error ${resp.status}: ${errText}`);
  }

  const data = await resp.json();
  const fnCall = data.candidates?.[0]?.content?.parts?.find((p: any) => p.functionCall);
  if (!fnCall?.functionCall?.args) throw new Error("Gemini did not return function call");
  return fnCall.functionCall.args as AIResponse;
}

async function callOpenAIDirect(apiKey: string, systemPrompt: string, userPrompt: string): Promise<AIResponse> {
  const resp = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }],
      tools: [{
        type: "function",
        function: {
          name: "create_article",
          description: "Cria um artigo completo para publicação no WordPress.",
          parameters: {
            type: "object",
            properties: Object.fromEntries(Object.entries(ARTICLE_TOOL_PARAMS).map(([k, v]) => [k, { type: "string", description: v }])),
            required: Object.keys(ARTICLE_TOOL_PARAMS),
            additionalProperties: false,
          },
        },
      }],
      tool_choice: { type: "function", function: { name: "create_article" } },
    }),
  });

  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`OpenAI API error ${resp.status}: ${errText}`);
  }

  const aiData = await resp.json();
  const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
  if (toolCall?.function?.arguments) return JSON.parse(toolCall.function.arguments);
  let content = aiData.choices?.[0]?.message?.content || "";
  content = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
  return JSON.parse(content);
}

async function callGroqDirect(apiKey: string, systemPrompt: string, userPrompt: string): Promise<AIResponse> {
  const resp = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }],
      tools: [{
        type: "function",
        function: {
          name: "create_article",
          description: "Cria um artigo completo para publicação no WordPress.",
          parameters: {
            type: "object",
            properties: Object.fromEntries(Object.entries(ARTICLE_TOOL_PARAMS).map(([k, v]) => [k, { type: "string", description: v }])),
            required: Object.keys(ARTICLE_TOOL_PARAMS),
            additionalProperties: false,
          },
        },
      }],
      tool_choice: { type: "function", function: { name: "create_article" } },
    }),
  });

  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`Groq API error ${resp.status}: ${errText}`);
  }

  const aiData = await resp.json();
  const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
  if (toolCall?.function?.arguments) return JSON.parse(toolCall.function.arguments);
  let content = aiData.choices?.[0]?.message?.content || "";
  content = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
  return JSON.parse(content);
}

async function callLovableGateway(apiKey: string, systemPrompt: string, userPrompt: string): Promise<AIResponse> {
  const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-3-flash-preview",
      messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }],
      tools: [{
        type: "function",
        function: {
          name: "create_article",
          description: "Cria um artigo completo para publicação no WordPress.",
          parameters: {
            type: "object",
            properties: Object.fromEntries(Object.entries(ARTICLE_TOOL_PARAMS).map(([k, v]) => [k, { type: "string", description: v }])),
            required: Object.keys(ARTICLE_TOOL_PARAMS),
            additionalProperties: false,
          },
        },
      }],
      tool_choice: { type: "function", function: { name: "create_article" } },
    }),
  });

  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`Gateway error ${resp.status}: ${errText}`);
  }

  const aiData = await resp.json();
  const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
  if (toolCall?.function?.arguments) return JSON.parse(toolCall.function.arguments);
  let content = aiData.choices?.[0]?.message?.content || "";
  content = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
  return JSON.parse(content);
}

// ── Multi-provider fallback for text ─────────────────────────────────────

interface ProviderConfig {
  name: string;
  call: (systemPrompt: string, userPrompt: string) => Promise<AIResponse>;
}

async function callWithFallback(providers: ProviderConfig[], systemPrompt: string, userPrompt: string): Promise<{ result: AIResponse; provider: string }> {
  const errors: string[] = [];
  for (const provider of providers) {
    try {
      console.log(`[AI] Trying provider: ${provider.name}`);
      const result = await withRetry(() => provider.call(systemPrompt, userPrompt), 1, 3000);
      return { result, provider: provider.name };
    } catch (err: any) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[AI] Provider ${provider.name} failed: ${msg.substring(0, 200)}`);
      errors.push(`${provider.name}: ${msg}`);
    }
  }
  throw new Error(`Todos os provedores de IA falharam:\n${errors.join("\n")}`);
}

// ── Image generation (Gemini exclusivo) ─────────────────────────────────

const IMAGE_PROMPT_TEMPLATE = (title: string, category: string) =>
  `Create a professional, photorealistic news article featured image about: "${title}" (category: ${category}). Requirements: Editorial/journalistic style, visually represents the article topic, NO text overlay, NO watermarks, NO logos, high quality, 16:9 aspect ratio, vibrant colors, professional lighting, suitable as a WordPress featured image.`;

async function generateImageGemini(apiKey: string, title: string, category: string): Promise<string | null> {
  const models = ["gemini-3.1-flash-image-preview", "gemini-2.5-flash-image"];
  for (const model of models) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
      const resp = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
        body: JSON.stringify({
          contents: [{ parts: [{ text: IMAGE_PROMPT_TEMPLATE(title, category) }] }],
          generationConfig: { responseModalities: ["IMAGE", "TEXT"] },
        }),
      });
      if (!resp.ok) { console.warn(`Image model ${model} failed ${resp.status}`); continue; }
      const data = await resp.json();
      const imgPart = data.candidates?.[0]?.content?.parts?.find((p: any) => p.inlineData?.mimeType?.startsWith("image/"));
      if (imgPart?.inlineData) {
        console.log(`Image generated with model: ${model}`);
        return `data:${imgPart.inlineData.mimeType};base64,${imgPart.inlineData.data}`;
      }
    } catch (err) { console.warn(`Image model ${model} error:`, err); }
  }
  return null;
}

const SENSITIVE_TERMS = /\b(pf|polícia|policia|prende|prisão|prisao|preso|presa|fraude|lavagem|crime|criminoso|assassin|morte|morto|morta|tiro|tiroteio|drog|tráfico|trafico|narco|estupro|abuso|violência|violencia|terror|atentado|guerra|conflito|tse|stf|impeachment|julga|condena|investigação|investigacao|operação|operacao|megaoperação|megaoperacao|cpi|escândalo|escandalo|denúncia|denuncia|corrupção|corrupcao|propina|suborno)\b/i;

const SAFE_CATEGORY_PROMPT: Record<string, string> = {
  esportes: "A vibrant sports stadium scene with dramatic lighting, cheering crowd silhouettes, no players visible, professional editorial photography style.",
  politica: "A modern government building exterior with national flags waving, golden hour lighting, wide architectural shot, editorial photography style.",
  policia: "A modern city street at dusk with blurred lights and a sense of urgency, abstract editorial style, no people or vehicles visible.",
  saude: "A bright modern hospital corridor with soft natural light, clean medical aesthetic, no people, professional editorial photography.",
  celebridades: "A red carpet event scene with bright spotlights, golden glamour aesthetic, no faces visible, editorial fashion photography style.",
  financas: "A modern financial district skyline with glass skyscrapers and stock market screens glowing, golden hour, editorial business photography.",
  tecnologia: "A futuristic tech workspace with glowing screens and abstract digital elements, modern editorial style, cinematic lighting.",
  entretenimento: "A vibrant concert or theater stage with dramatic stage lights and bokeh effects, editorial entertainment photography.",
};

function buildSafeImagePrompt(title: string, category: string): string {
  if (SENSITIVE_TERMS.test(title)) {
    const safe = SAFE_CATEGORY_PROMPT[category] || SAFE_CATEGORY_PROMPT.politica;
    return `Create a professional, photorealistic news article featured image. Scene: ${safe} Requirements: Editorial/journalistic style, NO text overlay, NO watermarks, NO logos, NO recognizable people, high quality, 16:9 aspect ratio, vibrant colors, professional lighting, suitable as a WordPress featured image.`;
  }
  return IMAGE_PROMPT_TEMPLATE(title, category);
}

async function generateImageDallE(apiKey: string, title: string, category: string): Promise<string | null> {
  const prompt = buildSafeImagePrompt(title, category);
  try {
    const resp = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "dall-e-3",
        prompt,
        n: 1,
        size: "1792x1024",
        quality: "standard",
        response_format: "b64_json",
      }),
    });
    if (!resp.ok) {
      const errBody = await resp.text().catch(() => "");
      const isPolicy = /content_policy|safety|moderation/i.test(errBody);
      console.warn(`DALL-E failed ${resp.status}${isPolicy ? " (content policy)" : ""}: ${errBody.substring(0, 200)}`);
      return null;
    }
    const data = await resp.json();
    const b64 = data.data?.[0]?.b64_json;
    if (b64) {
      console.log("Image generated with DALL-E 3");
      return `data:image/png;base64,${b64}`;
    }
  } catch (err) { console.warn("DALL-E error:", err); }
  return null;
}


// ── System + User prompts ─────────────────────────────────────────────────

const BASE_SYSTEM_PROMPT = `Você é um jornalista digital brasileiro sênior, especialista em SEO avançado e redação para WordPress com Yoast SEO e Jetpack.

REGRAS OBRIGATÓRIAS PARA CADA ARTIGO:

1. TÍTULO (H1): Máximo 60 caracteres, DEVE conter a palavra-chave principal, atrativo e clicável.

2. CONTEÚDO EM HTML: MÍNIMO 1800 e MÁXIMO 2400 caracteres no HTML total. Lead jornalístico com keyword nas primeiras 100 palavras. Use <h2>/<h3> com <strong>. NUNCA use <h1>. Parágrafos curtos (<p>). <strong> para keywords. <ul>/<li> para escaneabilidade. Keyword no primeiro parágrafo, em 1+ H2, densidade 1-2%. Conclusão com CTA.

3. SEO AVANÇADO:
   - Use LSI keywords (Latent Semantic Indexing) naturalmente no texto
   - Otimize para Featured Snippets: inclua parágrafos de definição curtos (40-60 palavras)
   - Inclua perguntas (People Also Ask) como subtítulos H2/H3
   - Use schema-friendly structure para FAQ e HowTo snippets
   - Internal linking friendly: mencione termos relacionados que podem linkar para outros artigos
   - Use keyword de cauda longa (long-tail) como foco principal
   - E-E-A-T: demonstre expertise, experiência, autoridade e confiabilidade

4. ESTILO: Mescle notícia trending com valor evergreen. Tom informativo e autoritativo. Inclua dados relevantes. Evite linguagem de IA.

5. SEO (Yoast + Jetpack): seo_keyword: cauda longa 3-5 palavras. seo_title: até 60 chars, keyword no início. meta_description: 120-155 chars, keyword na primeira metade, CTA sutil. excerpt: 2 frases (máx 160 chars). slug: keyword em formato URL.

6. IMAGEM: image_alt descritivo com keyword. image_caption legenda informativa.`;

function buildSystemPrompt(writerPrompt?: string | null): string {
  if (writerPrompt && writerPrompt.trim().length > 10) {
    return `${BASE_SYSTEM_PROMPT}\n\nPERFIL DO ESCRITOR (instruções adicionais do usuário):\n${writerPrompt.trim()}`;
  }
  return BASE_SYSTEM_PROMPT;
}

function buildUserPrompt(topic: string, category: string): string {
  return `Escreva um artigo jornalístico completo sobre: "${topic}" (categoria: ${category}).
Data de hoje: ${new Date().toLocaleDateString("pt-BR")}.

IMPORTANTE: Conteúdo HTML entre 1800-2400 chars. Keyword no título, primeiro parágrafo, 1+ H2, meta description. Todos os campos SEO preenchidos. Subtítulos em negrito. Gere metadados para imagem de destaque. Use técnicas avançadas de SEO: LSI keywords, otimize para featured snippets, inclua perguntas frequentes como subtítulos, keyword de cauda longa.`;
}

const MAX_GENERATION_BATCH = 2;

// ── Main handler ──────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { userId } = await req.json();
    if (!userId) throw new Error("userId is required");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: settings } = await supabase.from("user_settings").select("*").eq("user_id", userId).single();
    const writerPrompt = settings?.writer_prompt || null;
    const systemPrompt = buildSystemPrompt(writerPrompt);

    let geminiApiKey: string | null = null;
    if (settings?.gemini_api_key) {
      const { data: decrypted } = await supabase.rpc("decrypt_credential", { enc_key: "", val: settings.gemini_api_key });
      if (decrypted && typeof decrypted === "string" && decrypted.length > 5) geminiApiKey = decrypted;
    }

    let openaiApiKey: string | null = null;
    if (settings?.openai_api_key) {
      const { data: decrypted } = await supabase.rpc("decrypt_credential", { enc_key: "", val: settings.openai_api_key });
      if (decrypted && typeof decrypted === "string" && decrypted.length > 5) openaiApiKey = decrypted;
    }

    let groqApiKey: string | null = null;
    if (settings?.groq_api_key) {
      const { data: decrypted } = await supabase.rpc("decrypt_credential", { enc_key: "", val: settings.groq_api_key });
      if (decrypted && typeof decrypted === "string" && decrypted.length > 5) groqApiKey = decrypted;
    }


    const providers: ProviderConfig[] = [];
    // Ordem (preferência do usuário): Gemini PRIMEIRO → OpenAI → Groq. Lovable AI DESABILITADO para geração de artigos.
    if (geminiApiKey) providers.push({ name: "Gemini", call: (s, u) => callGeminiDirect(geminiApiKey!, s, u) });
    if (openaiApiKey) providers.push({ name: "OpenAI", call: (s, u) => callOpenAIDirect(openaiApiKey!, s, u) });
    if (groqApiKey) providers.push({ name: "Groq", call: (s, u) => callGroqDirect(groqApiKey!, s, u) });

    if (providers.length === 0) {
      throw new Error("Nenhuma chave de IA configurada. Configure sua chave Gemini em Configurações.");
    }

    console.log(`[Pipeline] Available AI providers: ${providers.map(p => p.name).join(" → ")}`);

    const { data: topics } = await supabase.from("trending_topics").select("*").eq("user_id", userId).eq("used", false).limit(10);
    const userCategories = settings?.categories || ["esportes", "politica", "policia", "saude", "celebridades", "financas"];
    const topicsToUse = topics && topics.length > 0
      ? topics
      : userCategories.map((cat: string) => ({ topic: getDefaultTopic(cat), category: cat, id: null }));

    const articlesPerDay = Math.max(settings?.articles_per_day || 10, 1);
    const intervalMs = (24 / articlesPerDay) * 60 * 60 * 1000;
    const now = new Date();
    const generatedArticles: any[] = [];
    const failureReasons: Array<{ status: number; message: string }> = [];
    let allProvidersExhausted = false;
    let rescheduledCount = 0;

    const { data: pendingArticles } = await supabase
      .from("articles")
      .select("id, scheduled_at, created_at, status")
      .eq("user_id", userId)
      .neq("status", "published")
      .neq("status", "ready")
      .not("scheduled_at", "is", null)
      .order("scheduled_at", { ascending: true })
      .order("created_at", { ascending: true });

    const pendingQueue = (pendingArticles || []) as Array<{ id: string; scheduled_at: string | null; created_at: string; status: string }>;
    const overdueArticles = pendingQueue.filter((article) => article.scheduled_at && new Date(article.scheduled_at).getTime() < now.getTime());
    const futureArticles = pendingQueue.filter((article) => article.scheduled_at && new Date(article.scheduled_at).getTime() >= now.getTime());

    let queueCursor = futureArticles.length > 0
      ? new Date(futureArticles[futureArticles.length - 1].scheduled_at as string)
      : new Date(now);

    for (const overdueArticle of overdueArticles) {
      queueCursor = new Date(Math.max(queueCursor.getTime(), now.getTime()) + intervalMs);
      const nextIso = queueCursor.toISOString();
      const { error: rescheduleError } = await supabase
        .from("articles")
        .update({ scheduled_at: nextIso })
        .eq("id", overdueArticle.id);
      if (!rescheduleError) {
        overdueArticle.scheduled_at = nextIso;
        rescheduledCount++;
      }
    }

    // Count "ready" articles too — they shouldn't be rescheduled but DO count toward the daily quota
    const { count: readyCount } = await supabase
      .from("articles")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("status", "ready")
      .not("scheduled_at", "is", null);

    const currentPendingCount = pendingQueue.length + (readyCount || 0);
    const remainingToTarget = Math.max(0, articlesPerDay - currentPendingCount);
    const articlesToGenerate = Math.min(MAX_GENERATION_BATCH, remainingToTarget, topicsToUse.length);

    if (articlesToGenerate === 0) {
      const queueSize = Math.min(currentPendingCount, articlesPerDay);
      return new Response(
        JSON.stringify({
          success: true,
          message: rescheduledCount > 0
            ? `Fila reorganizada: ${rescheduledCount} agendamentos vencidos foram realocados. Fila atual ${queueSize}/${articlesPerDay}.`
            : `Fila já está completa com ${queueSize}/${articlesPerDay} artigos agendados.`,
          articles: 0,
          failed: 0,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const baseScheduledTime = queueCursor.getTime();

    for (let i = 0; i < articlesToGenerate; i++) {
      if (allProvidersExhausted) break;

      const topic = topicsToUse[i];
      const scheduledAt = new Date(baseScheduledTime + (i + 1) * intervalMs);

      try {
        const userPrompt = buildUserPrompt(topic.topic, topic.category);

        let parsed: AIResponse;
        let usedProvider: string;

        try {
          const result = await callWithFallback(providers, systemPrompt, userPrompt);
          parsed = sanitizeSeoFields(result.result);
          usedProvider = result.provider;
        } catch (err: any) {
          const msg = err instanceof Error ? err.message : String(err);
          console.error(`All providers failed for topic ${topic.topic}:`, msg.substring(0, 300));
          if (isBillingError(msg)) {
            allProvidersExhausted = true;
            failureReasons.push({ status: 402, message: msg });
            break;
          }
          failureReasons.push({ status: 500, message: msg });
          continue;
        }

        if (!parsed.title || !parsed.content) {
          failureReasons.push({ status: 500, message: `Campos obrigatórios ausentes para: ${topic.topic}` });
          continue;
        }

        // GERAÇÃO DE IMAGEM: cadeia Gemini → OpenAI DALL-E → Lovable AI Gateway
        let featuredImageUrl: string | null = null;
        if (geminiApiKey) {
          try { featuredImageUrl = await generateImageGemini(geminiApiKey, parsed.title, topic.category); }
          catch (imgErr) { console.warn(`[Image] Gemini falhou para "${parsed.title}":`, imgErr); }
        }
        if (!featuredImageUrl && openaiApiKey) {
          try { featuredImageUrl = await generateImageDallE(openaiApiKey, parsed.title, topic.category); }
          catch (imgErr) { console.warn(`[Image] DALL-E falhou para "${parsed.title}":`, imgErr); }
        }
        if (!featuredImageUrl) {
          console.warn(`[Image] Nenhum provedor gerou imagem para "${parsed.title}" — artigo criado sem imagem`);
        }

        const { data: article, error: insertError } = await supabase.from("articles").insert({
          user_id: userId,
          title: parsed.title,
          content: parsed.content,
          excerpt: parsed.excerpt || "",
          category: topic.category,
          seo_keyword: parsed.seo_keyword || "",
          seo_title: parsed.seo_title || parsed.title,
          meta_description: parsed.meta_description || "",
          featured_image_url: featuredImageUrl,
          status: settings?.auto_publish ? "ready" : "draft",
          scheduled_at: scheduledAt.toISOString(),
          trending_topic: topic.topic,
          ai_provider: usedProvider,
        }).select().single();

        if (insertError) {
          failureReasons.push({ status: 500, message: insertError.message });
          continue;
        }

        if (topic.id) {
          await supabase.from("trending_topics").update({ used: true }).eq("id", topic.id);
        }

        generatedArticles.push(article);
        console.log(`[Pipeline] Article ${i + 1} generated via ${usedProvider}: ${parsed.title}`);
        await new Promise((resolve) => setTimeout(resolve, 500));
      } catch (err) {
        console.error(`Error generating article for ${topic.topic}:`, err);
        failureReasons.push({ status: 500, message: err instanceof Error ? err.message : String(err) });
      }
    }

    const totalAttempted = articlesToGenerate;

    if (generatedArticles.length === 0) {
      const errorMessage = allProvidersExhausted
        ? "Nenhum artigo gerado: Gemini/OpenAI/Groq estão sem quota. Adicione créditos no Gemini (AI Studio) ou aguarde a renovação diária do Groq."
        : failureReasons[0]?.message || "Nenhum artigo pôde ser gerado.";

      // Sempre retorna 200 com fallback:true para evitar que o cliente trate como erro fatal (tela em branco).
      return new Response(
        JSON.stringify({
          success: false,
          fallback: true,
          message: errorMessage,
          warning: errorMessage,
          articles: 0,
          failed: failureReasons.length,
          providersExhausted: allProvidersExhausted,
          details: failureReasons.slice(0, 3),
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const queueAfterRun = currentPendingCount + generatedArticles.length;
    const message = failureReasons.length > 0
      ? `${generatedArticles.length} de ${totalAttempted} artigos gerados nesta execução (${failureReasons.length} falharam). Fila atual ${queueAfterRun}/${articlesPerDay}.${rescheduledCount > 0 ? ` ${rescheduledCount} vencidos foram reagendados.` : ""}`
      : `${generatedArticles.length} artigos gerados nesta execução. Fila atual ${queueAfterRun}/${articlesPerDay}.${rescheduledCount > 0 ? ` ${rescheduledCount} vencidos foram reagendados.` : ""}`;

    return new Response(
      JSON.stringify({ success: true, message, articles: generatedArticles.length, failed: failureReasons.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("generate-articles error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function getDefaultTopic(category: string): string {
  const defaults: Record<string, string> = {
    esportes: "Últimas notícias do futebol brasileiro",
    politica: "Cenário político atual no Brasil",
    policia: "Segurança pública no Brasil",
    saude: "Dicas de saúde e bem-estar",
    celebridades: "Novidades do mundo das celebridades brasileiras",
    financas: "Economia e mercado financeiro no Brasil",
  };
  return defaults[category] || "Notícias do Brasil";
}
