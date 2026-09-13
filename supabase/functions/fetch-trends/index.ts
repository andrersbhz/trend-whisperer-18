import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import {
  classifySource,
  computeTrendScore,
  discoverSources,
  fetchText,
  parseRssItems,
  type SourceRef,
} from "../_shared/editorial.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ── RSS Fetching ─────────────────────────────────────────────────────────

async function fetchGoogleTrendsRSS(geo: string): Promise<string | null> {
  const url = geo === "US" 
    ? "https://trends.google.com/trending/rss?geo=US"
    : "https://trends.google.com.br/trending/rss?geo=BR";
    
  try {
    console.log(`[RSS] Fetching Google Trends from ${url} (Geo: ${geo})`);
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

async function fetchPortalLeoDiasRSS(): Promise<string | null> {
  const url = "https://portalleodias.com/feed/";
  try {
    console.log(`[RSS] Fetching Portal Leo Dias from ${url}`);
    const resp = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
        "Accept": "application/rss+xml, application/xml, text/xml, */*"
      }
    });
    if (!resp.ok) {
      console.error(`[RSS] Portal Leo Dias fetch failed with status ${resp.status}`);
      return null;
    }
    const text = await resp.text();
    if (!text || text.length < 500) {
      console.error(`[RSS] Portal Leo Dias response too short: ${text?.length || 0} chars`);
      return null;
    }
    return text;
  } catch (err) {
    console.error(`[RSS] Error fetching Portal Leo Dias feed:`, err);
    return null;
  }
}

// ── AI Prompt ─────────────────────────────────────────────────────────────

function buildRSSCategorizationPrompt(rssContent: string, categories: string[], geo: string) {
  const regionName = geo === "US" ? "Global/EUA" : "Brasil";
  const systemPrompt = `Você é um analista de tendências especialista em categorização de notícias. Abaixo está um feed RSS do Google Trends (${regionName}).
Sua tarefa é extrair os tópicos e classificá-los com precisão cirúrgica.

REGRAS:
1. Extraia o título do tópico (<title>), o volume de buscas (<ht:approx_traffic>), o contexto da notícia (<ht:news_item_title>), o nome da fonte (<ht:news_item_source>) e o link da fonte (<ht:news_item_url>).
2. Atribua a categoria MAIS ADEQUADA dentre as seguintes: ${categories.join(", ")}.
3. CLASSIFICAÇÃO RIGOROSA: Leia atentamente o título e o contexto para entender do que se trata a notícia. Não use categorias por aproximação se não houver certeza.
4. CATEGORIA "variedades": Se o assunto não se encaixar claramente em nenhuma das categorias acima ou se você tiver qualquer dúvida sobre a classificação correta, use OBRIGATORIAMENTE a categoria "variedades".
5. Retorne APENAS um JSON válido no formato:
[{"topic": "nome", "search_volume": "vol", "category": "cat", "context": "título da notícia real", "source_name": "Google Trends (${regionName})", "source_url": "https://..."}]

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
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${p.key}`;
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
            model: "google/gemini-2.5-flash",
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

// ── Shared helpers ─────────────────────────────────────────────────────

function guessCategory(text: string, categories: string[]): string {
  const t = text.toLowerCase();
  const keywords: Record<string, string[]> = {
    esportes: ["futebol", "jogo", "time", "campeonato", "gol", "atleta", "olimp", "copa", "seleção", "técnico", "brasileirão", "vôlei", "basquete", "tênis", "luta", "mma", "boxe", "f1", "fórmula 1", "soccer", "football", "match", "team", "nfl", "nba", "mlb"],
    politica: ["presidente", "ministro", "senado", "câmara", "lula", "governo", "stf", "congresso", "deputado", "eleição", "voto", "partido", "prefeito", "tarcísio", "bolsonaro", "president", "minister", "senate", "congress", "election", "vote", "party", "biden", "trump"],
    policia: ["polícia", "preso", "crime", "operação", "assalto", "homicídio", "investigação", "tráfico", "justiça", "roubo", "furt", "acusad", "police", "arrested", "crime", "operation", "robbery", "investigation", "justice"],
    saude: ["saúde", "vacina", "hospital", "anvisa", "doença", "covid", "médico", "tratamento", "vírus", "dengue", "gripe", "remédio", "health", "vaccine", "disease", "doctor", "treatment", "virus", "flu", "medicine"],
    celebridades: ["ator", "atriz", "cantor", "novela", "famoso", "bbb", "show", "reality", "influencer", "cinema", "netflix", "globop", "actor", "actress", "singer", "famous", "reality", "influencer", "cinema", "movie"],
    financas: ["dólar", "bolsa", "ibovespa", "juros", "banco central", "selic", "imposto", "economia", "dinheiro", "bitcoin", "investimento", "ação", "ações", "mercado", "dollar", "stock", "interest", "economy", "money", "investment", "market"],
    tecnologia: ["celular", "iphone", "google", "apple", "microsoft", "ia", "inteligência artificial", "lançamento", "app", "software", "nuvem", "internet", "cellphone", "ai", "artificial intelligence", "software", "cloud"],
  };
  for (const cat of categories) {
    const kws = keywords[cat] || [cat];
    if (kws.some((kw) => t.includes(kw))) return cat;
  }
  return "variedades";
}

const decodeXml = (s: string) =>
  s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").trim();

const pickTag = (block: string, tagName: string): string => {
  const tag = tagName.replace(":", "\\:");
  const m = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"));
  if (m) return decodeXml(m[1]);

  if (tagName.includes(":")) {
    const simpleTag = tagName.split(":")[1];
    const m2 = block.match(new RegExp(`<${simpleTag}[^>]*>([\\s\\S]*?)<\\/${simpleTag}>`, "i"));
    if (m2) return decodeXml(m2[1]);
  }
  return "";
};

// ── RSS Direct Parser (fallback when AI fails) ──────────────────────────

function parseRSSDirectly(rss: string, categories: string[], geo: string): any[] {
  console.log(`[parseRSSDirectly] Starting manual parse of ${rss.length} chars (Geo: ${geo})`);
  const items = rss.match(/<item[\s\S]*?<\/item>/gi) || [];
  const regionName = geo === "US" ? "Global" : "Brasil";

  const topics: any[] = [];
  for (const item of items.slice(0, 40)) {
    const title = pickTag(item, "title");
    if (!title) continue;

    const trafficRaw = pickTag(item, "ht:approx_traffic") || "médio";
    const searchVolumeClean = trafficRaw.replace(/[^0-9]/g, "");

    const trafficVal = searchVolumeClean ? parseInt(searchVolumeClean, 10) : 0;
    const newsTitle = pickTag(item, "ht:news_item_title");
    const newsSource = pickTag(item, "ht:news_item_source");
    const newsUrl = pickTag(item, "ht:news_item_url");

    topics.push({
      topic: title,
      search_volume: trafficVal || trafficRaw,
      category: guessCategory(`${title} ${newsTitle}`, categories),
      context: newsTitle || null,
      source_name: newsSource ? `Google Trends ${regionName} (${newsSource})` : `Google Trends ${regionName}`,
      source_url: newsUrl || null,
    });
  }
  return topics;
}

function parseStandardRSS(rss: string, categories: string[], sourceName: string, sourceBaseUrl: string): any[] {
  console.log(`[parseStandardRSS] Starting parse of ${rss.length} chars for ${sourceName}`);
  const items = rss.match(/<item[\s\S]*?<\/item>/gi) || [];

  const topics: any[] = [];
  for (const item of items.slice(0, 40)) {
    const title = pickTag(item, "title");
    if (!title) continue;

    const link = pickTag(item, "link");
    const description = pickTag(item, "description").replace(/<[^>]+>/g, "").slice(0, 240);
    const pubDate = pickTag(item, "pubDate");

    topics.push({
      topic: title,
      search_volume: "alto",
      category: guessCategory(`${title} ${description}`, categories),
      context: description || null,
      source_name: sourceName,
      source_url: link || sourceBaseUrl,
      published_at: pubDate ? new Date(pubDate).toISOString() : null,
    });
  }
  return topics;
}

// ── SOURCE_DISCOVERY: feeds de veículos confiáveis ───────────────────────
// Além do Google Trends, a coleta lê diretamente os principais veículos.
// Isso garante assunto real, com link e data de publicação verificáveis.

const TRUSTED_FEEDS: Array<{ name: string; url: string; region: string }> = [
  { name: "G1", url: "https://g1.globo.com/rss/g1/", region: "BR" },
  { name: "CNN Brasil", url: "https://www.cnnbrasil.com.br/feed/", region: "BR" },
  { name: "Agência Brasil", url: "https://agenciabrasil.ebc.com.br/rss/ultimasnoticias/feed.xml", region: "BR" },
  { name: "Folha de S.Paulo", url: "https://feeds.folha.uol.com.br/emcimadahora/rss091.xml", region: "BR" },
  { name: "UOL", url: "https://rss.uol.com.br/feed/noticias.xml", region: "BR" },
  { name: "InfoMoney", url: "https://www.infomoney.com.br/feed/", region: "BR" },
  { name: "BBC Brasil", url: "https://feeds.bbci.co.uk/portuguese/rss.xml", region: "World" },
  { name: "The Guardian", url: "https://www.theguardian.com/world/rss", region: "World" },
];

async function collectTrustedFeedTopics(categories: string[]): Promise<any[]> {
  const results = await Promise.all(
    TRUSTED_FEEDS.map(async (feed) => {
      const xml = await fetchText(feed.url);
      if (!xml) return [];
      const items = parseRssItems(xml, 15);
      return items.map((item) => ({
        topic: item.title,
        search_volume: "alto",
        category: guessCategory(`${item.title} ${item.description}`, categories),
        context: item.description || null,
        source_name: feed.name,
        source_url: item.link || feed.url,
        published_at: item.pubDate,
        region: feed.region,
      }));
    }),
  );
  const flat = results.flat();
  console.log(`[fetch-trends] Veículos confiáveis: ${flat.length} matérias coletadas`);
  return flat;
}

// ── TREND_SCORING: cruzamento de fontes + pontuação ──────────────────────

const PRIORITY_SCORING_LIMIT = 30; // quantos assuntos passam pelo cruzamento de fontes

async function scoreTopics(topics: any[], priorityCategories: string[]): Promise<any[]> {
  const now = Date.now();
  const ageHoursOf = (t: any) =>
    t.published_at ? Math.max(0, (now - new Date(t.published_at).getTime()) / 3600000) : 6;

  // Os assuntos com maior volume declarado entram primeiro no cruzamento de fontes.
  const ordered = [...topics].sort((a, b) => {
    const va = parseInt(String(a.search_volume).replace(/[^0-9]/g, ""), 10) || 0;
    const vb = parseInt(String(b.search_volume).replace(/[^0-9]/g, ""), 10) || 0;
    return vb - va;
  });
  const toCrossCheck = new Set(ordered.slice(0, PRIORITY_SCORING_LIMIT).map((t) => t.topic));

  const scored: any[] = [];
  for (let i = 0; i < topics.length; i += 5) {
    const batch = topics.slice(i, i + 5);
    const done = await Promise.all(
      batch.map(async (t) => {
        const own = classifySource(t.source_url || "", t.source_name || "");
        let sources: SourceRef[] = [];
        if (toCrossCheck.has(t.topic)) {
          try {
            sources = await discoverSources(t.topic, 8);
          } catch (err) {
            console.warn(`[scoreTopics] cruzamento falhou para "${t.topic}":`, err);
          }
        }
        if (t.source_url && !sources.some((s) => s.source_url === t.source_url)) {
          sources.unshift({
            source_url: t.source_url,
            source_name: t.source_name || own.name,
            source_type: own.type,
            published_at: t.published_at || null,
            accessed_at: new Date().toISOString(),
            reliability_score: own.reliability,
            title: t.topic,
            snippet: t.context || "",
          });
        }
        const trusted = sources.filter((s) => s.reliability_score >= 0.75);
        const avgReliability = sources.length
          ? sources.reduce((sum, s) => sum + s.reliability_score, 0) / sources.length
          : 0.5;
        const score = computeTrendScore({
          searchVolume: t.search_volume,
          sourceCount: sources.length,
          avgReliability,
          ageHours: ageHoursOf(t),
          isPriorityCategory: priorityCategories.includes(t.category),
        });
        // Validação: precisa de pelo menos 2 fontes independentes confiáveis.
        const validation_status = trusted.length >= 2 ? "verified" : sources.length >= 1 ? "pending" : "unverified";
        return {
          ...t,
          sources,
          source_count: sources.length,
          validation_status,
          ...score,
        };
      }),
    );
    scored.push(...done);
  }
  return scored;
}



// ── JSON Extraction / Repair ─────────────────────────────────────────────

function extractTopicsFromAIResponse(raw: string): any[] {
  if (!raw || !raw.trim()) {
    console.warn("[extract] Empty AI response");
    return [];
  }

  console.log(`[extract] Raw response starts with: ${raw.substring(0, 100)}`);
  
  let text = raw.replace(/```json\n?/gi, "").replace(/```\n?/g, "").trim();
  // Remove control chars
  text = text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");

  // Try direct parse
  const tryParse = (s: string): any[] | null => {
    try {
      const parsed = JSON.parse(s);
      if (Array.isArray(parsed)) return parsed;
      if (parsed && Array.isArray(parsed.topics)) return parsed.topics;
      if (parsed && typeof parsed === 'object') return [parsed];
      return null;
    } catch { return null; }
  };

  let result = tryParse(text);
  if (result) return result;

  // Find first array boundary or object boundary
  const startIdx = Math.min(
    text.indexOf("[") === -1 ? Infinity : text.indexOf("["),
    text.indexOf("{") === -1 ? Infinity : text.indexOf("{")
  );

  if (startIdx === Infinity) {
    console.warn("[extract] No JSON boundary found");
    return [];
  }
  
  let slice = text.substring(startIdx);
  result = tryParse(slice);
  if (result) return result;

  // Repair: balance brackets/braces
  let braces = 0, brackets = 0;
  for (let i = 0; i < slice.length; i++) {
    const ch = slice[i];
    if (ch === "{") braces++;
    else if (ch === "}") braces--;
    else if (ch === "[") brackets++;
    else if (ch === "]") brackets--;
    
    // If we closed the main array/object, try parsing up to here
    if (braces === 0 && brackets === 0 && i > 0) {
      const sub = tryParse(slice.substring(0, i + 1));
      if (sub) return sub;
    }
  }

  // Final attempt: manual repair
  let repaired = slice.replace(/,\s*$/g, "");
  let tempBraces = braces;
  let tempBrackets = brackets;
  while (tempBraces > 0) { repaired += "}"; tempBraces--; }
  while (tempBrackets > 0) { repaired += "]"; tempBrackets--; }

  result = tryParse(repaired);
  if (result) return result;

  // Last resort: extract complete objects via regex
  const objects: any[] = [];
  const objRegex = /\{[^{}]*?\}/g;
  const matches = slice.match(objRegex) || [];
  for (const m of matches) {
    try { 
      const parsed = JSON.parse(m);
      if (parsed.topic || parsed.title) objects.push(parsed);
    } catch {}
  }
  console.warn(`[extract] Recovered ${objects.length} objects via regex fallback`);
  return objects;
}

// ── Handler ───────────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.text();
    let userId;
    try {
      const json = JSON.parse(body);
      userId = json.userId;
    } catch (e) {
      console.error("[fetch-trends] Failed to parse request body:", body);
      throw new Error("Invalid request body");
    }
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

    // Os filtros salvos em Tendências são apenas de exibição: a coleta sempre
    // busca todas as fontes para não reduzir o pool de assuntos dos artigos.
    const wantBR = true;
    const wantWorld = true;
    const wantPortalLeoDias = true;
    const wantGoogle = true;

    // Fetch trends from BR and US (conforme filtros definidos pelo usuário)
    const rssBR = wantBR && wantGoogle ? await fetchGoogleTrendsRSS("BR") : null;
    const rssUS = wantWorld && wantGoogle ? await fetchGoogleTrendsRSS("US") : null;
    
    if (wantGoogle && !rssBR && !rssUS && !wantPortalLeoDias) throw new Error("RSS do Google Trends não disponível no momento. Tente novamente em alguns minutos.");

    let topics: any[] = [];
    
    // Process BR trends
    if (rssBR) {
      console.log(`[fetch-trends] BR RSS fetched, length: ${rssBR.length}`);
      let brTopics: any[] = [];
      try {
        const { systemPrompt, userPrompt } = buildRSSCategorizationPrompt(rssBR, categories, "BR");
        const { content, provider } = await callAI(providers, systemPrompt, userPrompt);
        brTopics = extractTopicsFromAIResponse(content);
      } catch (aiErr: any) {
        console.warn("[fetch-trends] BR AI parsing failed:", aiErr.message);
      }
      if (!brTopics.length) brTopics = parseRSSDirectly(rssBR, categories, "BR");
      topics = [...topics, ...brTopics];
    }
    
    // Process US trends
    if (rssUS) {
      console.log(`[fetch-trends] US RSS fetched, length: ${rssUS.length}`);
      let usTopics: any[] = [];
      try {
        const { systemPrompt, userPrompt } = buildRSSCategorizationPrompt(rssUS, categories, "US");
        const { content, provider } = await callAI(providers, systemPrompt, userPrompt);
        usTopics = extractTopicsFromAIResponse(content);
      } catch (aiErr: any) {
        console.warn("[fetch-trends] US AI parsing failed:", aiErr.message);
      }
      if (!usTopics.length) usTopics = parseRSSDirectly(rssUS, categories, "US");
      topics = [...topics, ...usTopics];
    }

    // Process Portal Leo Dias feed (somente se a fonte estiver habilitada nos filtros salvos)
    const rssPLD = wantPortalLeoDias ? await fetchPortalLeoDiasRSS() : null;
    if (rssPLD) {
      console.log(`[fetch-trends] Portal Leo Dias RSS fetched, length: ${rssPLD.length}`);
      const pldTopics = parseStandardRSS(rssPLD, categories, "Portal Leo Dias", "https://portalleodias.com/");
      if (pldTopics.length) {
        topics = [...topics, ...pldTopics];
        console.log(`[fetch-trends] Portal Leo Dias topics extracted: ${pldTopics.length}`);
      }
    }

    if (!topics.length) {
      throw new Error("Não foi possível extrair tópicos dos feeds. O formato dos feeds pode ter mudado.");
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
