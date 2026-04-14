import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { analytics } = await req.json();
    if (!analytics) throw new Error("analytics data is required");

    // Get user's Gemini API key from settings
    const authHeader = req.headers.get("Authorization");
    let geminiApiKey: string | null = null;

    if (authHeader) {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
      const sb = createClient(supabaseUrl, supabaseKey, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: { user } } = await sb.auth.getUser();
      if (user) {
        const { data: settings } = await sb.from("user_settings").select("gemini_api_key").eq("user_id", user.id).maybeSingle();
        if (settings?.gemini_api_key) {
          // Decrypt if needed
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

    let content: string | null = null;

    // Try user's Gemini API key first
    if (geminiApiKey) {
      try {
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiApiKey}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
              generationConfig: { temperature: 0.7 },
            }),
          }
        );
        if (res.ok) {
          const d = await res.json();
          content = d.candidates?.[0]?.content?.parts?.[0]?.text || null;
          console.log("Tips generated via user Gemini key");
        } else {
          console.warn("Gemini API failed:", res.status);
        }
      } catch (e) {
        console.warn("Gemini error:", e);
      }
    }

    // Fallback to Lovable AI
    if (!content) {
      const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
      if (!LOVABLE_API_KEY) throw new Error("Nenhuma API de IA configurada. Configure sua chave Gemini nas configurações.");

      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [{ role: "user", content: prompt }],
          temperature: 0.7,
        }),
      });

      if (!response.ok) {
        throw new Error(`AI API error: ${response.status}`);
      }

      const data = await response.json();
      content = data.choices?.[0]?.message?.content || "[]";
    }

    // Parse the JSON from the AI response
    const jsonMatch = (content || "[]").match(/\[[\s\S]*\]/);
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
