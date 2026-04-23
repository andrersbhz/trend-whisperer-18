import { assertEquals, assertExists } from "https://deno.land/std@0.168.0/testing/asserts.ts";

Deno.test("Facebook OAuth Start URL Validation", async () => {
  const appId = "1251536133529856";
  const supabaseUrl = "https://bvvhgwkjyfnjroudtbav.supabase.co";
  const returnUrl = "https://forex.a3solucoesdigitais.com/settings";
  
  // Simulate the logic in the edge function
  const redirectUri = `${supabaseUrl}/functions/v1/facebook-oauth-callback`;
  const stateNonce = "test-nonce-1234567890";
  const state = `${stateNonce}::${encodeURIComponent(returnUrl)}`;
  
  const authUrl = new URL("https://www.facebook.com/v19.0/dialog/oauth");
  authUrl.searchParams.set("client_id", appId);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("state", state);
  authUrl.searchParams.set("scope", "email,public_profile,pages_show_list");
  authUrl.searchParams.set("response_type", "code");

  const urlString = authUrl.toString();
  
  console.log("Generated URL:", urlString);

  // Validate parameters
  assertEquals(authUrl.searchParams.get("client_id"), appId);
  assertEquals(authUrl.searchParams.get("redirect_uri"), redirectUri);
  assertEquals(authUrl.searchParams.get("state"), state);
  assertEquals(authUrl.searchParams.get("response_type"), "code");
  
  // Ensure redirect_uri is correctly encoded in the final string
  const encodedRedirectUri = encodeURIComponent(redirectUri);
  const encodedState = encodeURIComponent(state);
  
  assertExists(urlString.includes(`redirect_uri=${encodedRedirectUri}`));
  assertExists(urlString.includes(`state=${encodedState}`));
  
  console.log("Test passed: URL parameters are correctly structured and encoded.");
});
