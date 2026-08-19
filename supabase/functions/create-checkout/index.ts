import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { type StripeEnv, createStripeClient } from "../_shared/stripe.ts";

const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" };

function safeReturnUrl(value: unknown) {
  if (!value) throw new Error("Missing returnUrl");
  const raw = String(value).trim();
  if (raw.length > 2048) throw new Error("Invalid returnUrl");
  const url = new URL(raw);
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) {
    throw new Error("Invalid returnUrl");
  }

  const configuredHosts = (Deno.env.get("CHECKOUT_ALLOWED_RETURN_HOSTS") || "")
    .split(",")
    .map((host) => host.trim().toLowerCase())
    .filter(Boolean);
  if (configuredHosts.length > 0 && !configuredHosts.includes(url.hostname.toLowerCase())) {
    throw new Error("returnUrl host is not allowed");
  }
  return url.toString();
}

function cleanEmail(value: unknown) {
  if (!value) return undefined;
  const email = String(value).trim().toLowerCase();
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Invalid customerEmail");
  return email;
}

function cleanText(value: unknown, maxLength: number) {
  if (!value) return undefined;
  const text = String(value).replace(/[\r\n\u0000-\u001f]/g, " ").replace(/\s+/g, " ").trim();
  return text ? text.slice(0, maxLength) : undefined;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: jsonHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const priceId = typeof body?.priceId === "string" ? body.priceId.trim() : "";
    if (!priceId || !/^[a-zA-Z0-9_-]{1,120}$/.test(priceId)) throw new Error("Invalid priceId");

    const allowedPriceKeys = (Deno.env.get("STRIPE_ALLOWED_PRICE_LOOKUP_KEYS") || "")
      .split(",")
      .map((key) => key.trim())
      .filter(Boolean);
    if (allowedPriceKeys.length > 0 && !allowedPriceKeys.includes(priceId)) throw new Error("Price not allowed");

    const returnUrl = safeReturnUrl(body?.returnUrl);
    const customerEmail = cleanEmail(body?.customerEmail);
    const customerName = cleanText(body?.customerName, 120);
    const customerPhone = cleanText(body?.customerPhone, 40);

    const forcedEnvironment = Deno.env.get("STRIPE_CHECKOUT_ENV");
    const environment: StripeEnv = forcedEnvironment === "live" || forcedEnvironment === "sandbox"
      ? forcedEnvironment
      : body?.environment === "live" ? "live" : "sandbox";

    const stripe = createStripeClient(environment);
    const prices = await stripe.prices.list({ lookup_keys: [priceId], expand: ["data.product"], active: true });
    if (!prices.data.length) throw new Error("Price not found");
    const price = prices.data[0];

    let customerId: string | undefined;
    if (customerEmail) {
      const existing = await stripe.customers.list({ email: customerEmail, limit: 1 });
      if (existing.data.length) {
        customerId = existing.data[0].id;
      } else {
        const customer = await stripe.customers.create({
          email: customerEmail,
          name: customerName,
          phone: customerPhone,
        });
        customerId = customer.id;
      }
    }

    const session = await stripe.checkout.sessions.create({
      line_items: [{ price: price.id, quantity: 1 }],
      mode: "subscription",
      ui_mode: "embedded_page",
      return_url: returnUrl,
      ...(customerId && { customer: customerId }),
      subscription_data: {
        metadata: {
          buyer_email: customerEmail || "",
          buyer_name: customerName || "",
          buyer_phone: customerPhone || "",
          plan: priceId,
        },
      },
      metadata: {
        buyer_email: customerEmail || "",
        buyer_name: customerName || "",
        buyer_phone: customerPhone || "",
        plan: priceId,
      },
    });

    return new Response(JSON.stringify({ clientSecret: session.client_secret, sessionId: session.id }), {
      headers: jsonHeaders,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to create checkout";
    console.error("create-checkout error:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: jsonHeaders,
    });
  }
});
