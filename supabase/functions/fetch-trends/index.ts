import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ── RSS Fetching ─────────────────────────────────────────────────────────

async function fetchGoogleTrendsRSS(): Promise<string | null> {
  const url = "https://trends.google.com.br/trending/rss?geo=BR";
  try {
    console.log(`[RSS] Fetching Google Trends from ${url}`);
    const resp = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
      }
    });
    if (!resp.ok) {
      console.warn(`[RSS] Failed to fetch RSS: ${resp.status}`);
      return null;
    }
    return await resp.text();
  } catch (err) {
    console.error(`[RSS] Error fetching RSS:`, err);
    return null;
  }
}

// ── AI provider abstraction ─────────────────────────────────────────────

function buildRSSCategorizationPrompt(rssContent: string, categories: string[]) {
  const systemPrompt = `Você é um analista de tendências. Abaixo está um feed RSS do Google Trends Brasil.
Sua tarefa é extrair os tópicos em alta e categorizá-los.

REGRAS:
1. Extraia o título (<title>) e o volume de buscas (<ht:approx_traffic>) de cada <item>.
2. Para cada item, atribua uma das categorias permitidas: ${categories.join(", ")}. Se não se encaixar bem, use "geral" ou a que for mais próxima.
3. Retorne APENAS um JSON válido no formato:
[{"topic": "nome do tópico", "search_volume": "volume", "category": "categoria"}]

Extraia o máximo de tópicos possível (até 30).`;

  const userPrompt = `Aqui está o XML do RSS:
${rssContent.substring(0, 15000)}`; // Bounded size

  return { systemPrompt, userPrompt };
}

function buildTrendsPrompt(category: string, today: string, existingSet: Set<string>) {
  const systemPrompt = `Você é um analista de tendências jornalísticas do Brasil. Sua função é identificar os assuntos REAIS mais buscados e comentados no Brasil HOJE.

REGRAS RIGOROSAS:
1. Retorne APENAS assuntos REAIS que estão sendo noticiados HOJE ${today}
2. Cada tópico deve ser ESPECÍFICO (nome de pessoa, evento, lei, time, local, etc.) — NUNCA genérico
3. Cada tópico deve ser sobre um FATO/EVENTO DIFERENTE
4. NÃO retorne tópicos similares a estes:
${[...existingSet].slice(-20).join("\n")}

Responda APENAS em JSON válido:
[{"topic": "assunto específico", "search_volume": "alto/médio/baixo"}]`;

  const userPrompt = `Categoria: "${category}". Quais são os 5 assuntos mais falados no Brasil HOJE (${today})?`;

  return { systemPrompt, userPrompt };
}

async function callGemini(apiKey: string, systemPrompt: string, userPrompt: string): Promise<string> {
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
  if (!resp.ok) throw new Error(`Gemini API error ${resp.status}`);
  const data = await resp.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || "";
}

async function callOpenAI(apiKey: string, systemPrompt: string, userPrompt: string): Promise<string> {
  const resp = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }],
      response_format: { type: "json_object" },
    }),
  });
  if (!resp.ok) throw new Error(`OpenAI API error ${resp.status}`);
  const data = await resp.json();
  return data.choices?.[0]?.message?.content || "";
}

async function callLovableGateway(apiKey: string, systemPrompt: string, userPrompt: string): Promise<string> {
  const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }],
    }),
  });
  if (!resp.ok) throw new Error(`Gateway error ${resp.status}`);
  const data = await resp.json();
  return data.choices?.[0]?.message?.content || "";
}

async function callWithFallback(providers: any[], systemPrompt: string, userPrompt: string) {
  for (const p of providers) {
    try {
      console.log(`Trying ${p.name}`);
      const content = await p.call(systemPrompt, userPrompt);
      return { content, provider: p.name };
    } catch (err) {
      console.warn(`${p.name} failed:`, err);
    }
  }
  throw new Error("Todos os provedores falharam");
}

// ── Main Handler ─────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { userId } = await req.json();
    if (!userId) throw new Error("userId is required");

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    const { data: settings } = await supabase
      .from("user_settings")
      .select("categories, gemini_api_key, openai_api_key, groq_api_key")
      .eq("user_id", userId)
      .single();

    const categories = settings?.categories || ["esportes", "politica", "policia", "saude", "celebridades", "financas"];

    // Decrypt keys (simplified helper)
    const decrypt = async (val: string) => {
      if (!val) return null;
      const { data } = await supabase.rpc("decrypt_credential", { enc_key: "", val });
      return data && typeof data === "string" && data.length > 5 ? data : null;
    };

    const geminiKey = await decrypt(settings?.gemini_api_key);
    const openaiKey = await decrypt(settings?.openai_api_key);

    const providers = [];
    if (geminiKey) providers.push({ name: "Gemini", call: (s: string, u: string) => callGemini(geminiKey, s, u) });
    if (openaiKey) providers.push({ name: "OpenAI", call: (s: string, u: string) => callOpenAI(openaiKey, s, u) });
    if (LOVABLE_API_KEY) providers.push({ name: "Lovable AI", call: (s: string, u: string) => callLovableGateway(LOVABLE_API_KEY, s, u) });

    if (providers.length === 0) throw new Error("Nenhum provedor de IA configurado.");

    // Step 1: Try real-time RSS
    const rssContent = await fetchGoogleTrendsRSS();
    let allTopics: any[] = [];
    let usedProvider = "";

    if (rssContent) {
      console.log("[RSS] Successfully fetched. Categorizing with AI...");
      const { systemPrompt, userPrompt } = buildRSSCategorizationPrompt(rssContent, categories);
      const { content: rawContent, provider } = await callWithFallback(providers, systemPrompt, userPrompt);
      
      usedProvider = provider;
      try {
        const cleaned = rawContent.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
        const parsed = JSON.parse(cleaned);
        allTopics = Array.isArray(parsed) ? parsed : (parsed.topics || []);
        console.log(`[RSS] Extracted ${allTopics.length} topics via ${provider}`);
      } catch (e) {
        console.error("[RSS] Failed to parse AI response:", e);
      }
    }

    // Step 2: Fallback to old method if RSS failed or returned nothing
    if (allTopics.length === 0) {
      console.log("[Fallback] RSS failed or empty. Using traditional AI trend detection...");
      const today = new Date().toLocaleDateString("pt-BR");
      for (const cat of categories) {
        const { systemPrompt, userPrompt } = buildTrendsPrompt(cat, today, new Set());
        const { content: rawContent, provider } = await callWithFallback(providers, systemPrompt, userPrompt);
        usedProvider = provider;
        try {
          const cleaned = rawContent.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
          const parsed = JSON.parse(cleaned);
          const topics = Array.isArray(parsed) ? parsed : (parsed.topics || []);
          allTopics.push(...topics.map(t => ({ ...t, category: cat })));
        } catch {}
      }
    }

    // Step 3: Deduplicate and Save
    const deduped: any[] = [];
    const seen = new Set();
    for (const t of allTopics) {
      const key = t.topic?.toLowerCase().trim();
      if (key && !seen.has(key)) {
        deduped.push(t);
        seen.has(key);
      }
    }

    // Delete unused
    await supabase.from("trending_topics").delete().eq("user_id", userId).eq("used", false);

    // Insert new
    if (deduped.length > 0) {
      await supabase.from("trending_topics").insert(
        deduped.map(t => ({
          user_id: userId,
          topic: t.topic,
          category: t.category || "geral",
          search_volume: t.search_volume || "desconhecido",
        }))
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `${deduped.length} tendências em tempo real encontradas via ${usedProvider}!`,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("fetch-trends error:", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
