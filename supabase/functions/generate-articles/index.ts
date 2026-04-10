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
                content: `Você é um jornalista digital brasileiro sênior, especialista em SEO avançado e redação para WordPress com Yoast SEO e Jetpack.

REGRAS OBRIGATÓRIAS PARA CADA ARTIGO:

1. TÍTULO (H1):
   - Máximo 60 caracteres
   - DEVE conter a palavra-chave principal (focus keyword)
   - Atrativo, clicável, formato jornalístico

2. CONTEÚDO EM HTML (para WordPress):
   - MÍNIMO 1800 caracteres e MÁXIMO 2400 caracteres no HTML total
   - Comece com um parágrafo introdutório forte (lead jornalístico) que contenha a palavra-chave principal nas primeiras 100 palavras
   - Use <h2> para subtítulos principais (2-3 subtítulos H2) — cada H2 em <strong> também
   - Use <h3> para sub-subtítulos (1-2 H3) — cada H3 em <strong> também
   - NUNCA use <h1> no conteúdo (o título do post já é H1)
   - Parágrafos curtos (máx 3 linhas) com tags <p>
   - Use <strong> para destacar a palavra-chave e termos importantes no texto
   - Use <ul>/<li> quando fizer sentido para escaneabilidade
   - A palavra-chave principal DEVE aparecer: no primeiro parágrafo, em pelo menos 1 subtítulo H2, e distribuída naturalmente pelo texto (densidade 1-2%)
   - Termine com um parágrafo de conclusão/call-to-action

3. ESTILO JORNALÍSTICO:
   - Mescle notícia trending com valor evergreen
   - Tom informativo, autoritativo mas acessível
   - Inclua dados ou contexto relevante
   - Evite linguagem de IA ou frases genéricas

4. SEO (Yoast SEO + Jetpack):
   - seo_keyword: palavra-chave principal de cauda longa (3-5 palavras) — esta é a FOCUS KEYWORD do Yoast
   - seo_title: até 60 caracteres, com a keyword NO INÍCIO, formato: "Keyword - Complemento | Site"
   - meta_description: EXATAMENTE entre 120-155 caracteres, com a keyword na primeira metade e um call-to-action sutil no final
   - excerpt: resumo em 2 frases curtas (máx 160 caracteres) otimizado para compartilhamento em redes sociais (Jetpack)
   - slug: versão da keyword em formato URL (minúsculas, hífens, sem acentos)

5. IMAGEM DE DESTAQUE:
   - image_alt: texto alternativo descritivo da imagem contendo a keyword (para SEO de imagens)
   - image_caption: legenda curta e informativa para a imagem`,
              },
              {
                role: "user",
                content: `Escreva um artigo jornalístico completo sobre: "${topic.topic}" (categoria: ${topic.category}).

Data de hoje: ${new Date().toLocaleDateString("pt-BR")}.

IMPORTANTE:
- O conteúdo HTML DEVE ter entre 1800 e 2400 caracteres
- A palavra-chave principal deve aparecer no título, primeiro parágrafo, pelo menos 1 H2, e na meta description
- Todos os campos SEO devem estar preenchidos corretamente para pontuação verde no Yoast SEO
- Subtítulos devem estar em negrito
- Gere também os metadados para a imagem de destaque`,
              },
            ],
            tools: [
              {
                type: "function",
                function: {
                  name: "create_article",
                  description: "Cria um artigo completo para publicação no WordPress com todos os campos SEO (Yoast + Jetpack) preenchidos corretamente.",
                  parameters: {
                    type: "object",
                    properties: {
                      title: {
                        type: "string",
                        description: "Título H1 do artigo, máximo 60 caracteres, contendo a focus keyword"
                      },
                      content: {
                        type: "string",
                        description: "Conteúdo completo do artigo em HTML (h2, h3, p, strong, ul/li). MÍNIMO 1800 e MÁXIMO 2400 caracteres. Subtítulos em negrito. Keyword distribuída naturalmente."
                      },
                      excerpt: {
                        type: "string",
                        description: "Resumo em 2 frases curtas (máx 160 chars) para redes sociais (Jetpack sharing)"
                      },
                      seo_keyword: {
                        type: "string",
                        description: "Focus keyword do Yoast SEO: palavra-chave de cauda longa (3-5 palavras)"
                      },
                      seo_title: {
                        type: "string",
                        description: "Título SEO (Yoast) até 60 chars, keyword no início"
                      },
                      meta_description: {
                        type: "string",
                        description: "Meta descrição (Yoast) entre 120-155 chars com keyword na primeira metade e CTA sutil"
                      },
                      slug: {
                        type: "string",
                        description: "Slug para URL: keyword em minúsculas, sem acentos, separada por hífens"
                      },
                      image_alt: {
                        type: "string",
                        description: "Texto alternativo da imagem de destaque contendo a keyword"
                      },
                      image_caption: {
                        type: "string",
                        description: "Legenda curta para a imagem de destaque"
                      }
                    },
                    required: ["title", "content", "excerpt", "seo_keyword", "seo_title", "meta_description", "slug", "image_alt", "image_caption"],
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

        // Validar campos obrigatórios e tamanho do conteúdo
        if (!parsed.title || !parsed.content) {
          console.error("Missing required fields for topic:", topic.topic);
          continue;
        }

        // Validar tamanho mínimo do conteúdo
        const contentLength = parsed.content.length;
        if (contentLength < 1800) {
          console.warn(`Content too short (${contentLength} chars) for topic: ${topic.topic}, but proceeding`);
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
