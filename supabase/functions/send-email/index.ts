import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { sendMail } from "../_shared/smtp.ts";
import { requireServiceOrAdmin } from "../_shared/security.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    await requireServiceOrAdmin(req);
    const { to, subject, html, text, replyTo } = await req.json();
    const email = String(to || "").trim();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || email.length > 254 || String(subject || "").length > 160 || String(html || text || "").length > 100000) {
      return new Response(JSON.stringify({ error: "Dados de e-mail inválidos" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (!to || !subject || (!html && !text)) {
      return new Response(JSON.stringify({ error: "to, subject e html|text são obrigatórios" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    await sendMail({ to: email, subject: String(subject), html, text, replyTo });
    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("send-email error:", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
