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
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch user settings
    const { data: settings } = await supabase
      .from("user_settings")
      .select("*")
      .eq("user_id", userId)
      .single();

    const categories = settings?.categories || ["esportes", "politica", "policia", "saude", "celebridades", "financas"];

    // Fetch trending topics that haven't been used
    const { data: topics } = await supabase
      .from("trending_topics")
      .select("*")
      .eq("user_id", userId)
      .eq("used", false)
      .limit(10);

    // If no trends, use fallback topics
    const topicsToUse = topics && topics.length > 0
      ? topics
      : categories.map((cat: string) => ({
          topic: getDefaultTopic(cat),
          category: cat,
          id: null,
        }));

    const articlesPerDay = settings?.articles_per_day || 10;
    const intervalHours = 24 / articlesPerDay;
    const now = new Date();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const generatedArticles = [];

    for (let i = 0; i < Math.min(articlesPerDay, topicsToUse.length); i++) {
      const topic = topicsToUse[i];
      const scheduledAt = new Date(now.getTime() + i * intervalHours * 60 * 60 * 1000);

      try {
        // Generate article content
        const articleResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
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
                content: `Você é um jornalista brasileiro especializado. Escreva artigos completos em português do Brasil, formato HTML para WordPress.
                
Regras:
- Título atrativo com menos de 60 caracteres
- Mínimo 800 palavras
- Use subtítulos H2 e H3
- Parágrafos curtos e escaneáveis
- SEO otimizado
- Linguagem jornalística profissional
- Tom informativo e engajante

Responda APENAS em JSON válido com este formato:
{
  "title": "título do artigo",
  "content": "<h2>...</h2><p>...</p>...",
  "excerpt": "resumo de 2 frases",
  "seo_keyword": "palavra-chave principal",
  "seo_title": "título SEO até 60 caracteres",
  "meta_description": "meta descrição até 155 caracteres"
}`,
              },
              {
                role: "user",
                content: `Escreva um artigo completo sobre: "${topic.topic}" na categoria ${topic.category}. O artigo deve ser atual, relevante e bem pesquisado.`,
              },
            ],
          }),
        });

        if (!articleResponse.ok) {
          console.error(`AI error for topic ${topic.topic}: ${articleResponse.status}`);
          continue;
        }

        const aiData = await articleResponse.json();
        let articleContent = aiData.choices?.[0]?.message?.content || "";

        // Clean JSON from markdown code blocks
        articleContent = articleContent.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();

        let parsed;
        try {
          parsed = JSON.parse(articleContent);
        } catch {
          console.error("Failed to parse AI response for topic:", topic.topic);
          continue;
        }

        // Generate featured image
        let featuredImageUrl = null;
        try {
          const imageResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${LOVABLE_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "google/gemini-2.5-flash-image",
              messages: [
                {
                  role: "user",
                  content: `Create a professional news article featured image for the topic: "${parsed.title}". The image should be photorealistic, editorial style, suitable for a news website. No text in the image. High quality, 16:9 aspect ratio.`,
                },
              ],
              modalities: ["image", "text"],
            }),
          });

          if (imageResponse.ok) {
            const imageData = await imageResponse.json();
            const imageUrl = imageData.choices?.[0]?.message?.images?.[0]?.image_url?.url;
            if (imageUrl) {
              featuredImageUrl = imageUrl;
            }
          }
        } catch (imgErr) {
          console.error("Image generation failed:", imgErr);
        }

        // Save to database
        const { data: article, error: insertError } = await supabase.from("articles").insert({
          user_id: userId,
          title: parsed.title,
          content: parsed.content,
          excerpt: parsed.excerpt,
          category: topic.category,
          seo_keyword: parsed.seo_keyword,
          seo_title: parsed.seo_title,
          meta_description: parsed.meta_description,
          featured_image_url: featuredImageUrl,
          status: settings?.auto_publish ? "ready" : "draft",
          scheduled_at: scheduledAt.toISOString(),
          trending_topic: topic.topic,
        }).select().single();

        if (insertError) {
          console.error("Insert error:", insertError);
          continue;
        }

        // Mark topic as used
        if (topic.id) {
          await supabase.from("trending_topics").update({ used: true }).eq("id", topic.id);
        }

        generatedArticles.push(article);

        // Rate limiting - wait between requests
        await new Promise((resolve) => setTimeout(resolve, 2000));
      } catch (err) {
        console.error(`Error generating article for ${topic.topic}:`, err);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `${generatedArticles.length} artigos gerados com sucesso!`,
        articles: generatedArticles.length,
      }),
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
