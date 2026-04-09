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
        // Usar tool calling para output estruturado — mais confiável que pedir JSON na mensagem
        const articleResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "openai/gpt-5-mini",
            messages: [
              {
                role: "system",
                content: `Você é um jornalista digital brasileiro sênior, especialista em SEO e redação para WordPress.

REGRAS OBRIGATÓRIAS PARA CADA ARTIGO:
1. TÍTULO: máximo 60 caracteres, contendo a palavra-chave principal, atrativo e clicável
2. CONTEÚDO EM HTML (para WordPress):
   - Máximo 2400 caracteres no total do HTML
   - Use tags <h2> e <h3> para subtítulos (nunca <h1>)
   - Parágrafos curtos (máx. 3 linhas) com tags <p>
   - Pelo menos 2 subtítulos H2 e 1 H3
   - Primeira frase deve ser um gancho forte (lead jornalístico)
   - Use <strong> para destacar termos importantes
   - Use <ul>/<li> quando fizer sentido para escaneabilidade
3. ESTILO JORNALÍSTICO:
   - Mescle notícia trending com valor evergreen (informação que permanece útil)
   - Tom informativo, autoritativo mas acessível
   - Inclua dados ou contexto que agreguem valor ao leitor
   - Evite linguagem de IA ou frases genéricas
4. SEO:
   - seo_keyword: palavra-chave principal de cauda longa (3-5 palavras)
   - seo_title: até 60 caracteres, com a keyword no início
   - meta_description: até 155 caracteres, com a keyword e call-to-action sutil
   - excerpt: resumo em 2 frases curtas para redes sociais`,
              },
              {
                role: "user",
                content: `Escreva um artigo jornalístico completo sobre: "${topic.topic}" (categoria: ${topic.category}).

Data de hoje: ${new Date().toLocaleDateString("pt-BR")}.

O artigo deve misturar a notícia atual com contexto relevante e informação evergreen. Foque em engajar o leitor brasileiro.`,
              },
            ],
            tools: [
              {
                type: "function",
                function: {
                  name: "create_article",
                  description: "Cria um artigo completo para publicação no WordPress com todos os campos SEO preenchidos.",
                  parameters: {
                    type: "object",
                    properties: {
                      title: {
                        type: "string",
                        description: "Título do artigo, máximo 60 caracteres, contendo a keyword"
                      },
                      content: {
                        type: "string",
                        description: "Conteúdo completo do artigo em HTML (h2, h3, p, strong, ul/li). Máximo 2400 caracteres."
                      },
                      excerpt: {
                        type: "string",
                        description: "Resumo em 2 frases curtas para redes sociais"
                      },
                      seo_keyword: {
                        type: "string",
                        description: "Palavra-chave principal de cauda longa (3-5 palavras)"
                      },
                      seo_title: {
                        type: "string",
                        description: "Título SEO até 60 caracteres, com keyword no início"
                      },
                      meta_description: {
                        type: "string",
                        description: "Meta descrição até 155 caracteres com keyword e CTA sutil"
                      }
                    },
                    required: ["title", "content", "excerpt", "seo_keyword", "seo_title", "meta_description"],
                    additionalProperties: false
                  }
                }
              }
            ],
            tool_choice: { type: "function", function: { name: "create_article" } },
          }),
        });

        if (!articleResponse.ok) {
          const errText = await articleResponse.text();
          console.error(`AI error for topic ${topic.topic}: ${articleResponse.status} - ${errText}`);

          // Handle rate limits
          if (articleResponse.status === 429) {
            console.log("Rate limited, waiting 10 seconds...");
            await new Promise((r) => setTimeout(r, 10000));
          }
          continue;
        }

        const aiData = await articleResponse.json();

        // Extrair dados do tool call
        let parsed;
        try {
          const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
          if (toolCall?.function?.arguments) {
            parsed = JSON.parse(toolCall.function.arguments);
          } else {
            // Fallback: tentar parse do content direto
            let content = aiData.choices?.[0]?.message?.content || "";
            content = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
            parsed = JSON.parse(content);
          }
        } catch {
          console.error("Failed to parse AI response for topic:", topic.topic);
          continue;
        }

        // Validar campos obrigatórios
        if (!parsed.title || !parsed.content) {
          console.error("Missing required fields for topic:", topic.topic);
          continue;
        }

        // Gerar imagem destacada
        let featuredImageUrl = null;
        try {
          const imageResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${LOVABLE_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "google/gemini-3.1-flash-image-preview",
              messages: [
                {
                  role: "user",
                  content: `Create a professional news article featured image for: "${parsed.title}". Photorealistic, editorial style, suitable for a news website. No text overlay. High quality, 16:9 aspect ratio, vibrant colors.`,
                },
              ],
              modalities: ["image", "text"],
            }),
          });

          if (imageResponse.ok) {
            const imageData = await imageResponse.json();
            const imageUrl = imageData.choices?.[0]?.message?.images?.[0]?.image_url?.url;
            if (imageUrl) featuredImageUrl = imageUrl;
          }
        } catch (imgErr) {
          console.error("Image generation failed:", imgErr);
        }

        // Salvar no banco de dados
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
          continue;
        }

        // Marcar tópico como usado
        if (topic.id) {
          await supabase.from("trending_topics").update({ used: true }).eq("id", topic.id);
        }

        generatedArticles.push(article);

        // Rate limiting — aguardar entre requisições
        await new Promise((resolve) => setTimeout(resolve, 3000));
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
