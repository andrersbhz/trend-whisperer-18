import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listArticlesTool from "./tools/list-articles";
import getArticleTool from "./tools/get-article";
import createArticleDraftTool from "./tools/create-article-draft";
import listBlogsTool from "./tools/list-blogs";

const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "postwp",
  title: "PostWP",
  version: "0.1.0",
  instructions:
    "Ferramentas do PostWP: liste e leia artigos, crie rascunhos e consulte blogs do usuário autenticado.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [listArticlesTool, getArticleTool, createArticleDraftTool, listBlogsTool],
});
