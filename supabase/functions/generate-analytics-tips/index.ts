import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { analytics, socialMetrics } = await req.json();
    if (!analytics && !socialMetrics) throw new Error("analytics or socialMetrics data is required");

    const authHeader = req.headers.get("Authorization");
    let geminiApiKey: string | null = null;
    let geminiModel = "gemini-3.6-flash";

    if (authHeader) {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
      const sb = createClient(supabaseUrl, supabaseKey, { global: { headers: { Authorization: authHeader } } });
      const { data: { user } } = await sb.auth.getUser();
      if (user) {
        const { data: settings } = await sb.from("user_settings").select("gemini_api_key, gemini_model").eq("user_id", user.id).maybeSingle();
        geminiModel = settings?.gemini_model || geminiModel;
        if (settings?.gemini_api_key) {
          const raw = settings.gemini_api_key;
          if (raw.startsWith("ENCRYPTED:")) {
            const { data: decrypted } = await sb.rpc("decrypt_credential", { val: raw, enc_key: "" });
            geminiApiKey = decrypted || null;
          } else {
            geminiApiKey = raw;
          }
        }
      }
    }

    const prompt = `Analise estes dados de Analytics e Redes Sociais de um blog brasileiro de notícias e gere exatamente 5 dicas práticas e acionáveis para melhorar o engajamento e crescimento:\n\nDados do Site:\n${analytics ? `- Pageviews: ${analytics.pageviews}\n- Sessões: ${analytics.sessions}\n- Usuários: ${analytics.users}\n- Taxa de Rejeição: ${analytics.bounceRate}%\n- Duração Média: ${analytics.avgSessionDuration}\n- Páginas mais visitadas: ${JSON.stringify(analytics.topPages)}\n- Fontes de tráfego: ${JSON.stringify(analytics.trafficSources)}` : "Dados do site não disponíveis."}\n\nDados de Redes Sociais:\n${socialMetrics ? `- Facebook Engajamento: ${socialMetrics.summary?.total_facebook || 0} posts\n- Instagram Engajamento: ${socialMetrics.summary?.total_instagram || 0} posts\n- Compartilhamentos: ${socialMetrics.summary?.total_shared_social || 0}\n- Redes conectadas: ${JSON.stringify(socialMetrics.jetpack?.shares_by_network || {})}` : "Dados de redes sociais não disponíveis."}\n\nResponda APENAS com um JSON array, sem markdown, sem explicação. Cada item deve ter:\n- "category": uma dessas (SEO, Conteúdo, Redes Sociais, Experiência do Usuário, Tráfego)\n- "tip": a dica em português do Brasil, clara e específica\n- "priority": "alta", "média" ou "baixa"`;

    let content: string | null = null;

    if (geminiApiKey) {
      try {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(geminiModel)}:generateContent?key=${encodeURIComponent(geminiApiKey)}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.7 } }),
        });
        if (res.ok) {
          const d = await res.json();
          content = d.candidates?.[0]?.content?.parts?.[0]?.text || null;
          console.log(`Tips generated via user Gemini key (${geminiModel})`);
        } else {
          console.warn("Gemini API failed:", res.status);
        }
      } catch (e) {
        console.warn("Gemini error:", e);
      }
    }

    const fallbackTips = [
      { category: "SEO", tip: "Otimize meta descriptions e títulos das páginas mais visitadas para aumentar o CTR nos resultados de busca.", priority: "alta" },
      { category: "Conteúdo", tip: `Sua taxa de rejeição está em ${analytics?.bounceRate ?? 0}%. Melhore a introdução dos artigos e adicione links internos para reter leitores.`, priority: "alta" },
      { category: "Redes Sociais", tip: "Compartilhe os artigos mais visitados no Facebook e Instagram nos horários de pico (12h e 19h).", priority: "média" },
      { category: "Experiência do Usuário", tip: "Verifique a velocidade de carregamento mobile — páginas lentas aumentam a rejeição.", priority: "alta" },
      { category: "Tráfego", tip: "Diversifique fontes de tráfego investindo em SEO de cauda longa e parcerias com outros blogs do nicho.", priority: "média" },
    ];

    let warning: string | null = null;
    if (!content) {
      const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
      if (!LOVABLE_API_KEY) {
        return new Response(JSON.stringify({ tips: fallbackTips, warning: "Nenhuma chave de IA configurada. Mostrando dicas padrão." }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      try {
        const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({ model: "google/gemini-3.6-flash", messages: [{ role: "user", content: prompt }], temperature: 0.7 }),
        });

        if (response.status === 402) {
          return new Response(JSON.stringify({ tips: fallbackTips, warning: "Créditos de IA esgotados. Configure sua chave Gemini gratuita nas Configurações para dicas personalizadas." }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
        if (response.status === 429) {
          return new Response(JSON.stringify({ tips: fallbackTips, warning: "Limite de requisições atingido. Tente novamente em alguns minutos." }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
        if (!response.ok) warning = `IA indisponível (${response.status}). Mostrando dicas padrão.`;
        else {
          const data = await response.json();
          content = data.choices?.[0]?.message?.content || null;
        }
      } catch (e) {
        console.error("Lovable AI error:", e);
        warning = "Erro ao contatar IA. Mostrando dicas padrão.";
      }
    }

    let tips = fallbackTips;
    if (content) {
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[0]);
          if (Array.isArray(parsed) && parsed.length > 0) tips = parsed;
        } catch {
          warning = "Resposta da IA inválida. Mostrando dicas padrão.";
        }
      }
    }

    return new Response(JSON.stringify({ tips, ...(warning ? { warning } : {}) }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error: any) {
    console.error("generate-analytics-tips error:", error);
    return new Response(JSON.stringify({
      tips: [
        { category: "SEO", tip: "Otimize títulos e meta descriptions das páginas mais visitadas.", priority: "alta" },
        { category: "Conteúdo", tip: "Reduza a taxa de rejeição melhorando a introdução dos artigos.", priority: "alta" },
        { category: "Redes Sociais", tip: "Publique nos horários de pico (12h e 19h).", priority: "média" },
      ],
      warning: error.message || "Erro ao gerar dicas",
    }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
