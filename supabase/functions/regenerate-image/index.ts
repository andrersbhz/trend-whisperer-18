import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { z } from "https://esm.sh/zod@3.25.76";
import { requireUserOrService } from "../_shared/security.ts";
import { generateRouterImage } from "../_shared/ninerouter-images.ts";
import { isAIImageFormat, requireImageFormat } from "../_shared/image-formats.ts";

const RequestSchema = z.object({
  userId: z.string().uuid(), articleIds: z.array(z.string().uuid()).min(1).max(100),
  force: z.boolean().optional().default(false), imageFormat: z.string().refine(isAIImageFormat),
});
const getErrorMessage = (error: unknown) => error instanceof Error ? error.message : "Erro ao gerar imagem.";
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function resizeDataUrlToExact(dataUrl: string, targetW: number, targetH: number): Promise<string> {
  try {
    if (!dataUrl.startsWith("data:image/")) return dataUrl;
    const { Image } = await import("https://deno.land/x/imagescript@1.2.17/mod.ts");
    const b64 = dataUrl.split(",")[1];
    const bin = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const img = await Image.decode(bin);
    const scale = Math.max(targetW / img.width, targetH / img.height);
    const scaledW = Math.round(img.width * scale);
    const scaledH = Math.round(img.height * scale);
    img.resize(scaledW, scaledH);
    const cropX = Math.max(0, Math.floor((scaledW - targetW) / 2));
    const cropY = Math.max(0, Math.floor((scaledH - targetH) / 2));
    img.crop(cropX, cropY, targetW, targetH);
    const out = await img.encode();
    let s = "";
    const CHUNK = 0x8000;
    for (let i = 0; i < out.length; i += CHUNK) s += String.fromCharCode(...out.subarray(i, i + CHUNK));
    return `data:image/png;base64,${btoa(s)}`;
  } catch (e) {
    console.warn("[Image] Falha ao redimensionar para tamanho exato:", e);
    throw new Error("Não foi possível aplicar o formato escolhido à imagem.");
  }
}


serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const parsed = RequestSchema.safeParse(await req.json());
    if (!parsed.success) {
      return new Response(JSON.stringify({ success: false, error: "Informe artigos válidos e escolha o formato antes de gerar." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const { userId, articleIds, force, imageFormat } = parsed.data;
    if (!isAIImageFormat(imageFormat)) {
      return new Response(JSON.stringify({ success: false, error: "Escolha o formato antes de gerar a imagem." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (!userId || !articleIds?.length) throw new Error("userId and articleIds are required");
    await requireUserOrService(req, userId);

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !supabaseKey) throw new Error("Configuração do serviço indisponível.");
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Carrega chaves de IA do usuário
    const { data: settings } = await supabase
      .from("user_settings")
      .select("image_mode, image_prompt, image_knowledge_urls, ninerouter_enabled, ninerouter_endpoint, ninerouter_api_key, ninerouter_image_model")
      .eq("user_id", userId)
      .single();
    
    // O prompt de imagem é obrigatório vindo de image_prompt conforme solicitado pelo usuário.
    const imagePrompt: string = (settings?.image_prompt || "").trim();
    if (!imagePrompt) {
      throw new Error("O 'Prompt de Imagem IA' não está configurado. Vá em Configurações > Imagem Destacada e defina o prompt — ele é obrigatório e será seguido à risca.");
    }
    const imageMode = settings?.image_mode || "ai";
    const fmt = requireImageFormat(imageFormat);
    const knowledgeUrls: string[] = Array.isArray((settings as any)?.image_knowledge_urls) ? (settings as any).image_knowledge_urls : [];

    if (imageMode !== "ai" && !force) {
      throw new Error(`A regeneração por IA está desativada. Altere o Modo de Imagem para "Gerada por IA" nas configurações.`);
    }

    let nineKey: string | null = null;
    const s9: any = settings;
    if (s9?.ninerouter_enabled !== false && s9?.ninerouter_endpoint && s9?.ninerouter_api_key) {
      try {
        const { data: dec } = await supabase.rpc("decrypt_credential", { enc_key: "", val: s9.ninerouter_api_key });
        nineKey = (typeof dec === "string" && dec.length > 5) ? dec : s9.ninerouter_api_key;
      } catch { nineKey = s9.ninerouter_api_key; }
    }

    // Fetch articles
    const { data: articles } = await supabase
      .from("articles")
      .select("id, title, category, featured_image_url, visual_elements, content, source_urls")
      .eq("user_id", userId)
      .in("id", articleIds);

    if (!articles?.length) throw new Error("Nenhum artigo encontrado.");

    // Fetch knowledge base texts (top 5 recent) to give the image AI more context.
    let knowledgeText = "";
    try {
      const { data: kentries } = await supabase
        .from("knowledge_entries")
        .select("title, description, content")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(5);
      if (kentries?.length) {
        knowledgeText = kentries.map((k: any) => {
          const body = (k.content || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 800);
          return `# ${k.title}${k.description ? ` — ${k.description}` : ""}\n${body}`;
        }).join("\n\n");
      }
    } catch (e) {
      console.warn("[regenerate-image] knowledge fetch failed", e);
    }

    let updated = 0;
    let failed = 0;
    let skipped = 0;
    const details: Array<{ articleId: string; title: string; reason: string; imageUrl?: string }> = [];
    const startTime = Date.now();
    const MAX_DURATION_MS = 20_000;
    const MAX_PER_CALL = 5;

    const isBrokenImageUrl = (url: string | null | undefined): boolean => {
      if (!url) return true;
      return /source\.unsplash\.com|picsum\.photos|images\.pexels\.com/i.test(url);
    };

    let processed = 0;
    for (const article of articles) {
      if (!force && article.featured_image_url && !isBrokenImageUrl(article.featured_image_url)) {
        continue;
      }

      if (Date.now() - startTime > MAX_DURATION_MS || processed >= MAX_PER_CALL) {
        skipped++;
        continue;
      }
      processed++;

      let imageUrl: string | null = null;
      let photoCaption: string | undefined;
      const providerErrors: string[] = [];

      // Todas as imagens passam pelo 9Router com prompt, aprendizado e formato explícitos.
      if (nineKey && s9?.ninerouter_endpoint) {
        try {
          const generated = await generateRouterImage({
            endpoint: s9.ninerouter_endpoint, apiKey: nineKey, model: s9.ninerouter_image_model,
            title: article.title, content: article.content, visual: article.visual_elements,
            prompt: imagePrompt, references: knowledgeUrls, knowledgeText, format: imageFormat,
            sourceUrls: article.source_urls || [],
            onPhoto: photo => { photoCaption = `${photo.caption} — Fonte: ${photo.source} · ${photo.license} · ${photo.publishedAt}`; },
          });
          let dataUrl = generated;
          if (!dataUrl.startsWith("data:image/")) {
            const response = await fetch(dataUrl, { signal: AbortSignal.timeout(10_000) });
            if (!response.ok) throw new Error("Não foi possível baixar a imagem gerada.");
            const bytes = new Uint8Array(await response.arrayBuffer());
            let binary = "";
            for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
            dataUrl = `data:image/png;base64,${btoa(binary)}`;
          }
          const resized = await resizeDataUrlToExact(dataUrl, fmt.width, fmt.height);
          const base64 = resized.split(",")[1];
          const bytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
          const path = `${userId}/${article.id}/${crypto.randomUUID()}.png`;
          const { error: uploadError } = await supabase.storage.from("article-images").upload(path, bytes, { contentType: "image/png", upsert: false });
          if (uploadError) throw uploadError;
          imageUrl = supabase.storage.from("article-images").getPublicUrl(path).data.publicUrl;
        } catch (error) { providerErrors.push(getErrorMessage(error)); }
      } else {
        providerErrors.push("Configure e ative o 9Router para gerar imagens.");
      }

      if (!imageUrl) {
        failed++;
        const reason = (providerErrors[0] || "Não foi possível gerar imagem pelo 9Router.");
        details.push({ articleId: article.id, title: article.title, reason });
        continue;
      }

      const { error: updateError } = await supabase.from("articles").update({ featured_image_url: imageUrl,
        ...(photoCaption ? { image_caption: photoCaption, image_alt: photoCaption.split(' — Fonte:')[0], image_verification_status: 'foto_fonte_verificada' } : { image_verification_status: 'ilustrativa' }),
      }).eq("id", article.id).eq("user_id", userId);
      if (updateError) {
        failed++;
        details.push({ articleId: article.id, title: article.title, reason: updateError.message });
      } else {
        updated++;
        details.push({ articleId: article.id, title: article.title, reason: "Success", imageUrl: imageUrl });
      }

      await sleep(500);
    }

    const firstFailureReason = details.find((detail) => detail.reason !== "Success")?.reason;
    const message = updated > 0
      ? `${updated} imagens processadas com sucesso.${skipped > 0 ? ` ${skipped} restantes; clique em gerar novamente para continuar.` : ""}`
      : firstFailureReason
        ? `Nenhuma imagem foi gerada. Motivo: ${firstFailureReason}`
        : "Nenhuma imagem foi gerada. Verifique suas configurações de IA.";

    return new Response(
      JSON.stringify({ 
        success: updated > 0, 
        message, 
        updated, 
        failed, 
        skipped, 
        details: details.slice(0, 5),
        imageUrl: articleIds.length === 1 && details[0]?.imageUrl ? details[0].imageUrl : undefined
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("regenerate-image error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Erro desconhecido" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

