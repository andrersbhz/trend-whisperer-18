import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { prompt } = await req.json();
    if (!prompt || typeof prompt !== "string" || prompt.trim().length < 3) {
      return new Response(JSON.stringify({ error: "Prompt inválido. Descreva a imagem desejada." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const lovableKey = Deno.env.get("LOVABLE_API_KEY");
    if (!lovableKey) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY não configurada no servidor." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const models = ["google/gemini-3.1-flash-image", "google/gemini-2.5-flash-image", "google/gemini-3-pro-image"];
    let imageUrl: string | null = null;
    const errors: string[] = [];

    for (const model of models) {
      try {
        const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${lovableKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model,
            messages: [{ role: "user", content: [{ type: "text", text: prompt }] }],
            modalities: ["image", "text"],
          }),
        });

        if (!resp.ok) {
          const text = (await resp.text()).slice(0, 400);
          if (resp.status === 429) {
            return new Response(JSON.stringify({ error: "Muitas requisições. Aguarde alguns segundos e tente novamente." }), {
              status: 200,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
          if (resp.status === 402) {
            return new Response(JSON.stringify({ error: "O saldo de IA do workspace acabou. Vá em Configurações → Cloud & AI balance e adicione fundos para continuar gerando imagens." }), {
              status: 200,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
          errors.push(`${model}: ${resp.status} ${text}`);
          continue;
        }

        const data = await resp.json();
        const url = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;
        if (url) {
          imageUrl = url;
          break;
        }
        errors.push(`${model}: sem imagem no retorno`);
      } catch (e) {
        errors.push(`${model}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    if (!imageUrl) {
      return new Response(JSON.stringify({ error: `Falha ao gerar imagem. ${errors.join(" | ").slice(0, 400)}` }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ imageUrl }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
