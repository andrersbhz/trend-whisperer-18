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
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
      }
    });
    if (!resp.ok) return null;
    return await resp.text();
  } catch (err) {
    console.error(`[RSS] Error:`, err);
    return null;
  }
}

// ── AI Prompt ─────────────────────────────────────────────────────────────

function buildRSSCategorizationPrompt(rssContent: string, categories: string[]) {
  const systemPrompt = `Você é um analista de tendências. Abaixo está um feed RSS do Google Trends Brasil.
Sua tarefa é extrair os tópicos e categorizá-los.

REGRAS:
1. Extraia o título do tópico (<title>), o volume de buscas (<ht:approx_traffic>) e o contexto da notícia (<ht:news_item_title>).
2. Atribua uma categoria: ${categories.join(", ")}.
3. Retorne APENAS um JSON válido no formato:
[{"topic": "nome", "search_volume": "vol", "category": "cat", "context": "título da notícia real"}]

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
    if (!rss) throw new Error("RSS not available");

    const { systemPrompt, userPrompt } = buildRSSCategorizationPrompt(rss, categories);
    const { content } = await callAI(providers, systemPrompt, userPrompt);
    
    const cleaned = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const topics = JSON.parse(cleaned);

    await supabase.from("trending_topics").delete().eq("user_id", userId).eq("used", false);
    
    // Atualizar timestamp da última busca nas configurações do usuário
    await supabase.from("user_settings").update({ 
      last_trends_fetch: new Date().toISOString() 
    }).eq("user_id", userId);
    
    if (topics.length > 0) {
      await supabase.from("trending_topics").insert(
        topics.map((t: any) => ({
          user_id: userId,
          topic: t.topic,
          category: t.category,
          search_volume: t.search_volume,
          context: t.context,
        }))
      );
    }

    return new Response(JSON.stringify({ success: true, count: topics.length }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
