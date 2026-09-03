import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "get_article",
  title: "Ver artigo",
  description: "Retorna o conteúdo completo e os dados de SEO de um artigo pelo ID.",
  inputSchema: {
    id: z.string().uuid().describe("ID do artigo."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ id }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Não autenticado" }], isError: true };
    }
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase
      .from("articles")
      .select(
        "id, title, status, category, slug, content, excerpt, meta_title, meta_description, seo_keyword, focus_keyword, featured_image_url, published_at, scheduled_at, created_at, updated_at",
      )
      .eq("id", id)
      .maybeSingle();
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    if (!data) return { content: [{ type: "text", text: "Artigo não encontrado" }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data) }],
      structuredContent: { article: data },
    };
  },
});
