import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const IMAGE_PROMPT_TEMPLATE = (title: string, category: string) =>
  `Create a professional, photorealistic news article featured image about: "${title}" (category: ${category}). Requirements: Editorial/journalistic style, visually represents the article topic, NO text overlay, NO watermarks, NO logos, high quality, 16:9 aspect ratio, vibrant colors, professional lighting, suitable as a WordPress featured image.`;

async function generateImageGemini(apiKey: string, title: string, category: string): Promise<string | null> {
  const models = ["gemini-3.1-flash-image-preview", "gemini-2.5-flash-image"];
  for (const model of models) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
      const resp = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
        body: JSON.stringify({
          contents: [{ parts: [{ text: IMAGE_PROMPT_TEMPLATE(title, category) }] }],
          generationConfig: { responseModalities: ["IMAGE", "TEXT"] },
        }),
      });
      if (!resp.ok) { console.warn(`Gemini image ${model} failed ${resp.status}`); continue; }
      const data = await resp.json();
      const parts = data.candidates?.[0]?.content?.parts || [];
      const imgPart = parts.find((p: any) => p.inlineData?.mimeType?.startsWith("image/"));
      if (imgPart?.inlineData) {
        return `data:${imgPart.inlineData.mimeType};base64,${imgPart.inlineData.data}`;
      }
    } catch (err) { console.warn(`Gemini image ${model} error:`, err); }
  }
  return null;
}

async function generateImageGateway(lovableApiKey: string, title: string, category: string): Promise<string | null> {
  try {
    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${lovableApiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3.1-flash-image-preview",
        messages: [{ role: "user", content: IMAGE_PROMPT_TEMPLATE(title, category) }],
        modalities: ["image", "text"],
      }),
    });
    if (!resp.ok) return null;
    const data = await resp.json();
    return data.choices?.[0]?.message?.images?.[0]?.image_url?.url || null;
  } catch { return null; }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { userId, articleIds } = await req.json();
    if (!userId || !articleIds?.length) throw new Error("userId and articleIds are required");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get Gemini key
    const { data: settings } = await supabase.from("user_settings").select("gemini_api_key").eq("user_id", userId).single();
    let geminiApiKey: string | null = null;
    if (settings?.gemini_api_key) {
      const { data: decrypted } = await supabase.rpc("decrypt_credential", { enc_key: "", val: settings.gemini_api_key });
      if (decrypted && typeof decrypted === "string" && decrypted.length > 5) geminiApiKey = decrypted;
    }
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!geminiApiKey && !LOVABLE_API_KEY) throw new Error("Nenhuma chave de IA configurada.");

    // Fetch articles without images
    const { data: articles } = await supabase
      .from("articles")
      .select("id, title, category, featured_image_url")
      .eq("user_id", userId)
      .in("id", articleIds);

    if (!articles?.length) throw new Error("Nenhum artigo encontrado.");

    let updated = 0;
    for (const article of articles) {
      if (article.featured_image_url) { console.log(`Skipping ${article.id} - already has image`); continue; }

      let imageUrl: string | null = null;
      if (geminiApiKey) imageUrl = await generateImageGemini(geminiApiKey, article.title, article.category);
      if (!imageUrl && LOVABLE_API_KEY) imageUrl = await generateImageGateway(LOVABLE_API_KEY, article.title, article.category);

      if (imageUrl) {
        await supabase.from("articles").update({ featured_image_url: imageUrl }).eq("id", article.id);
        updated++;
        console.log(`Image generated for article: ${article.title}`);
      } else {
        console.warn(`Failed to generate image for: ${article.title}`);
      }
      await new Promise(r => setTimeout(r, 2000));
    }

    return new Response(
      JSON.stringify({ success: true, message: `${updated} imagens geradas com sucesso!`, updated }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("regenerate-image error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
