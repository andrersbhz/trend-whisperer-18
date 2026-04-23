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
      globalThis.fetch = async (input: string | URL | Request) => {
        const url = input.toString();
        
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
          // Mock inserts/updates
          return new Response(JSON.stringify({ success: true }), { status: 201 });
        }

        if (url.includes("graph.facebook.com")) {
          if (url.includes("/oauth/access_token")) {
            return new Response(JSON.stringify({ access_token: "mock-token" }), { status: 200 });
          }
          if (url.includes("/me/accounts")) {
            return new Response(JSON.stringify({
              data: [{ id: "p1", name: "Page 1", access_token: "pt1" }]
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
        console.log("Integration test passed: Flow completed successfully.");
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    await t.step("Expired Session Flow", async () => {
      const testState = "expired-state::https%3A%2F%2Fexample.com%2Fsettings";
      const req = new Request(`https://xyz.supabase.co/functions/v1/facebook-oauth-callback?code=abc&state=${testState}`);

      globalThis.fetch = async (url: string | URL | Request) => {
        if (url.toString().includes("/rest/v1/facebook_oauth_states")) {
          return new Response(JSON.stringify([]), { status: 200 });
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
  }
});
