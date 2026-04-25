import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ── RSS Fetching ─────────────────────────────────────────────────────────

async function fetchGoogleTrendsRSS(): Promise<string | null> {
  const url = "https://trends.google.com.br/trending/rss?geo=BR";
  try {
    console.log(`[RSS] Fetching Google Trends from ${url}`);
    const resp = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
        "Accept": "application/rss+xml, application/xml, text/xml, */*"
      }
    });
    if (!resp.ok) {
      console.error(`[RSS] Fetch failed with status ${resp.status}`);
      return null;
    }
    const text = await resp.text();
    if (!text || text.length < 500) {
      console.error(`[RSS] Response too short: ${text?.length || 0} chars`);
      return null;
    }
    return text;
  } catch (err) {
    console.error(`[RSS] Error fetching feed:`, err);
    return null;
  }
}

// ── AI Prompt ─────────────────────────────────────────────────────────────

function buildRSSCategorizationPrompt(rssContent: string, categories: string[]) {
  const systemPrompt = `Você é um analista de tendências. Abaixo está um feed RSS do Google Trends Brasil.
Sua tarefa é extrair os tópicos e categorizá-los.

REGRAS:
1. Extraia o título do tópico (<title>), o volume de buscas (<ht:approx_traffic>), o contexto da notícia (<ht:news_item_title>), o nome da fonte (<ht:news_item_source>) e o link da fonte (<ht:news_item_url>).
2. Atribua uma categoria: ${categories.join(", ")}.
3. Retorne APENAS um JSON válido no formato:
[{"topic": "nome", "search_volume": "vol", "category": "cat", "context": "título da notícia real", "source_name": "Portal X", "source_url": "https://..."}]

Extraia o máximo possível (até 40 tópicos).`;

  const userPrompt = `XML do RSS:\n${rssContent.substring(0, 20000)}`;
  return { systemPrompt, userPrompt };
}

// ── AI Providers ──────────────────────────────────────────────────────────

async function callAI(providers: any[], systemPrompt: string, userPrompt: string) {
  for (const p of providers) {
    try {
      console.log(`Trying ${p.name}`);
      let content = "";
      if (p.name === "Gemini") {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${p.key}`;
        const resp = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            system_instruction: { parts: [{ text: systemPrompt }] },
            contents: [{ role: "user", parts: [{ text: userPrompt }] }],
            generationConfig: { responseMimeType: "application/json" },
          }),
        });
        const data = await resp.json();
        content = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
      } else {
        const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: { Authorization: `Bearer ${p.key}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "google/gemini-1.5-flash",
            messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }],
          }),
        });
        const data = await resp.json();
        content = data.choices?.[0]?.message?.content || "";
      }
      return { content, provider: p.name };
    } catch (err) { console.warn(`${p.name} failed`, err); }
  }
  throw new Error("AI failed");
}

// ── RSS Direct Parser (fallback when AI fails) ──────────────────────────

function parseRSSDirectly(rss: string, categories: string[]): any[] {
  const items = rss.match(/<item[\s\S]*?<\/item>/gi) || [];
  const decode = (s: string) =>
    s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
      .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"').replace(/&#39;/g, "'").trim();
  const pick = (block: string, tag: string): string => {
    const m = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"));
    return m ? decode(m[1]) : "";
  };

  const guessCategory = (text: string): string => {
    const t = text.toLowerCase();
    const keywords: Record<string, string[]> = {
      esportes: ["futebol", "jogo", "time", "campeonato", "gol", "atleta", "olimp", "copa", "seleção", "técnico", "brasileirão"],
      politica: ["presidente", "ministro", "senado", "câmara", "lula", "governo", "stf", "congresso", "deputado"],
      policia: ["polícia", "preso", "crime", "operação", "assalto", "homicídio", "investigação", "tráfico"],
      saude: ["saúde", "vacina", "hospital", "anvisa", "doença", "covid", "médico", "tratamento"],
      celebridades: ["ator", "atriz", "cantor", "novela", "famoso", "bbb", "show", "reality"],
      financas: ["dólar", "bolsa", "ibovespa", "juros", "banco central", "selic", "imposto", "economia"],
    };
    for (const cat of categories) {
      const kws = keywords[cat] || [cat];
      if (kws.some((kw) => t.includes(kw))) return cat;
    }
    return categories[0] || "geral";
  };

  const topics: any[] = [];
  for (const item of items.slice(0, 40)) {
    const topic = pick(item, "title");
    if (!topic) continue;
    const traffic = pick(item, "ht:approx_traffic");
    const newsTitle = pick(item, "ht:news_item_title");
    const newsSource = pick(item, "ht:news_item_source");
    const newsUrl = pick(item, "ht:news_item_url");
    topics.push({
      topic,
      search_volume: traffic || "médio",
      category: guessCategory(`${topic} ${newsTitle}`),
      context: newsTitle || null,
      source_name: newsSource || null,
      source_url: newsUrl || null,
    });
  }
  return topics;
}

// ── JSON Extraction / Repair ─────────────────────────────────────────────

function extractTopicsFromAIResponse(raw: string): any[] {
  if (!raw || !raw.trim()) {
    console.warn("[extract] Empty AI response");
    return [];
  }

  let text = raw.replace(/```json\n?/gi, "").replace(/```\n?/g, "").trim();
  // Remove control chars
  text = text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");

  // Try direct parse
  const tryParse = (s: string): any[] | null => {
    try {
      const parsed = JSON.parse(s);
      if (Array.isArray(parsed)) return parsed;
      if (parsed && Array.isArray(parsed.topics)) return parsed.topics;
      return null;
    } catch { return null; }
  };

  let result = tryParse(text);
  if (result) return result;

  // Find first array boundary
  const start = text.indexOf("[");
  if (start === -1) {
    console.warn("[extract] No '[' found in response");
    return [];
  }
  let slice = text.substring(start);

  // Try parse as-is
  result = tryParse(slice);
  if (result) return result;

  // Repair: balance brackets/braces
  let braces = 0, brackets = 0;
  for (const ch of slice) {
    if (ch === "{") braces++;
    else if (ch === "}") braces--;
    else if (ch === "[") brackets++;
    else if (ch === "]") brackets--;
  }
  // Drop trailing incomplete object after last complete one
  let repaired = slice.replace(/,\s*$/g, "");
  while (braces > 0) { repaired += "}"; braces--; }
  while (brackets > 0) { repaired += "]"; brackets--; }

  result = tryParse(repaired);
  if (result) return result;

  // Last resort: extract complete objects via regex
  const objects: any[] = [];
  const objRegex = /\{[^{}]*\}/g;
  const matches = slice.match(objRegex) || [];
  for (const m of matches) {
    try { objects.push(JSON.parse(m)); } catch {}
  }
  console.warn(`[extract] Recovered ${objects.length} objects via regex fallback`);
  return objects;
}

// ── Handler ───────────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { userId } = await req.json();
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    
    const { data: settings } = await supabase.from("user_settings").select("*").eq("user_id", userId).single();
    const categories = settings?.categories || ["esportes", "politica", "saude"];

    const decrypt = async (val: string) => {
      if (!val) return null;
      const { data } = await supabase.rpc("decrypt_credential", { enc_key: "", val });
      return data;
    };

    const gKey = await decrypt(settings?.gemini_api_key);
    const providers = [];
    if (gKey) providers.push({ name: "Gemini", key: gKey });
    if (Deno.env.get("LOVABLE_API_KEY")) providers.push({ name: "Lovable", key: Deno.env.get("LOVABLE_API_KEY") });

    const rss = await fetchGoogleTrendsRSS();
    if (!rss) throw new Error("RSS do Google Trends não disponível no momento. Tente novamente em alguns minutos.");

    console.log(`[fetch-trends] RSS fetched, length: ${rss.length}`);
    const itemsFound = rss.match(/<item[\s\S]*?<\/item>/gi) || [];
    console.log(`[fetch-trends] Items found in RSS via regex: ${itemsFound.length}`);

    let topics: any[] = [];
    try {
      const { systemPrompt, userPrompt } = buildRSSCategorizationPrompt(rss, categories);
      const { content, provider } = await callAI(providers, systemPrompt, userPrompt);
      console.log(`[fetch-trends] AI (${provider}) response length: ${content?.length || 0}`);
      topics = extractTopicsFromAIResponse(content);
    } catch (aiErr: any) {
      console.warn("[fetch-trends] AI parsing failed:", aiErr.message);
    }

    // Fallback: parse RSS XML directly when AI fails or returns nothing
    if (!topics.length) {
      console.log("[fetch-trends] No topics from AI or AI failed. Falling back to direct RSS parsing...");
      topics = parseRSSDirectly(rss, categories);
      console.log(`[fetch-trends] Direct RSS parsing recovered ${topics.length} topics`);
    }

    if (!topics.length) {
      console.error("[fetch-trends] Final topics count is 0. RSS preview:", rss.substring(0, 500));
      throw new Error("Não foi possível extrair tópicos do feed. O formato do feed pode ter mudado.");
    }

    // 1. Buscar tópicos existentes do usuário que não foram usados
    const { data: existingTopics } = await supabase
      .from("trending_topics")
      .select("topic, update_count, id")
      .eq("user_id", userId)
      .eq("used", false);

    const existingMap = new Map(existingTopics?.map(t => [t.topic, t]) || []);

    // 2. Preparar operações (update ou insert)
    const toUpdate = [];
    const toInsert = [];

    for (const t of topics) {
      if (existingMap.has(t.topic)) {
        const existing = existingMap.get(t.topic);
        toUpdate.push({
          id: existing.id,
          update_count: (existing.update_count || 1) + 1,
          fetched_at: new Date().toISOString()
        });
      } else {
        toInsert.push({
          user_id: userId,
          topic: t.topic,
          category: t.category,
          search_volume: t.search_volume,
          context: t.context,
          source_name: t.source_name,
          source_url: t.source_url,
          update_count: 1
        });
      }
    }

    // 3. Executar atualizações
    for (const item of toUpdate) {
      await supabase.from("trending_topics").update({ 
        update_count: item.update_count,
        fetched_at: item.fetched_at
      }).eq("id", item.id);
    }

    // 4. Inserir novos
    if (toInsert.length > 0) {
      await supabase.from("trending_topics").insert(toInsert);
    }

    // 5. Limpar tópicos antigos (mais de 24h)
    await supabase.rpc('clean_old_trending_topics');

    // 6. Atualizar timestamp da última busca nas configurações do usuário
    await supabase.from("user_settings").update({ 
      last_trends_fetch: new Date().toISOString() 
    }).eq("user_id", userId);

    return new Response(JSON.stringify({ success: true, count: topics.length }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
