import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const TOP_PORTALS = [
  "G1 (g1.globo.com)",
  "UOL (uol.com.br)",
  "Folha de S.Paulo (folha.uol.com.br)",
  "Estadão (estadao.com.br)",
  "R7 (r7.com)",
  "Terra (terra.com.br)",
  "iG (ig.com.br)",
  "Metrópoles (metropoles.com)",
  "CNN Brasil (cnnbrasil.com.br)",
  "Correio Braziliense (correiobraziliense.com.br)",
];

// Evergreen restrito a Saúde/Bem-estar e Finanças (decisão do usuário)
const EVERGREEN_TOPICS: Record<string, string[]> = {
  saude: [
    "Alimentos que fortalecem a imunidade naturalmente",
    "Como melhorar a qualidade do sono: guia completo",
    "Benefícios da meditação para saúde mental",
    "Exercícios simples para fazer em casa todos os dias",
    "Dicas de bem-estar para o dia a dia corrido",
    "Como reduzir o estresse de forma natural",
  ],
  financas: [
    "Como começar a investir com pouco dinheiro",
    "Guia completo de educação financeira para iniciantes",
    "Melhores investimentos de renda fixa no Brasil",
    "Como sair das dívidas em 6 meses: passo a passo",
    "Reserva de emergência: quanto guardar e onde investir",
    "Planejamento financeiro para a aposentadoria",
  ],
};

// ── AI provider abstraction for trends ──────────────────────────────────

function buildTrendsPrompt(category: string, today: string, existingSet: Set<string>) {
const systemPrompt = `Você é um analista de tendências jornalísticas do Brasil. Sua função é identificar os assuntos REAIS mais buscados e comentados no Brasil HOJE.

FONTES OBRIGATÓRIAS para consultar e cruzar informações:
- Google Trends Brasil (trends.google.com.br)
- ${TOP_PORTALS.join("\n- ")}
- InfoMoney (infomoney.com.br)

REGRAS CRÍTICAS DE INTEGRIDADE E QUALIDADE:
1. CHECAGEM DE FATOS: Verifique rigorosamente se a notícia é real. NUNCA retorne boatos, mentiras ou fake news. Se houver dúvida sobre a veracidade, descarte o assunto.
2. TENDÊNCIAS REAIS: Retorne APENAS assuntos REAIS que estão sendo amplamente noticiados HOJE ${today}.
3. DIVERSIDADE: Cada tópico deve ser ESPECÍFICO e sobre um FATO/EVENTO DIFERENTE. Proibido repetir o mesmo assunto.
4. FONTES CONFIÁVEIS: Priorize notícias que aparecem em múltiplos grandes portais (G1, UOL, R7, etc).
5. FORMATO: Cada tópico deve incluir contexto suficiente para ser pesquisável.

Responda APENAS em JSON válido, array de objetos:
[{"topic": "assunto específico, real e verificado", "search_volume": "alto/médio/baixo"}]

Retorne exatamente 5 tópicos, todos sobre EVENTOS/FATOS DIFERENTES e VERIFICADOS.`;

const userPrompt = `Categoria: "${category}". Quais são os 5 assuntos MAIS FALADOS e VERIFICADOS no Brasil HOJE (${today}) nesta categoria? 
Analise Google Trends e grandes portais (G1, R7, iG, InfoMoney, UOL, etc). 
IMPORTANTE: Verifique se não é fake news ou boato. Retorne apenas fatos confirmados. 
Cada tópico DEVE ser sobre um evento/fato COMPLETAMENTE DIFERENTE dos outros.`;

  return { systemPrompt, userPrompt };
}

async function callGeminiForTrends(apiKey: string, systemPrompt: string, userPrompt: string): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
  const resp = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: systemPrompt }] },
      contents: [{ role: "user", parts: [{ text: userPrompt }] }],
      generationConfig: { responseMimeType: "application/json" },
    }),
  });
  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`Gemini API error ${resp.status}: ${errText.substring(0, 200)}`);
  }
  const data = await resp.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || "";
}

async function callOpenAIForTrends(apiKey: string, systemPrompt: string, userPrompt: string): Promise<string> {
  const resp = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }],
      response_format: { type: "json_object" },
    }),
  });
  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`OpenAI API error ${resp.status}: ${errText.substring(0, 200)}`);
  }
  const data = await resp.json();
  return data.choices?.[0]?.message?.content || "";
}

async function callGroqForTrends(apiKey: string, systemPrompt: string, userPrompt: string): Promise<string> {
  const resp = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }],
      response_format: { type: "json_object" },
    }),
  });
  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`Groq API error ${resp.status}: ${errText.substring(0, 200)}`);
  }
  const data = await resp.json();
  return data.choices?.[0]?.message?.content || "";
}

async function callLovableGatewayForTrends(apiKey: string, systemPrompt: string, userPrompt: string): Promise<string> {
  const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }],
    }),
  });
  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`Gateway error ${resp.status}: ${errText.substring(0, 200)}`);
  }
  const data = await resp.json();
  return data.choices?.[0]?.message?.content || "";
}

// ── Build provider chain ─────────────────────────────────────────────────

interface TrendsProvider {
  name: string;
  call: (systemPrompt: string, userPrompt: string) => Promise<string>;
}

async function callTrendsWithFallback(
  providers: TrendsProvider[],
  systemPrompt: string,
  userPrompt: string,
): Promise<{ content: string; provider: string }> {
  const errors: string[] = [];
  for (const provider of providers) {
    try {
      console.log(`[Trends] Trying provider: ${provider.name}`);
      const content = await provider.call(systemPrompt, userPrompt);
      console.log(`[Trends] Success with: ${provider.name}`);
      return { content, provider: provider.name };
    } catch (err: any) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[Trends] ${provider.name} failed: ${msg.substring(0, 200)}`);
      errors.push(`${provider.name}: ${msg}`);
    }
  }
  throw new Error(`Todos os provedores falharam:\n${errors.join("\n")}`);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { userId } = await req.json();
    if (!userId) throw new Error("userId is required");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch user settings
    const { data: settings } = await supabase
      .from("user_settings")
      .select("categories, gemini_api_key, openai_api_key, groq_api_key")
      .eq("user_id", userId)
      .single();

    const categories = settings?.categories || ["esportes", "politica", "policia", "saude", "celebridades", "financas"];

    // Decrypt API keys
    let geminiKey: string | null = null;
    let openaiKey: string | null = null;
    let groqKey: string | null = null;

    if (settings?.gemini_api_key) {
      const { data: d } = await supabase.rpc("decrypt_credential", { enc_key: "", val: settings.gemini_api_key });
      if (d && typeof d === "string" && d.length > 5) geminiKey = d;
    }
    if (settings?.openai_api_key) {
      const { data: d } = await supabase.rpc("decrypt_credential", { enc_key: "", val: settings.openai_api_key });
      if (d && typeof d === "string" && d.length > 5) openaiKey = d;
    }
    if (settings?.groq_api_key) {
      const { data: d } = await supabase.rpc("decrypt_credential", { enc_key: "", val: settings.groq_api_key });
      if (d && typeof d === "string" && d.length > 5) groqKey = d;
    }

    // Build provider chain: Gemini PRIMEIRO (preferência do usuário) → OpenAI → Groq → Lovable AI
    const providers: TrendsProvider[] = [];
    if (geminiKey) {
      const key = geminiKey;
      providers.push({ name: "Gemini", call: (s, u) => callGeminiForTrends(key, s, u) });
    }
    if (openaiKey) {
      const key = openaiKey;
      providers.push({ name: "OpenAI", call: (s, u) => callOpenAIForTrends(key, s, u) });
    }
    if (groqKey) {
      const key = groqKey;
      providers.push({ name: "Groq", call: (s, u) => callGroqForTrends(key, s, u) });
    }
    if (LOVABLE_API_KEY) {
      const key = LOVABLE_API_KEY;
      providers.push({ name: "Lovable AI", call: (s, u) => callLovableGatewayForTrends(key, s, u) });
    }

    if (providers.length === 0) {
      throw new Error("Nenhum provedor de IA configurado. Configure sua chave Gemini, OpenAI ou Groq nas Configurações.");
    }

    console.log(`[Trends] Available providers: ${providers.map(p => p.name).join(", ")}`);

    // Fetch only USED topics to avoid duplicates
    const { data: existingTopics } = await supabase
      .from("trending_topics")
      .select("topic")
      .eq("user_id", userId)
      .eq("used", true);

    const existingSet = new Set(
      (existingTopics || []).map((t: { topic: string }) => t.topic.toLowerCase().trim())
    );
    console.log(`Found ${existingSet.size} used topics to avoid duplicating`);

    const today = new Date().toLocaleDateString("pt-BR");
    const allTopics: Array<{ topic: string; category: string; search_volume: string }> = [];
    let usedProvider = "";

    // 1. Fetch trending topics with multi-provider fallback
    for (const category of categories) {
      try {
        const { systemPrompt, userPrompt } = buildTrendsPrompt(category, today, existingSet);
        const { content: rawContent, provider } = await callTrendsWithFallback(providers, systemPrompt, userPrompt);
        usedProvider = provider;

        let content = rawContent.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
        console.log(`Category ${category} (${provider}): ${content.length} chars`);

        try {
          // Handle both array and object with array property
          let topics: any[];
          const parsed = JSON.parse(content);
          if (Array.isArray(parsed)) {
            topics = parsed;
          } else if (parsed.topics && Array.isArray(parsed.topics)) {
            topics = parsed.topics;
          } else {
            // Try to find any array property
            const arrProp = Object.values(parsed).find(v => Array.isArray(v));
            topics = (arrProp as any[]) || [];
          }

          let added = 0;
          for (const t of topics) {
            const topicLower = t.topic?.toLowerCase().trim();
            if (topicLower && !existingSet.has(topicLower)) {
              allTopics.push({
                topic: t.topic,
                category,
                search_volume: t.search_volume || "médio",
              });
              existingSet.add(topicLower);
              added++;
            }
          }
          console.log(`Category ${category}: ${added} new topics added (${topics.length} returned)`);
        } catch {
          console.error("Failed to parse trends for category:", category, content.substring(0, 200));
        }
      } catch (err) {
        console.error(`Error fetching trends for ${category}:`, err);
      }

      await new Promise((r) => setTimeout(r, 1500));
    }

    // 2. Add evergreen topics (apenas Saúde/Bem-estar e Finanças, 2 por categoria, sem duplicar)
    for (const category of Object.keys(EVERGREEN_TOPICS)) {
      const evTopics = EVERGREEN_TOPICS[category];
      const available = evTopics.filter((t) => !existingSet.has(t.toLowerCase().trim()));
      // shuffle and pick up to 2
      const shuffled = available.sort(() => Math.random() - 0.5).slice(0, 2);
      for (const picked of shuffled) {
        allTopics.push({ topic: picked, category, search_volume: "evergreen" });
        existingSet.add(picked.toLowerCase().trim());
      }
    }

    // 3. Final deduplication by similarity
    const dedupedTopics = deduplicateBySimilarity(allTopics);

    // 4. Delete old unused topics
    await supabase.from("trending_topics").delete().eq("user_id", userId).eq("used", false);

    // 5. Insert new topics
    if (dedupedTopics.length > 0) {
      await supabase.from("trending_topics").insert(
        dedupedTopics.map((t) => ({
          user_id: userId,
          topic: t.topic,
          category: t.category,
          search_volume: t.search_volume,
        }))
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `${dedupedTopics.length} tendências encontradas via ${usedProvider || "evergreen"} (${categories.length} categorias)!`,
        topics: dedupedTopics.length,
        provider: usedProvider,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("fetch-trends error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

/**
 * Remove topics that are too similar to each other based on word overlap.
 */
function deduplicateBySimilarity(
  topics: Array<{ topic: string; category: string; search_volume: string }>
): Array<{ topic: string; category: string; search_volume: string }> {
  const result: typeof topics = [];

  for (const topic of topics) {
    const words = new Set(
      topic.topic
        .toLowerCase()
        .replace(/[^\w\sáàãâéêíóôõúç]/g, "")
        .split(/\s+/)
        .filter((w) => w.length > 3)
    );

    const isDuplicate = result.some((existing) => {
      const existingWords = new Set(
        existing.topic
          .toLowerCase()
          .replace(/[^\w\sáàãâéêíóôõúç]/g, "")
          .split(/\s+/)
          .filter((w) => w.length > 3)
      );

      const intersection = [...words].filter((w) => existingWords.has(w)).length;
      const union = new Set([...words, ...existingWords]).size;
      const similarity = union > 0 ? intersection / union : 0;

      const longWords = [...words].filter((w) => w.length > 5);
      const hasSharedKeyword = longWords.some((w) => existingWords.has(w));

      return similarity > 0.35 || (hasSharedKeyword && similarity > 0.2);
    });

    if (!isDuplicate) {
      result.push(topic);
    }
  }

  return result;
}
