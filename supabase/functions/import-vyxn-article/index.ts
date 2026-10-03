import { createClient } from "npm:@supabase/supabase-js@2.101.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (status: number, payload: unknown) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" },
  });

const allowedImageTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

function safeSlug(value: unknown, fallback: string) {
  const input = String(value || fallback)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 180);
  return input || `artigo-${Date.now()}`;
}

function decodeBase64(value: string) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "Método não permitido." });

  try {
    const authorization = req.headers.get("Authorization") || "";
    const token = authorization.replace(/^Bearer\s+/i, "").trim();
    if (!token) return json(401, { error: "Token de acesso do PostWP ausente." });

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) return json(500, { error: "Supabase não configurado." });

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: authData, error: authError } = await admin.auth.getUser(token);
    const user = authData.user;
    if (authError || !user) return json(401, { error: "Token inválido ou expirado." });

    const payload = await req.json();
    if (payload?.source !== "vyxn-blog-post") {
      return json(400, { error: "Origem da integração inválida." });
    }

    const article = payload?.article || {};
    const title = String(article.title || "").trim();
    const content = String(article.contentHtml || article.content || "").trim();
    if (title.length < 3 || !content) {
      return json(400, { error: "Título e conteúdo do artigo são obrigatórios." });
    }

    const requestedStatus = String(payload?.status || "draft");
    const status = requestedStatus === "pending" ? "ready" : "draft";
    const sources = Array.isArray(article.sources)
      ? article.sources
          .map((source: unknown) => {
            if (typeof source === "string") return source;
            if (source && typeof source === "object" && "url" in source) {
              return String((source as { url?: unknown }).url || "");
            }
            return "";
          })
          .filter((url: string) => /^https?:\/\//i.test(url))
          .slice(0, 30)
      : [];

    const { data: inserted, error: insertError } = await admin
      .from("articles")
      .insert({
        user_id: user.id,
        title: title.slice(0, 300),
        slug: safeSlug(article.slug, title),
        content,
        excerpt: String(article.excerpt || "").trim().slice(0, 1000) || null,
        category: String(article.category || "geral").trim().slice(0, 100) || "geral",
        seo_keyword: String(article.focusKeyphrase || article.seo_keyword || "").trim().slice(0, 250) || null,
        focus_keyword: String(article.focusKeyphrase || "").trim().slice(0, 250) || null,
        meta_description: String(article.metaDescription || "").trim().slice(0, 500) || null,
        meta_title: String(article.title || "").trim().slice(0, 300),
        seo_title: String(article.title || "").trim().slice(0, 300),
        image_alt: String(article.imageAlt || "").trim().slice(0, 500) || null,
        source_urls: sources.length ? sources : null,
        research_references: sources.length ? article.sources : null,
        status,
        is_approved: false,
        ai_provider: "vyxn-blog-post",
      })
      .select("id, title, slug, status, created_at")
      .single();

    if (insertError || !inserted) {
      console.error("[import-vyxn-article] insert failed", insertError);
      return json(500, { error: insertError?.message || "Não foi possível criar o artigo." });
    }

    let featuredImageUrl: string | null = null;
    const image = payload?.image;
    if (image?.data) {
      const mime = String(image.type || "").toLowerCase();
      if (!allowedImageTypes.has(mime)) {
        await admin.from("articles").delete().eq("id", inserted.id).eq("user_id", user.id);
        return json(400, { error: "Formato de imagem inválido. Use JPG, PNG ou WebP." });
      }

      const bytes = decodeBase64(String(image.data));
      if (bytes.byteLength > 10 * 1024 * 1024) {
        await admin.from("articles").delete().eq("id", inserted.id).eq("user_id", user.id);
        return json(400, { error: "A imagem excede o limite de 10 MB." });
      }

      const extension = mime === "image/png" ? "png" : mime === "image/webp" ? "webp" : "jpg";
      const objectPath = `${user.id}/${inserted.id}/vyxn-${crypto.randomUUID()}.${extension}`;
      const { error: uploadError } = await admin.storage
        .from("article-images")
        .upload(objectPath, bytes, { contentType: mime, upsert: false });

      if (uploadError) {
        await admin.from("articles").delete().eq("id", inserted.id).eq("user_id", user.id);
        console.error("[import-vyxn-article] image upload failed", uploadError);
        return json(500, { error: `Falha no upload da imagem: ${uploadError.message}` });
      }

      featuredImageUrl = admin.storage.from("article-images").getPublicUrl(objectPath).data.publicUrl;
      const { error: imageUpdateError } = await admin
        .from("articles")
        .update({ featured_image_url: featuredImageUrl })
        .eq("id", inserted.id)
        .eq("user_id", user.id);

      if (imageUpdateError) {
        await admin.storage.from("article-images").remove([objectPath]);
        await admin.from("articles").delete().eq("id", inserted.id).eq("user_id", user.id);
        return json(500, { error: imageUpdateError.message });
      }
    }

    return json(201, {
      id: inserted.id,
      title: inserted.title,
      status: inserted.status,
      imageUrl: featuredImageUrl,
      url: `https://postwp.lovable.app/articles`,
    });
  } catch (error) {
    console.error("[import-vyxn-article] unexpected error", error);
    return json(500, { error: error instanceof Error ? error.message : "Erro interno." });
  }
});
