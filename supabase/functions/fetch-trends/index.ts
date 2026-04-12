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

const EVERGREEN_TOPICS: Record<string, string[]> = {
  esportes: [
    "Dicas para começar a correr: guia completo para iniciantes",
    "Melhores exercícios para emagrecer com saúde",
    "Como montar um treino funcional em casa",
  ],
  politica: [
    "Como funciona o sistema eleitoral brasileiro",
    "Entenda a divisão dos três poderes no Brasil",
    "Direitos e deveres do cidadão brasileiro",
  ],
  policia: [
    "Como registrar um boletim de ocorrência online",
    "Dicas de segurança para evitar golpes digitais",
    "Como funciona o sistema penitenciário brasileiro",
  ],
  saude: [
    "Alimentos que fortalecem a imunidade naturalmente",
    "Como melhorar a qualidade do sono: guia completo",
    "Benefícios da meditação para saúde mental",
  ],
  celebridades: [
    "Os maiores artistas brasileiros de todos os tempos",
    "Histórias de superação de celebridades brasileiras",
    "Influenciadores digitais que mudaram o mercado no Brasil",
  ],
  financas: [
    "Como começar a investir com pouco dinheiro",
    "Guia completo de educação financeira para iniciantes",
    "Melhores investimentos de renda fixa no Brasil",
  ],
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { userId } = await req.json();
    if (!userId) throw new Error("userId is required");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch user settings
    const { data: settings } = await supabase
      .from("user_settings")
      .select("categories")
      .eq("user_id", userId)
      .single();

    const categories = settings?.categories || ["esportes", "politica", "policia", "saude", "celebridades", "financas"];

    // Fetch only USED topics to avoid duplicates (unused ones will be deleted)
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

    // 1. Fetch trending topics from AI grounded in real sources
    for (const category of categories) {
      try {
        const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash",
            messages: [
              {
                role: "system",
                content: `Você é um analista de tendências jornalísticas do Brasil. Sua função é identificar os assuntos REAIS mais buscados e comentados no Brasil HOJE.

FONTES OBRIGATÓRIAS para consultar:
- Google Trends Brasil (trends.google.com.br)
- ${TOP_PORTALS.join("\n- ")}

REGRAS:
1. Retorne APENAS assuntos REAIS que estão sendo noticiados HOJE ${today}
2. Cada tópico deve ser específico (nome de pessoa, evento, lei, time, etc.) — NÃO genérico
3. NÃO repita assuntos entre si — cada um deve ser único e distinto
4. Priorize notícias que estão em MAIS de um portal (cross-referência)
5. Inclua contexto suficiente no nome do tópico para ser pesquisável

Responda APENAS em JSON válido, array de objetos:
[{"topic": "assunto específico e atual", "search_volume": "alto/médio/baixo"}]

Retorne exatamente 5 tópicos.`,
              },
              {
                role: "user",
                content: `Categoria: "${category}". Quais são os 5 assuntos mais falados no Brasil HOJE (${today}) nesta categoria? Busque nos portais: G1, UOL, Folha, Estadão, R7, Terra, Metrópoles, CNN Brasil. Foque em notícias que aparecem em múltiplos portais.`,
              },
            ],
          }),
        });

        if (response.ok) {
          const data = await response.json();
          let content = data.choices?.[0]?.message?.content || "";
          content = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();

          try {
            const topics = JSON.parse(content);
            if (Array.isArray(topics)) {
              for (const t of topics) {
                const topicLower = t.topic?.toLowerCase().trim();
                if (topicLower && !existingSet.has(topicLower)) {
                  allTopics.push({
                    topic: t.topic,
                    category,
                    search_volume: t.search_volume || "médio",
                  });
                  existingSet.add(topicLower);
                }
              }
            }
          } catch {
          console.error("Failed to parse trends for category:", category, content.substring(0, 200));
          }
        }

        await new Promise((r) => setTimeout(r, 1500));
      } catch (err) {
        console.error(`Error fetching trends for ${category}:`, err);
      }
    }

    // 2. Add evergreen topics (1 per category, avoiding duplicates)
    for (const category of categories) {
      const evTopics = EVERGREEN_TOPICS[category] || [];
      if (evTopics.length > 0) {
        // Pick a random evergreen that isn't already used
        const available = evTopics.filter((t) => !existingSet.has(t.toLowerCase().trim()));
        if (available.length > 0) {
          const picked = available[Math.floor(Math.random() * available.length)];
          allTopics.push({
            topic: picked,
            category,
            search_volume: "evergreen",
          });
          existingSet.add(picked.toLowerCase().trim());
        }
      }
    }

    // 3. Final deduplication by similarity (remove topics that are too similar)
    const dedupedTopics = deduplicateBySimilarity(allTopics);

    // 4. Delete old unused topics for this user
    await supabase
      .from("trending_topics")
      .delete()
      .eq("user_id", userId)
      .eq("used", false);

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
        message: `${dedupedTopics.length} tendências encontradas (${categories.length} categorias + evergreen)!`,
        topics: dedupedTopics.length,
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

      // Calculate Jaccard similarity
      const intersection = [...words].filter((w) => existingWords.has(w)).length;
      const union = new Set([...words, ...existingWords]).size;
      const similarity = union > 0 ? intersection / union : 0;

      return similarity > 0.5;
    });

    if (!isDuplicate) {
      result.push(topic);
    }
  }

  return result;
}
