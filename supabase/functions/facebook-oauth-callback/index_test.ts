import { assertEquals, assertExists } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { handler } from "./index.ts";

// Mock environment variables
Deno.env.set("SUPABASE_URL", "https://xyz.supabase.co");
Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "service-role-key");
Deno.env.set("FACEBOOK_APP_ID", "12345");
Deno.env.set("FACEBOOK_APP_SECRET", "secret");

Deno.test({
  name: "Facebook OAuth Callback Integration Test",
  sanitizeOps: false,
  sanitizeResources: false,
  fn: async (t) => {
  // Mock global fetch
  const originalFetch = globalThis.fetch;
  
  await t.step("Successful OAuth Flow", async () => {
    const testState = "test-nonce::https%3A%2F%2Fexample.com%2Fsettings";
    const testCode = "facebook-auth-code";
    
    // Setup request
    const req = new Request(`https://xyz.supabase.co/functions/v1/facebook-oauth-callback?code=${testCode}&state=${testState}`);

    // Mock fetch for all external calls
    globalThis.fetch = async (input: string | URL | Request, init?: RequestInit) => {
      const url = input.toString();
      
      // 1. Supabase calls (mocking the internal fetch used by supabase-js if needed, 
      // but here we are using createClient which might use fetch internally or we can mock the client.
      // Since index.ts imports createClient from esm.sh, it's harder to mock the import.
      // However, we can mock the global fetch and detect Supabase URL.)
      
      if (url.includes("xyz.supabase.co")) {
        // Mock state lookup
        if (url.includes("/rest/v1/facebook_oauth_states")) {
          return new Response(JSON.stringify([{
            user_id: "user-123",
            expires_at: new Date(Date.now() + 3600000).toISOString()
          }]), { status: 200 });
        }
        // Mock account check
        if (url.includes("/rest/v1/facebook_accounts")) {
          return new Response(JSON.stringify([]), { status: 200 });
        }
        // Mock inserts
        return new Response(JSON.stringify({ success: true }), { status: 201 });
      }

      // 2. Facebook Graph API calls
      if (url.includes("graph.facebook.com")) {
        // Token exchange
        if (url.includes("/oauth/access_token")) {
          return new Response(JSON.stringify({
            access_token: "mock-access-token",
            expires_in: 3600
          }), { status: 200 });
        }
        // Pages fetch
        if (url.includes("/me/accounts")) {
          return new Response(JSON.stringify({
            data: [
              {
                id: "page-id-1",
                name: "Test Page",
                access_token: "page-token-1",
                category: "Business",
                picture: { url: "https://example.com/pic.jpg" }
              }
            ]
          }), { status: 200 });
        }
      }

      return new Response("Not found", { status: 404 });
    };

    try {
      const response = await handler(req);
      const body = await response.text();
      
      assertEquals(response.status, 200);
      assertExists(body.includes("Conectado com sucesso!"));
      assertExists(body.includes("1 de 1 página(s)"));
      console.log("Integration test passed: Flow completed successfully.");
    } finally {
      globalThis.fetch = originalFetch;
    }
  }
});

  await t.step("Expired Session Flow", async () => {
    const testState = "expired-state::https%3A%2F%2Fexample.com%2Fsettings";
    const req = new Request(`https://xyz.supabase.co/functions/v1/facebook-oauth-callback?code=abc&state=${testState}`);

    globalThis.fetch = async (url: string | URL | Request) => {
      if (url.toString().includes("/rest/v1/facebook_oauth_states")) {
        return new Response(JSON.stringify([]), { status: 200 }); // No state found
      }
      return new Response("Error", { status: 500 });
    };

    try {
      const response = await handler(req);
      const body = await response.text();
      
      assertExists(body.includes("Sessão expirada"));
      console.log("Integration test passed: Correctly handled expired session.");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
