import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { requireSafeHttpsUrl } from "../_shared/security.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ success: false, error: "Não autenticado" }, 401);
    const url = Deno.env.get("SUPABASE_URL")!;
    const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const anon = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!);
    const { data: { user } } = await anon.auth.getUser(authHeader.replace("Bearer ", ""));
    if (!user) return json({ success: false, error: "Sessão inválida" }, 401);

    const { data: s } = await admin.from("user_settings")
      .select("wordpress_url, wordpress_username, wordpress_app_password")
      .eq("user_id", user.id).maybeSingle();
    if (!s?.wordpress_url || !s?.wordpress_username || !s?.wordpress_app_password)
      return json({ success: false, error: "Configure o WordPress em Configurações primeiro." });

    let pwd = s.wordpress_app_password as string;
    if (pwd.startsWith("ENCRYPTED:")) {
      const { data } = await admin.rpc("decrypt_credential", { val: pwd, enc_key: Deno.env.get("DB_ENCRYPTION_KEY") || "" });
      pwd = data || "";
    }
    let base = String(s.wordpress_url).replace(/\/$/, "");
    if (!/^https?:\/\//i.test(base)) base = `https://${base}`;
    base = (await requireSafeHttpsUrl(base.replace(/^http:/i, "https:"))).origin;
    const auth = `Basic ${btoa(`${String(s.wordpress_username).trim()}:${pwd}`)}`;

    const users: Array<{ id: number; name: string; slug: string; avatar: string | null }> = [];
    for (let page = 1; page <= 5; page++) {
      const r = await fetch(`${base}/wp-json/wp/v2/users?context=edit&per_page=100&page=${page}`, { headers: { Authorization: auth } });
      if (!r.ok) {
        if (page === 1) {
          const t = await r.text();
          return json({ success: false, error: `WordPress respondeu ${r.status}. Verifique se o usuário é Administrador. ${t.slice(0, 150)}` });
        }
        break;
      }
      const list = await r.json();
      if (!Array.isArray(list) || list.length === 0) break;
      for (const u of list) {
        const roles: string[] = u.roles || [];
        if (roles.length && !roles.some((x) => ["administrator", "editor", "author", "contributor"].includes(x))) continue;
        users.push({ id: u.id, name: u.name, slug: u.slug, avatar: u.avatar_urls?.["96"] || null });
      }
      if (list.length < 100) break;
    }
    return json({ success: true, users });
  } catch (e) {
    return json({ success: false, error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
