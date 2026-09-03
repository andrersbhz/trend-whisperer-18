import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_articles",
  title: "Listar artigos",
  description:
    "Lista os artigos do usuário autenticado, com filtro opcional por status ou categoria.",
  inputSchema: {
    status: z
      .enum(["draft", "scheduled", "published", "failed"])
      .optional()
      .describe("Filtra pelo status do artigo."),
    category: z.string().trim().min(1).optional().describe("Filtra pela categoria."),
    limit: z.number().int().min(1).max(50).default(10).describe("Máximo de artigos retornados."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ status, category, limit }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Não autenticado" }], isError: true };
    }
    const supabase = supabaseForUser(ctx);
    let query = supabase
      .from("articles")
      .select("id, title, status, category, slug, published_at, scheduled_at, created_at, featured_image_url")
      .order("created_at", { ascending: false })
      .limit(limit ?? 10);
    if (status) query = query.eq("status", status);
    if (category) query = query.eq("category", category);

    const { data, error } = await query;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? []) }],
      structuredContent: { articles: data ?? [] },
    };
  },
});
