import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { analytics } = await req.json();
    if (!analytics) throw new Error("analytics data is required");

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const prompt = `Analise estes dados do Google Analytics de um blog brasileiro de notícias e gere exatamente 5 dicas práticas e acionáveis para melhorar o desempenho:

Dados:
- Pageviews: ${analytics.pageviews}
- Sessões: ${analytics.sessions}
- Usuários: ${analytics.users}
- Taxa de Rejeição: ${analytics.bounceRate}%
- Duração Média: ${analytics.avgSessionDuration}
- Páginas mais visitadas: ${JSON.stringify(analytics.topPages)}
- Fontes de tráfego: ${JSON.stringify(analytics.trafficSources)}

Responda APENAS com um JSON array, sem markdown, sem explicação. Cada item deve ter:
- "category": uma dessas (SEO, Conteúdo, Redes Sociais, Experiência do Usuário, Tráfego)
- "tip": a dica em português do Brasil, clara e específica  
- "priority": "alta", "média" ou "baixa"

Exemplo: [{"category":"SEO","tip":"Otimize os meta descriptions...","priority":"alta"}]`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "openai/gpt-5-nano",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      throw new Error(`AI API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "[]";

    // Parse the JSON from the AI response
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    const tips = jsonMatch ? JSON.parse(jsonMatch[0]) : [];

    return new Response(JSON.stringify({ tips }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
