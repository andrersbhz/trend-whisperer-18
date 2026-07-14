import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function slugify(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

async function fileToBase64(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Falha ao baixar arquivo (${res.status})`);
  const buf = new Uint8Array(await res.arrayBuffer());
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < buf.length; i += chunk) {
    binary += String.fromCharCode(...buf.subarray(i, i + chunk));
  }
  return btoa(binary);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { userId, knowledgeId, category, title } = await req.json();
    if (!userId || !knowledgeId) {
      return new Response(
        JSON.stringify({ error: "userId e knowledgeId são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: entry, error: entryErr } = await supabase
      .from("knowledge_entries")
      .select("*")
      .eq("id", knowledgeId)
      .eq("user_id", userId)
      .maybeSingle();

    if (entryErr || !entry) throw new Error("Entrada de conhecimento não encontrada");

    const { data: settings } = await supabase
      .from("user_settings")
      .select("writer_prompt, categories")
      .eq("user_id", userId)
      .maybeSingle();

    const cats: string[] = (settings?.categories as string[]) || [
      "policia", "celebridades", "politica", "esportes", "saude", "financas",
    ];
    const finalCategory = category && cats.includes(category) ? category : (cats[0] || "geral");
    const finalTitleHint = title?.trim() || entry.title;

    // Build user prompt content blocks
    const contentBlocks: any[] = [
      {
        type: "text",
        text:
          `${settings?.writer_prompt || "Você é um jornalista experiente. Escreva com fatos, SEO e verdade."}\n\n` +
          `Baseie-se ESTRITAMENTE no material de referência a seguir (base de conhecimento do usuário).\n` +
          `Título sugerido: "${finalTitleHint}"\n` +
          `Categoria: "${finalCategory}"\n\n` +
          `Retorne SOMENTE um JSON válido com os campos:\n` +
          `{"title":"...","content":"HTML completo do artigo, 1500-2500 palavras, com <h2>, <h3>, <p>, <ul>","excerpt":"...","seo_keyword":"...","seo_title":"...","meta_description":"...","slug":"...","image_alt":"...","image_caption":""}`,
      },
    ];

    if (entry.content && entry.content.trim().length > 0) {
      contentBlocks.push({
        type: "text",
        text: `\n\n=== MATERIAL DE REFERÊNCIA (texto) ===\n${entry.content.slice(0, 60000)}`,
      });
    }

    if (entry.file_path) {
      const { data: signed } = await supabase.storage
        .from("knowledge-files")
        .createSignedUrl(entry.file_path, 300);
      if (signed?.signedUrl) {
        const b64 = await fileToBase64(signed.signedUrl);
        const mime = entry.file_type || "application/pdf";
        contentBlocks.push({
          type: "file",
          file: {
            filename: entry.file_name || "referencia.pdf",
            file_data: `data:${mime};base64,${b64}`,
          },
        });
      }
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY não configurada");

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "user", content: contentBlocks }],
        response_format: { type: "json_object" },
      }),
    });

    if (!aiRes.ok) {
      const text = await aiRes.text();
      if (aiRes.status === 429) throw new Error("Limite de requisições da IA atingido. Aguarde e tente novamente.");
      if (aiRes.status === 402) throw new Error("Créditos da IA esgotados. Adicione créditos no workspace.");
      throw new Error(`IA retornou ${aiRes.status}: ${text.slice(0, 300)}`);
    }

    const aiJson = await aiRes.json();
    const raw = aiJson?.choices?.[0]?.message?.content || "{}";
    let parsed: any = {};
    try {
      parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    } catch {
      const match = String(raw).match(/\{[\s\S]*\}/);
      parsed = match ? JSON.parse(match[0]) : {};
    }

    if (!parsed.title || !parsed.content) {
      throw new Error("A IA não retornou um artigo válido.");
    }

    const slug = parsed.slug ? slugify(parsed.slug) : slugify(parsed.title);

    const { data: inserted, error: insertErr } = await supabase
      .from("articles")
      .insert({
        user_id: userId,
        title: parsed.title,
        content: parsed.content,
        excerpt: parsed.excerpt || "",
        category: finalCategory,
        seo_keyword: parsed.seo_keyword || "",
        seo_title: parsed.seo_title || parsed.title,
        meta_description: parsed.meta_description || "",
        slug,
        status: "ready",
        source: "knowledge_base",
      })
      .select("id, title")
      .single();

    if (insertErr) throw insertErr;

    // Kick off image generation (fire-and-forget)
    try {
      await supabase.functions.invoke("regenerate-image", {
        body: { userId, articleIds: [inserted.id], force: true },
      });
    } catch (e) {
      console.warn("[generate-from-knowledge] image gen failed", e);
    }

    return new Response(
      JSON.stringify({
        success: true,
        articleId: inserted.id,
        title: inserted.title,
        message: `Artigo criado a partir da base de conhecimento.`,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err: any) {
    console.error("[generate-from-knowledge] error", err);
    return new Response(
      JSON.stringify({ success: false, error: err?.message || String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
