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
    // content keeps HTML intentionally
  };
}

// ── AI provider abstraction ──────────────────────────────────────────────

interface AIResponse { title: string; content: string; excerpt: string; seo_keyword: string; seo_title: string; meta_description: string; slug: string; image_alt: string; image_caption: string; }

async function callGeminiDirect(apiKey: string, systemPrompt: string, userPrompt: string): Promise<AIResponse> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

  const functionDeclaration = {
    name: "create_article",
    description: "Cria um artigo completo para publicação no WordPress com todos os campos SEO.",
    parameters: {
      type: "OBJECT",
      properties: {
        title: { type: "STRING", description: "Título H1 do artigo, máximo 60 caracteres" },
        content: { type: "STRING", description: "Conteúdo HTML completo (1800-2400 chars)" },
        excerpt: { type: "STRING", description: "Resumo para redes sociais (máx 160 chars)" },
        seo_keyword: { type: "STRING", description: "Focus keyword do Yoast SEO (3-5 palavras)" },
        seo_title: { type: "STRING", description: "Título SEO até 60 chars" },
        meta_description: { type: "STRING", description: "Meta descrição 120-155 chars" },
        slug: { type: "STRING", description: "Slug para URL" },
        image_alt: { type: "STRING", description: "Texto alternativo da imagem" },
        image_caption: { type: "STRING", description: "Legenda da imagem" },
      },
      required: ["title", "content", "excerpt", "seo_keyword", "seo_title", "meta_description", "slug", "image_alt", "image_caption"],
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

async function callLovableGateway(apiKey: string, systemPrompt: string, userPrompt: string): Promise<AIResponse> {
  const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "openai/gpt-5-mini",
      messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }],
      tools: [{
        type: "function",
        function: {
          name: "create_article",
          description: "Cria um artigo completo para publicação no WordPress.",
          parameters: {
            type: "object",
            properties: {
              title: { type: "string" }, content: { type: "string" }, excerpt: { type: "string" },
              seo_keyword: { type: "string" }, seo_title: { type: "string" }, meta_description: { type: "string" },
              slug: { type: "string" }, image_alt: { type: "string" }, image_caption: { type: "string" },
            },
            required: ["title", "content", "excerpt", "seo_keyword", "seo_title", "meta_description", "slug", "image_alt", "image_caption"],
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
      if (!resp.ok) {
        const errBody = await resp.text().catch(() => "");
        console.warn(`Gemini image model ${model} failed ${resp.status}: ${errBody.substring(0, 200)}`);
        continue;
      }
      const data = await resp.json();
      const parts = data.candidates?.[0]?.content?.parts || [];
      const imgPart = parts.find((p: any) => p.inlineData?.mimeType?.startsWith("image/"));
      if (imgPart?.inlineData) {
        console.log(`Image generated successfully with model: ${model}`);
        return `data:${imgPart.inlineData.mimeType};base64,${imgPart.inlineData.data}`;
      }
      console.warn(`Model ${model} returned no image data`);
    } catch (err) {
      console.warn(`Gemini image model ${model} error:`, err);
    }
  }
  return null;
}

async function generateImageGateway(lovableApiKey: string, title: string, category: string): Promise<string | null> {
  try {
    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${lovableApiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3.1-flash-image-preview",
        messages: [{ role: "user", content: IMAGE_PROMPT_TEMPLATE(title, category) }],
        modalities: ["image", "text"],
      }),
    });
    if (!resp.ok) return null;
    const data = await resp.json();
    return data.choices?.[0]?.message?.images?.[0]?.image_url?.url || null;
  } catch { return null; }
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

// ── Main handler ──────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { userId } = await req.json();
    if (!userId) throw new Error("userId is required");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch settings + decrypt gemini key
    const { data: settings } = await supabase.from("user_settings").select("*").eq("user_id", userId).single();
    const writerPrompt = settings?.writer_prompt || null;
    const systemPrompt = buildSystemPrompt(writerPrompt);

    let geminiApiKey: string | null = null;
    if (settings?.gemini_api_key) {
      const { data: decrypted } = await supabase.rpc("decrypt_credential", {
        enc_key: "",
        val: settings.gemini_api_key,
      });
      if (decrypted && typeof decrypted === "string" && decrypted.length > 5) {
        geminiApiKey = decrypted;
      }
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const useGemini = !!geminiApiKey;

    if (!useGemini && !LOVABLE_API_KEY) {
      throw new Error("Nenhuma chave de IA configurada. Configure sua chave Gemini nas configurações.");
    }

    console.log(`Using AI provider: ${useGemini ? "Google Gemini (user key)" : "Lovable AI Gateway"}`);

    const { data: topics } = await supabase.from("trending_topics").select("*").eq("user_id", userId).eq("used", false).limit(10);

    const userCategories = settings?.categories || ["esportes", "politica", "policia", "saude", "celebridades", "financas"];
    const topicsToUse = topics && topics.length > 0
      ? topics
      : userCategories.map((cat: string) => ({ topic: getDefaultTopic(cat), category: cat, id: null }));

    const articlesPerDay = settings?.articles_per_day || 10;
    const intervalHours = 24 / articlesPerDay;
    const now = new Date();
    const generatedArticles = [];
    const failureReasons: Array<{ status: number; message: string }> = [];

    for (let i = 0; i < Math.min(articlesPerDay, topicsToUse.length); i++) {
      const topic = topicsToUse[i];
      const scheduledAt = new Date(now.getTime() + i * intervalHours * 60 * 60 * 1000);

      try {
        const userPrompt = buildUserPrompt(topic.topic, topic.category);

        let parsed: AIResponse;
        try {
          if (useGemini) {
            parsed = sanitizeSeoFields(await callGeminiDirect(geminiApiKey!, systemPrompt, userPrompt));
          } else {
            parsed = sanitizeSeoFields(await callLovableGateway(LOVABLE_API_KEY!, systemPrompt, userPrompt));
          }
        } catch (aiErr: any) {
          const primaryMessage = aiErr instanceof Error ? aiErr.message : String(aiErr);
          console.error(`AI error for topic ${topic.topic}:`, primaryMessage);

          if (useGemini && LOVABLE_API_KEY) {
            console.log(`Gemini failed, falling back to Lovable AI Gateway for: ${topic.topic}`);
            try {
              parsed = sanitizeSeoFields(await callLovableGateway(LOVABLE_API_KEY!, systemPrompt, userPrompt));
            } catch (fallbackErr: any) {
              const fallbackMessage = fallbackErr instanceof Error ? fallbackErr.message : String(fallbackErr);
              console.error(`Fallback also failed for ${topic.topic}:`, fallbackMessage);
              const combinedMessage = `${primaryMessage} | fallback: ${fallbackMessage}`;
              const status = /402|payment_required|Not enough credits/i.test(fallbackMessage)
                ? 402
                : /429|RESOURCE_EXHAUSTED|spending cap/i.test(primaryMessage)
                  ? 429
                  : 500;
              failureReasons.push({ status, message: combinedMessage });
              continue;
            }
          } else {
            if (/429|RESOURCE_EXHAUSTED|spending cap/i.test(primaryMessage)) {
              console.log("Rate limited, waiting 10 seconds...");
              await new Promise((r) => setTimeout(r, 10000));
            }
            const status = /402|payment_required|Not enough credits/i.test(primaryMessage)
              ? 402
              : /429|RESOURCE_EXHAUSTED|spending cap/i.test(primaryMessage)
                ? 429
                : 500;
            failureReasons.push({ status, message: primaryMessage });
            continue;
          }
        }

        if (!parsed.title || !parsed.content) {
          console.error("Missing required fields for topic:", topic.topic);
          failureReasons.push({ status: 500, message: `Campos obrigatórios ausentes para o tópico: ${topic.topic}` });
          continue;
        }

        if (parsed.content.length < 1800) {
          console.warn(`Content short (${parsed.content.length} chars) for: ${topic.topic}`);
        }

        let featuredImageUrl: string | null = null;
        if (useGemini && geminiApiKey) {
          console.log(`Generating image with Gemini for: ${parsed.title}`);
          featuredImageUrl = await generateImageGemini(geminiApiKey, parsed.title, topic.category);
        }
        if (!featuredImageUrl && LOVABLE_API_KEY) {
          console.log(`Generating image with Lovable gateway for: ${parsed.title}`);
          featuredImageUrl = await generateImageGateway(LOVABLE_API_KEY, parsed.title, topic.category);
        }
        if (featuredImageUrl) {
          console.log(`Featured image generated (${featuredImageUrl.startsWith("data:") ? "base64" : "url"}, ${featuredImageUrl.length} chars)`);
        } else {
          console.warn(`No featured image generated for: ${parsed.title}`);
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
        }).select().single();

        if (insertError) {
          console.error("Insert error:", insertError);
          failureReasons.push({ status: 500, message: insertError.message || "Erro ao salvar artigo gerado" });
          continue;
        }

        if (topic.id) {
          await supabase.from("trending_topics").update({ used: true }).eq("id", topic.id);
        }

        generatedArticles.push(article);
        await new Promise((resolve) => setTimeout(resolve, useGemini ? 2000 : 3000));
      } catch (err) {
        console.error(`Error generating article for ${topic.topic}:`, err);
        failureReasons.push({
          status: 500,
          message: err instanceof Error ? err.message : `Erro desconhecido no tópico: ${topic.topic}`,
        });
      }
    }

    if (generatedArticles.length === 0) {
      const hasGatewayCreditError = failureReasons.some(({ status, message }) => status === 402 || /payment_required|Not enough credits/i.test(message));
      const hasGeminiLimitError = failureReasons.some(({ status, message }) => status === 429 || /RESOURCE_EXHAUSTED|spending cap/i.test(message));

      const errorMessage = hasGatewayCreditError && hasGeminiLimitError
        ? "Nenhum artigo foi gerado: sua chave Gemini atingiu o limite mensal e o Lovable AI está sem créditos. Adicione créditos em Settings > Workspace > Usage ou aumente o limite da sua chave Gemini."
        : hasGatewayCreditError
          ? "Nenhum artigo foi gerado: o Lovable AI está sem créditos. Adicione créditos em Settings > Workspace > Usage."
          : hasGeminiLimitError
            ? "Nenhum artigo foi gerado: sua chave Gemini atingiu o limite mensal. Ajuste o spend cap da chave configurada."
            : failureReasons[0]?.message || "Nenhum artigo pôde ser gerado.";

      return new Response(
        JSON.stringify({ error: errorMessage, details: failureReasons.slice(0, 3) }),
        {
          status: hasGatewayCreditError ? 402 : hasGeminiLimitError ? 429 : 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    return new Response(
      JSON.stringify({ success: true, message: `${generatedArticles.length} artigos gerados com sucesso!`, articles: generatedArticles.length, provider: useGemini ? "gemini" : "lovable" }),
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
