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
    title: (parsed.title || "").replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim(),
    excerpt: (parsed.excerpt || "").replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim(),
    seo_keyword: (parsed.seo_keyword || "").replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim(),
    seo_title: (parsed.seo_title || "").replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim(),
    meta_description: (parsed.meta_description || "").replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim(),
    slug: (parsed.slug || "").toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, ""),
    image_alt: (parsed.image_alt || "").replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim(),
    image_caption: (parsed.image_caption || "").replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim(),
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
  const model = "gemini-1.5-flash"; // Estável
  let lastError: any = null;

  try {
    // Try v1beta with tools
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    const body = {
      system_instruction: { parts: [{ text: systemPrompt }] },
      contents: [{ role: "user", parts: [{ text: userPrompt }] }],
      tools: [{ function_declarations: [{
        name: "create_article",
        description: "Cria um artigo completo para publicação no WordPress com todos os campos SEO.",
        parameters: {
          type: "OBJECT",
          properties: Object.fromEntries(Object.entries(ARTICLE_TOOL_PARAMS).map(([k, v]) => [k, { type: "STRING", description: v }])),
          required: Object.keys(ARTICLE_TOOL_PARAMS),
        },
      }] }],
      tool_config: { function_calling_config: { mode: "ANY", allowed_function_names: ["create_article"] } },
    };

    const resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (resp.ok) {
      const data = await resp.json();
      const fnCall = data.candidates?.[0]?.content?.parts?.find((p: any) => p.functionCall);
      if (fnCall?.functionCall?.args) return fnCall.functionCall.args as AIResponse;
    } else {
      const errText = await resp.text();
      console.warn(`[AI] Gemini v1beta failed (${resp.status}): ${errText.substring(0, 200)}`);
    }

    // Fallback: Try v1 (JSON mode)
    const v1Url = `https://generativelanguage.googleapis.com/v1/models/${model}:generateContent?key=${apiKey}`;
    const v1Body = {
      contents: [{ 
        role: "user", 
        parts: [{ text: `${systemPrompt}\n\nUSER REQUEST: ${userPrompt}\n\nIMPORTANT: Return ONLY valid JSON matching the article schema.` }] 
      }]
    };
    const v1Resp = await fetch(v1Url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(v1Body),
    });

    if (v1Resp.ok) {
      const v1Data = await v1Resp.json();
      let text = v1Data.candidates?.[0]?.content?.parts?.[0]?.text || "";
      text = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      return JSON.parse(text) as AIResponse;
    }
    const v1Err = await v1Resp.text();
    throw new Error(`Gemini API failed (v1beta & v1). v1 error: ${v1Err}`);
  } catch (err) {
    throw err;
  }
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

async function callAzureOpenAIDirect(apiKey: string, endpoint: string, deployment: string, systemPrompt: string, userPrompt: string): Promise<AIResponse> {
  const url = `${endpoint.replace(/\/$/, "")}/openai/deployments/${deployment}/chat/completions?api-version=2024-02-01`;
  const resp = await fetch(url, {
    method: "POST",
    headers: { "api-key": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({
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
    throw new Error(`Azure OpenAI (Copilot) error ${resp.status}: ${errText}`);
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
      model: "google/gemini-1.5-flash",
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
  // A ordem já é definida na montagem do array 'providers' no handler principal.
  const sortedProviders = providers;

  const errors: string[] = [];
  for (const provider of sortedProviders) {
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
  const models = ["gemini-1.5-flash-latest"];
  for (const model of models) {
    try {
      console.log(`[Image] Attempting generation with Gemini model: ${model}`);
      // Gemini Image Generation logic
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const body = {
        contents: [{ parts: [{ text: buildSafeImagePrompt(title, category) }] }],
      };

      const resp = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!resp.ok) {
        const errText = await resp.text();
        console.warn(`[Image] Gemini model ${model} failed (${resp.status}): ${errText.substring(0, 200)}`);
        continue;
      }
      
      const data = await resp.json();
      // Note: Most Gemini models don't return images directly in this way unless it's a specific multimodal response
      // or using the Imagen API. We keep this for compatibility if the model supports it.
      const imgPart = data.candidates?.[0]?.content?.parts?.find((p: any) => p.inlineData?.mimeType?.startsWith("image/"));
      
      if (imgPart?.inlineData) {
        console.log(`[Image] Success! Image generated with model: ${model}`);
        return `data:${imgPart.inlineData.mimeType};base64,${imgPart.inlineData.data}`;
      }
    } catch (err) { 
      console.error(`[Image] Gemini model ${model} error:`, err); 
    }
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
    console.log(`[Image] Calling DALL-E 3 with prompt: ${prompt.substring(0, 100)}...`);
    const resp = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: { 
        "Authorization": `Bearer ${apiKey}`, 
        "Content-Type": "application/json" 
      },
      body: JSON.stringify({
        model: "dall-e-3",
        prompt: prompt,
        n: 1,
        size: "1024x1024", // Changed from 1792x1024 to standard square for better compatibility/cost
        quality: "standard",
        response_format: "b64_json",
      }),
    });
    
    if (!resp.ok) {
      const errBody = await resp.text().catch(() => "");
      console.error(`[Image] DALL-E API Error ${resp.status}: ${errBody}`);
      return null;
    }
    
    const data = await resp.json();
    const b64 = data.data?.[0]?.b64_json;
    if (b64) {
      return `data:image/png;base64,${b64}`;
    }
    console.warn("[Image] DALL-E returned success but no image data.");
  } catch (err) { 
    console.error("[Image] DALL-E unexpected error:", err); 
  }
  return null;
}


// ── System + User prompts ─────────────────────────────────────────────────

const BASE_SYSTEM_PROMPT = `Você é um jornalista digital brasileiro sênior, especialista em SEO avançado e redação para WordPress com Yoast SEO e Jetpack.

REGRAS CRÍTICAS DE VERACIDADE E FONTES:
1. PROIBIDO FAKE NEWS: Você NUNCA deve inventar fatos, nomes, datas ou acontecimentos. 
2. FONTE ÚNICA: Use APENAS as informações contidas no tópico do Google Trends fornecido. Se o tópico for vago, escreva um artigo informativo contextualizando o tema com fatos históricos reais e conhecidos, mas NUNCA invente notícias recentes que não ocorreram.
3. VERIFICAÇÃO: Se não tiver certeza de um detalhe específico sobre a notícia do momento, foque em informações gerais, oficiais e educativas sobre o assunto.
4. IMAGENS REAIS: O prompt da imagem deve ser focado em representar o tema de forma editorial e jornalística, evitando elementos fantasiosos ou mentirosos.

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
   - E-E-A-T: demonstre expertise, experiência, autoridade e confiabilidade (Expertise, Experience, Authoritativeness, Trustworthiness)

4. ESTILO: Mescle notícia trending com valor evergreen. Tom informativo e autoritativo. Inclua dados relevantes e reais. Evite linguagem de IA (como "no vasto mundo de", "em suma").

5. SEO (Yoast + Jetpack): seo_keyword: cauda longa 3-5 palavras. seo_title: até 60 chars, keyword no início. meta_description: 120-155 chars, keyword na primeira metade, CTA sutil. excerpt: 2 frases (máx 160 chars). slug: keyword em formato URL.

6. IMAGEM: image_alt descritivo com keyword. image_caption legenda informativa baseada em fatos.`;

function buildSystemPrompt(writerPrompt?: string | null): string {
  if (writerPrompt && writerPrompt.trim().length > 10) {
    // O perfil do escritor vem PRIMEIRO e tem prioridade máxima sobre estilo/tom/persona.
    // As regras técnicas de SEO/HTML/veracidade vêm depois e NÃO podem ser violadas,
    // mas TUDO que for relacionado a estilo, voz, persona, público-alvo e abordagem
    // deve seguir FIELMENTE o perfil definido pelo usuário.
    return `### PERFIL DO ESCRITOR (DEFINIDO PELO USUÁRIO — SIGA FIELMENTE) ###
${writerPrompt.trim()}

### FIM DO PERFIL DO ESCRITOR ###

Aplique o perfil acima como sua persona, tom de voz, estilo de escrita e abordagem editorial em TODO o artigo. Esse perfil é a sua identidade obrigatória.

A seguir estão as regras técnicas que complementam (mas NUNCA substituem) o perfil acima:

${BASE_SYSTEM_PROMPT}`;
  }
  return BASE_SYSTEM_PROMPT;
}

function buildUserPrompt(topic: string, category: string, context?: string): string {
  return `TÓPICO PRINCIPAL: "${topic}"
CONTEXTO REAL (NOTÍCIA DO DIA): "${context || "Fatos reais associados ao termo de pesquisa em alta"}"
CATEGORIA: ${category}
DATA: ${new Date().toLocaleDateString("pt-BR")}

INSTRUÇÃO: Escreva um artigo jornalístico de ALTA VERACIDADE. Use o contexto real fornecido para evitar alucinações. Se o contexto for sobre um evento específico, descreva-o com precisão.

REGRAS TÉCNICAS:
- Conteúdo HTML entre 1800-2400 chars.
- Keyword no título, lead (primeiro parágrafo), ao menos um H2 e meta description.
- Use técnicas avançadas de SEO: LSI keywords, otimize para featured snippets.
- Gere todos os metadados SEO e de imagem solicitados.`;
}

const MAX_GENERATION_BATCH = 2;

// ── Main handler ──────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { userId, topics: manualTopics, forceCategory } = await req.json();
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
      if (decrypted && typeof decrypted === "string" && decrypted.length > 5) {
        geminiApiKey = decrypted;
        console.log(`[Pipeline] Gemini API Key loaded (length: ${geminiApiKey.length})`);
      } else {
        console.warn(`[Pipeline] Failed to decrypt Gemini API Key or key is invalid.`);
      }
    }

    let openaiApiKey: string | null = null;
    if (settings?.openai_api_key) {
      const { data: decrypted } = await supabase.rpc("decrypt_credential", { enc_key: "", val: settings.openai_api_key });
      if (decrypted && typeof decrypted === "string" && decrypted.length > 5) {
        openaiApiKey = decrypted;
        console.log(`[Pipeline] OpenAI API Key loaded (length: ${openaiApiKey.length})`);
      }
    }

    let groqApiKey: string | null = null;
    if (settings?.groq_api_key) {
      const { data: decrypted } = await supabase.rpc("decrypt_credential", { enc_key: "", val: settings.groq_api_key });
      if (decrypted && typeof decrypted === "string" && decrypted.length > 5) {
        groqApiKey = decrypted;
        console.log(`[Pipeline] Groq API Key loaded (length: ${groqApiKey.length})`);
      }
    }


    let azureApiKey: string | null = null;
    if (settings?.azure_openai_api_key) {
      const { data: decrypted } = await supabase.rpc("decrypt_credential", { enc_key: "", val: settings.azure_openai_api_key });
      if (decrypted && typeof decrypted === "string" && decrypted.length > 5) azureApiKey = decrypted;
    }

    const providers: ProviderConfig[] = [];
    // Ordem de redundância definida pelo usuário:
    // 1. Gemini (Principal)
    if (geminiApiKey) {
      console.log(`[Pipeline] Adding Gemini provider with key ${geminiApiKey.substring(0, 8)}...`);
      providers.push({ name: "Gemini", call: (s, u) => callGeminiDirect(geminiApiKey!, s, u) });
    }
    
    // 2. OpenAI / ChatGPT (Secundário)
    if (openaiApiKey) providers.push({ name: "OpenAI", call: (s, u) => callOpenAIDirect(openaiApiKey!, s, u) });
    
    // 3. Azure Copilot (Terceiro)
    if (azureApiKey && settings?.azure_openai_endpoint && settings?.azure_openai_deployment_name) {
      providers.push({ 
        name: "Azure Copilot", 
        call: (s, u) => callAzureOpenAIDirect(azureApiKey!, settings.azure_openai_endpoint, settings.azure_openai_deployment_name, s, u) 
      });
    }
    
    // 4. Groq (Demais)
    if (groqApiKey) providers.push({ name: "Groq", call: (s, u) => callGroqDirect(groqApiKey!, s, u) });

    if (providers.length === 0) {
      throw new Error("Nenhuma chave de IA configurada. Configure sua chave Gemini em Configurações.");
    }

    console.log(`[Pipeline] Available AI providers: ${providers.map(p => p.name).join(" → ")}`);

    let topics = [];
    if (manualTopics && Array.isArray(manualTopics) && manualTopics.length > 0) {
      topics = manualTopics.map(t => typeof t === "string" ? { topic: t, category: forceCategory || "geral" } : t);
      console.log(`[Pipeline] Using ${topics.length} manual topics`);
    } else {
      const userCategories: string[] = settings?.categories || ["esportes", "politica", "policia", "saude", "celebridades", "financas"];
      const { data: dbTopics } = await supabase
        .from("trending_topics")
        .select("*")
        .eq("user_id", userId)
        .eq("used", false)
        .in("category", userCategories); // Apenas categorias marcadas pelo usuário
      topics = dbTopics || [];
      console.log(`[Pipeline] Auto-generating from ${topics.length} topics in marked categories: ${userCategories.join(", ")}`);
    }

    const userCategories: string[] = forceCategory 
      ? [forceCategory] 
      : (settings?.categories || ["esportes", "politica", "policia", "saude", "celebridades", "financas"]);

    // Conta artigos criados nas últimas 24h por categoria para priorizar as mais defasadas
    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: recentArticles } = await supabase
      .from("articles")
      .select("category")
      .eq("user_id", userId)
      .gte("created_at", since24h);
    const countsByCategory: Record<string, number> = {};
    for (const cat of userCategories) countsByCategory[cat] = 0;
    for (const a of (recentArticles || [])) {
      if (a.category in countsByCategory) countsByCategory[a.category]++;
    }
    console.log(`[Pipeline] Artigos últimas 24h por categoria:`, countsByCategory);

    // Score de prioridade por volume de busca (quanto maior, mais "em alta")
    const volumeScore = (v: string | null | undefined): number => {
      const s = (v || "").toLowerCase();
      if (s.includes("alto") || s === "high") return 3;
      if (s.includes("médio") || s.includes("medio") || s === "medium") return 2;
      if (s.includes("baixo") || s === "low") return 1;
      if (s.includes("evergreen")) return 0;
      return 1;
    };

    // Agrupa tópicos disponíveis por categoria + ordena cada categoria por volume DESC (alto primeiro)
    const topicsByCategory: Record<string, any[]> = {};
    for (const cat of userCategories) topicsByCategory[cat] = [];
    for (const t of (topics || [])) {
      if (t.category in topicsByCategory) topicsByCategory[t.category].push(t);
    }
    for (const cat of userCategories) {
      topicsByCategory[cat].sort((a, b) => volumeScore(b.search_volume) - volumeScore(a.search_volume));
    }
    // Fallback (default topic) para categorias SEM tópicos disponíveis
    for (const cat of userCategories) {
      if (topicsByCategory[cat].length === 0) {
        topicsByCategory[cat].push({ topic: getDefaultTopic(cat), category: cat, id: null, search_volume: "evergreen" });
      }
    }

    // Score combinado: prioriza categorias com tópicos QUENTES (alta busca),
    // mas penaliza significativamente categorias já saturadas nas últimas 24h para garantir equilíbrio.
    // O multiplicador 10 para 'peak' (volume) mantém a preferência por trends, 
    // mas o multiplicador 4 para 'recent' garante que após 2-3 posts a prioridade mude.
    const categoryPriority = (cat: string): number => {
      const top = topicsByCategory[cat][0];
      const peak = top ? volumeScore(top.search_volume) : 0;
      const recent = countsByCategory[cat] || 0;
      
      // Prioridade: (Peso do Volume x 20) - (Peso da Saturação x 4)
      // O multiplicador 20 garante que tópicos de 'alto' volume (3) sempre superem 
      // tópicos de 'médio' (2) ou 'baixo' (1) mesmo se a categoria tiver 1-2 posts recentes.
      return peak * 20 - recent * 4.0;
    };

    // Round-robin ponderado: a cada rodada reordena por prioridade atual,
    // pegando 1 tópico da categoria mais "quente vs saturada" do momento.
    const topicsToUse: any[] = [];
    while (topicsToUse.length < 50) {
      const available = userCategories.filter((c) => topicsByCategory[c].length > 0);
      if (available.length === 0) break;
      available.sort((a, b) => categoryPriority(b) - categoryPriority(a));
      const cat = available[0];
      const next = topicsByCategory[cat].shift();
      if (!next) break;
      topicsToUse.push(next);
      // simula que a categoria "ganhou" um post para o próximo cálculo
      countsByCategory[cat] = (countsByCategory[cat] || 0) + 1;
    }
    console.log(`[Pipeline] Ordem priorizando ALTA (primeiros 8):`,
      topicsToUse.slice(0, 8).map(t => `${t.category}[${t.search_volume || "?"}]`).join(" → "));

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
    // Se forceCategory estiver presente, geramos todos os tópicos disponíveis dessa categoria (ou o limite máximo do batch)
    const articlesToGenerate = (forceCategory || (manualTopics && manualTopics.length > 0))
      ? Math.min(MAX_GENERATION_BATCH, topicsToUse.length)
      : Math.min(MAX_GENERATION_BATCH, remainingToTarget, topicsToUse.length);

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
        const userPrompt = buildUserPrompt(topic.topic, topic.category, topic.context);

        let parsed: AIResponse;
        let usedProvider: string;

        try {
          const result = await callWithFallback(providers, systemPrompt, userPrompt);
          parsed = sanitizeSeoFields(result.result);
          usedProvider = result.provider;

          // Etapa de Validação: Revisar o texto contra o tópico original (fact-check leve baseado em heurística)
          // Verifica se o título/conteúdo realmente menciona o tópico (evita artigos completamente fora do tema)
          try {
            const topicWords = topic.topic
              .toLowerCase()
              .replace(/[^a-záéíóúâêôãõç0-9\s]/gi, " ")
              .split(/\s+/)
              .filter((w: string) => w.length > 3);
            const haystack = `${parsed.title} ${stripHtml(parsed.content)}`.toLowerCase();
            const matched = topicWords.filter((w: string) => haystack.includes(w)).length;
            const ratio = topicWords.length > 0 ? matched / topicWords.length : 1;
            console.log(`[Validation] Topic "${topic.topic}" word-match ratio: ${(ratio * 100).toFixed(0)}% (${matched}/${topicWords.length})`);
            if (topicWords.length >= 2 && ratio < 0.3) {
              console.warn(`[Validation] Article rejected — does not reference topic enough.`);
              failureReasons.push({ status: 422, message: `Artigo descartado por baixa aderência ao tópico "${topic.topic}".` });
              continue;
            }
          } catch (vErr) {
            console.warn("[Validation] Skipped:", vErr);
          }

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

        // GERAÇÃO DE IMAGEM: ChatGPT (DALL-E 3) como principal, Gemini como fallback
        let featuredImageUrl: string | null = null;
        
        // 1. ChatGPT (DALL-E 3) agora é o principal para imagens
        if (openaiApiKey) {
          try { 
            featuredImageUrl = await generateImageDallE(openaiApiKey, parsed.title, topic.category); 
            if (featuredImageUrl) console.log(`[Image] Success! Image generated with DALL-E 3`);
          } catch (imgErr) { 
            console.warn(`[Image] DALL-E falhou para "${parsed.title}":`, imgErr); 
          }
        }
        
        // 2. Gemini como fallback para imagens
        if (!featuredImageUrl && geminiApiKey) {
          try { 
            featuredImageUrl = await generateImageGemini(geminiApiKey, parsed.title, topic.category); 
          } catch (imgErr) { 
            console.warn(`[Image] Gemini fallback falhou para "${parsed.title}":`, imgErr); 
          }
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
