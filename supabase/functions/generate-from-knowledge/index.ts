import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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
  for (let i = 0; i < buf.length; i += chunk) binary += String.fromCharCode(...buf.subarray(i, i + chunk));
  return btoa(binary);
}

async function decryptCredential(supabase: any, value: string | null | undefined): Promise<string | null> {
  if (!value) return null;
  const { data } = await supabase.rpc("decrypt_credential", { enc_key: "", val: value });
  return typeof data === "string" && data.length > 5 ? data : null;
}

async function callGemini(apiKey: string, model: string, prompt: string): Promise<string> {
  const resp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
  });
  if (!resp.ok) throw new Error(`Gemini retornou ${resp.status}: ${(await resp.text()).slice(0, 300)}`);
  const data = await resp.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
}

async function callOpenAI(apiKey: string, model: string, prompt: string): Promise<string> {
  const resp = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model, messages: [{ role: "user", content: prompt }], response_format: { type: "json_object" } }),
  });
  if (!resp.ok) throw new Error(`OpenAI retornou ${resp.status}: ${(await resp.text()).slice(0, 300)}`);
  const data = await resp.json();
  return data.choices?.[0]?.message?.content || "{}";
}

async function callGroq(apiKey: string, model: string, prompt: string): Promise<string> {
  const resp = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model, messages: [{ role: "user", content: prompt }], response_format: { type: "json_object" } }),
  });
  if (!resp.ok) throw new Error(`Groq retornou ${resp.status}: ${(await resp.text()).slice(0, 300)}`);
  const data = await resp.json();
  return data.choices?.[0]?.message?.content || "{}";
}

async function callAzure(apiKey: string, endpoint: string, deployment: string, prompt: string): Promise<string> {
  const resp = await fetch(`${endpoint.replace(/\/$/, "")}/openai/deployments/${encodeURIComponent(deployment)}/chat/completions?api-version=2024-02-01`, {
    method: "POST",
    headers: { "api-key": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({ messages: [{ role: "user", content: prompt }], response_format: { type: "json_object" } }),
  });
  if (!resp.ok) throw new Error(`Azure retornou ${resp.status}: ${(await resp.text()).slice(0, 300)}`);
  const data = await resp.json();
  return data.choices?.[0]?.message?.content || "{}";
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { userId, knowledgeId, category, title } = await req.json();
    if (!userId || !knowledgeId) {
      return new Response(JSON.stringify({ error: "userId e knowledgeId são obrigatórios" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: entry, error: entryErr } = await supabase
      .from("knowledge_entries")
      .select("*")
      .eq("id", knowledgeId)
      .eq("user_id", userId)
      .maybeSingle();
    if (entryErr || !entry) throw new Error("Entrada de conhecimento não encontrada");

    const { data: settings } = await supabase
      .from("user_settings")
      .select("writer_prompt, categories, gemini_api_key, gemini_model, openai_api_key, openai_model, groq_api_key, groq_model, azure_openai_api_key, azure_openai_endpoint, azure_openai_deployment_name, azure_openai_model")
      .eq("user_id", userId)
      .maybeSingle();

    const cats: string[] = (settings?.categories as string[]) || ["policia", "celebridades", "politica", "esportes", "saude", "financas"];
    const finalCategory = category && cats.includes(category) ? category : (cats[0] || "geral");
    const finalTitleHint = title?.trim() || entry.title;

    const referenceParts: string[] = [];
    if (entry.content && entry.content.trim().length > 0) {
      referenceParts.push(`=== MATERIAL DE REFERÊNCIA (texto) ===\n${entry.content.slice(0, 60000)}`);
    }
    if (entry.file_path) {
      const { data: signed } = await supabase.storage.from("knowledge-files").createSignedUrl(entry.file_path, 300);
      if (signed?.signedUrl) {
        const b64 = await fileToBase64(signed.signedUrl);
        referenceParts.push(`=== ARQUIVO DE REFERÊNCIA (${entry.file_name || "referencia.pdf"}) ===\nData URL: data:${entry.file_type || "application/pdf"};base64,${b64}`);
      }
    }

    const prompt = `${settings?.writer_prompt || "Você é um jornalista experiente. Escreva com fatos, SEO e verdade."}\n\nBaseie-se ESTRITAMENTE no material de referência a seguir.\nTítulo sugerido: "${finalTitleHint}"\nCategoria: "${finalCategory}"\n\nRetorne SOMENTE um JSON válido com os campos:\n{"title":"...","content":"HTML completo do artigo, 1500-2500 palavras, com <h2>, <h3>, <p>, <ul>","excerpt":"...","seo_keyword":"...","seo_title":"...","meta_description":"...","slug":"...","image_alt":"...","image_caption":""}\n\n${referenceParts.join("\n\n")}`;

    const providers: Array<{ name: string; run: () => Promise<string> }> = [];
    const geminiKey = await decryptCredential(supabase, settings?.gemini_api_key);
    if (geminiKey) providers.push({ name: "Gemini", run: () => callGemini(geminiKey, settings?.gemini_model || "gemini-3.6-flash", prompt) });
    const openaiKey = await decryptCredential(supabase, settings?.openai_api_key);
    if (openaiKey) providers.push({ name: "OpenAI", run: () => callOpenAI(openaiKey, settings?.openai_model || "gpt-4o-mini", prompt) });
    const groqKey = await decryptCredential(supabase, settings?.groq_api_key);
    if (groqKey) providers.push({ name: "Groq", run: () => callGroq(groqKey, settings?.groq_model || "llama-3.3-70b-versatile", prompt) });
    const azureKey = await decryptCredential(supabase, settings?.azure_openai_api_key);
    const azureDeployment = settings?.azure_openai_model || settings?.azure_openai_deployment_name;
    if (azureKey && settings?.azure_openai_endpoint && azureDeployment) {
      providers.push({ name: "Azure", run: () => callAzure(azureKey, settings.azure_openai_endpoint, azureDeployment, prompt) });
    }

    if (providers.length === 0) throw new Error("Nenhum provedor de IA configurado. Configure Gemini, OpenAI, Groq ou Azure em Configurações.");

    let raw = "{}";
    const errors: string[] = [];
    let provider = "";
    for (const candidate of providers) {
      try {
        raw = await candidate.run();
        provider = candidate.name;
        break;
      } catch (error) {
        errors.push(`${candidate.name}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    if (!provider) throw new Error(`Todos os provedores de IA falharam: ${errors.join(" | ")}`);

    let parsed: any = {};
    try {
      parsed = typeof raw === "string" ? JSON.parse(raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim()) : raw;
    } catch {
      const match = String(raw).match(/\{[\s\S]*\}/);
      parsed = match ? JSON.parse(match[0]) : {};
    }
    if (!parsed.title || !parsed.content) throw new Error("A IA não retornou um artigo válido.");

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
        ai_provider: provider,
      })
      .select("id, title")
      .single();
    if (insertErr) throw insertErr;

    try {
      await supabase.functions.invoke("regenerate-image", { body: { userId, articleIds: [inserted.id], force: true } });
    } catch (e) {
      console.warn("[generate-from-knowledge] image gen failed", e);
    }

    return new Response(JSON.stringify({ success: true, articleId: inserted.id, title: inserted.title, provider, message: "Artigo criado a partir da base de conhecimento." }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err: any) {
    console.error("[generate-from-knowledge] error", err);
    return new Response(JSON.stringify({ success: false, error: err?.message || String(err) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
