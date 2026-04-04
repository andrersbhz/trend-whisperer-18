import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
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

    // Fetch user settings for categories
    const { data: settings } = await supabase
      .from("user_settings")
      .select("categories")
      .eq("user_id", userId)
      .single();

    const categories = settings?.categories || ["esportes", "politica", "policia", "saude", "celebridades"];

    const categoryKeywords: Record<string, string[]> = {
      esportes: ["futebol brasileiro", "campeonato brasileiro", "seleção brasileira", "NBA Brasil", "UFC"],
      politica: ["política Brasil", "congresso nacional", "governo federal", "eleições Brasil"],
      policia: ["segurança pública Brasil", "operação policial", "criminalidade Brasil"],
      saude: ["saúde Brasil", "SUS", "bem-estar", "saúde mental", "fitness"],
      celebridades: ["celebridades brasileiras", "famosos Brasil", "novelas", "BBB"],
    };

    // Use AI to identify trending topics for each category
    const allTopics: Array<{ topic: string; category: string; search_volume: string }> = [];

    for (const category of categories) {
      const keywords = categoryKeywords[category] || [category];

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
                content: `Você é um analista de tendências de busca do Brasil. Identifique os assuntos mais buscados e comentados no Brasil HOJE nas categorias solicitadas.

Responda APENAS em JSON válido, array de objetos:
[
  {"topic": "assunto específico e atual", "search_volume": "alto/médio"},
  ...
]

Retorne exatamente 3 tópicos atuais e relevantes. Foque em notícias reais e eventos recentes.`,
              },
              {
                role: "user",
                content: `Quais são os 3 assuntos mais falados no Brasil HOJE na categoria "${category}"? Palavras-chave relacionadas: ${keywords.join(", ")}. Foque em assuntos reais e atuais de hoje, ${new Date().toLocaleDateString("pt-BR")}.`,
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
                allTopics.push({
                  topic: t.topic,
                  category,
                  search_volume: t.search_volume || "médio",
                });
              }
            }
          } catch {
            console.error("Failed to parse trends for category:", category);
          }
        }

        // Rate limiting
        await new Promise((r) => setTimeout(r, 1000));
      } catch (err) {
        console.error(`Error fetching trends for ${category}:`, err);
      }
    }

    // Delete old unused topics for this user
    await supabase
      .from("trending_topics")
      .delete()
      .eq("user_id", userId)
      .eq("used", false);

    // Insert new topics
    if (allTopics.length > 0) {
      await supabase.from("trending_topics").insert(
        allTopics.map((t) => ({
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
        message: `${allTopics.length} tendências encontradas em ${categories.length} categorias!`,
        topics: allTopics.length,
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
