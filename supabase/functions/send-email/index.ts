import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { sendMail } from "../_shared/smtp.ts";

const headers = {
  ...corsHeaders,
  "Access-Control-Allow-Headers": "authorization, x-email-secret, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
  "Cache-Control": "no-store",
};

function isAuthorized(req: Request) {
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const emailSecret = Deno.env.get("EMAIL_FUNCTION_SECRET");
  const bearer = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "").trim();
  const suppliedSecret = req.headers.get("X-Email-Secret")?.trim();

  if (serviceRoleKey && bearer === serviceRoleKey) return true;
  if (emailSecret && suppliedSecret === emailSecret) return true;
  return false;
}

function validEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && !/[\r\n]/.test(value);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers,
    });
  }

  if (!isAuthorized(req)) {
    console.warn("[send-email] Tentativa não autorizada bloqueada");
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers,
    });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const { to, subject, html, text, replyTo } = body;

    if (!to || !subject || (!html && !text)) {
      return new Response(JSON.stringify({ error: "to, subject e html|text são obrigatórios" }), {
        status: 400,
        headers,
      });
    }

    const recipients = (Array.isArray(to) ? to : [to]).map((item) => String(item).trim()).filter(Boolean);
    if (recipients.length === 0 || recipients.length > 10 || recipients.some((email) => !validEmail(email))) {
      return new Response(JSON.stringify({ error: "Destinatário inválido ou limite excedido" }), {
        status: 400,
        headers,
      });
    }

    const cleanSubject = String(subject).trim();
    if (!cleanSubject || cleanSubject.length > 200 || /[\r\n]/.test(cleanSubject)) {
      return new Response(JSON.stringify({ error: "Assunto inválido" }), {
        status: 400,
        headers,
      });
    }

    const cleanHtml = html == null ? undefined : String(html);
    const cleanText = text == null ? undefined : String(text);
    const payloadSize = (cleanHtml?.length || 0) + (cleanText?.length || 0);
    if (payloadSize > 200_000) {
      return new Response(JSON.stringify({ error: "Conteúdo do e-mail excede o limite" }), {
        status: 413,
        headers,
      });
    }

    const cleanReplyTo = replyTo == null ? undefined : String(replyTo).trim();
    if (cleanReplyTo && !validEmail(cleanReplyTo)) {
      return new Response(JSON.stringify({ error: "replyTo inválido" }), {
        status: 400,
        headers,
      });
    }

    await sendMail({
      to: recipients.length === 1 ? recipients[0] : recipients,
      subject: cleanSubject,
      html: cleanHtml,
      text: cleanText,
      replyTo: cleanReplyTo,
    });

    return new Response(JSON.stringify({ ok: true }), { headers });
  } catch (error) {
    console.error("[send-email] Falha no envio:", error instanceof Error ? error.message : "erro desconhecido");
    return new Response(JSON.stringify({ error: "Falha ao enviar e-mail" }), {
      status: 500,
      headers,
    });
  }
});
