import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { type StripeEnv, createStripeClient } from "../_shared/stripe.ts";
import { AuthorizationError, authorizeUserRequest } from "../_shared/authorize-user.ts";

const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" };

function normalizeEmail(value: unknown) {
  const email = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Invalid customerEmail");
  return email;
}

function safeReturnUrl(value: unknown) {
  if (!value) return undefined;
  const raw = String(value).trim();
  if (raw.length > 2048) throw new Error("Invalid returnUrl");
  const url = new URL(raw);
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) throw new Error("Invalid returnUrl");

  const configuredHosts = (Deno.env.get("PORTAL_ALLOWED_RETURN_HOSTS") || "")
    .split(",")
    .map((host) => host.trim().toLowerCase())
    .filter(Boolean);
  if (configuredHosts.length > 0 && !configuredHosts.includes(url.hostname.toLowerCase())) {
    throw new Error("returnUrl host is not allowed");
  }
  return url.toString();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: jsonHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const auth = await authorizeUserRequest(req, body?.userId || null);
    const requestedEmail = body?.customerEmail ? normalizeEmail(body.customerEmail) : "";

    let customerEmail: string;
    if (auth.isServiceCall) {
      customerEmail = requestedEmail;
      if (!customerEmail) throw new Error("Missing customerEmail");
    } else {
      if (!auth.email) throw new AuthorizationError("Authenticated user has no email", 403);
      customerEmail = normalizeEmail(auth.email);
      if (requestedEmail && requestedEmail !== customerEmail) throw new AuthorizationError("Forbidden", 403);
    }

    const returnUrl = safeReturnUrl(body?.returnUrl);
    const environment: StripeEnv = body?.environment === "live" ? "live" : "sandbox";
    const stripe = createStripeClient(environment);

    const customers = await stripe.customers.list({ email: customerEmail, limit: 1 });
    if (!customers.data.length) {
      return new Response(JSON.stringify({ error: "Customer not found" }), { status: 404, headers: jsonHeaders });
    }

    const portal = await stripe.billingPortal.sessions.create({
      customer: customers.data[0].id,
      ...(returnUrl && { return_url: returnUrl }),
    });

    return new Response(JSON.stringify({ url: portal.url }), { headers: jsonHeaders });
  } catch (error) {
    const status = error instanceof AuthorizationError ? error.status : 400;
    const message = error instanceof AuthorizationError ? error.message : (error instanceof Error ? error.message : "Unable to create portal session");
    if (!(error instanceof AuthorizationError)) console.error("create-portal-session error:", message);
    return new Response(JSON.stringify({ error: message }), { status, headers: jsonHeaders });
  }
});
