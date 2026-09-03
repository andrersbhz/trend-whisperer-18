import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "create_article_draft",
  title: "Criar rascunho de artigo",
  description:
    "Cria um novo artigo em rascunho (status draft) para o usuário autenticado, sem publicar.",
  inputSchema: {
    title: z.string().trim().min(3).describe("Título do artigo."),
    category: z.string().trim().min(1).describe("Categoria do artigo (ex.: esportes, politica)."),
    content: z.string().trim().optional().describe("Conteúdo em HTML ou texto."),
    excerpt: z.string().trim().optional().describe("Resumo curto."),
    seo_keyword: z.string().trim().optional().describe("Palavra-chave principal de SEO."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async ({ title, category, content, excerpt, seo_keyword }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Não autenticado" }], isError: true };
    }
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase
      .from("articles")
      .insert({
        user_id: ctx.getUserId(),
        title,
        category,
        content: content ?? null,
        excerpt: excerpt ?? null,
        seo_keyword: seo_keyword ?? null,
        status: "draft",
      })
      .select("id, title, status, category, created_at");
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data?.[0] ?? null) }],
      structuredContent: { article: data?.[0] ?? null },
    };
  },
});
