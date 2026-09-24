import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const jsonHeaders = { "Content-Type": "application/json" };

export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) { super(message); this.status = status; }
}

export async function requireUserOrService(req: Request, requestedUserId?: string | null): Promise<{ userId: string | null; isService: boolean }> {
  const url = Deno.env.get("SUPABASE_URL")!;
  const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const bearer = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "").trim();
  if (!bearer) throw new HttpError(401, "Não autenticado");
  if (bearer === service) return { userId: requestedUserId || null, isService: true };
  if (bearer === anon) throw new HttpError(401, "Credencial pública não autorizada");
  const client = createClient(url, anon, { global: { headers: { Authorization: `Bearer ${bearer}` } } });
  const { data, error } = await client.auth.getUser(bearer);
  if (error || !data.user) throw new HttpError(401, "Sessão inválida");
  if (requestedUserId && requestedUserId !== data.user.id) throw new HttpError(403, "Acesso negado");
  return { userId: data.user.id, isService: false };
}

export async function requireServiceOrAdmin(req: Request): Promise<void> {
  const auth = await requireUserOrService(req);
  if (auth.isService) return;
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data } = await admin.rpc("has_role", { _user_id: auth.userId, _role: "admin" });
  if (!data) throw new HttpError(403, "Acesso administrativo necessário");
}

function isPrivateIp(host: string): boolean {
  const h = host.toLowerCase().replace(/^\[|\]$/g, "");
  return h === "localhost" || h === "0.0.0.0" || h === "::1" || h.startsWith("127.") || h.startsWith("10.") || h.startsWith("192.168.") || /^172\.(1[6-9]|2\d|3[01])\./.test(h) || h.startsWith("169.254.") || h.startsWith("fc") || h.startsWith("fd") || h.startsWith("fe80:");
}

export async function requireSafeHttpsUrl(raw: string, allowedSuffix?: string): Promise<URL> {
  let url: URL;
  try { url = new URL(raw); } catch { throw new HttpError(400, "URL inválida"); }
  if (url.protocol !== "https:" || url.username || url.password || isPrivateIp(url.hostname)) throw new HttpError(400, "Somente endereços HTTPS públicos são permitidos");
  if (allowedSuffix && !(url.hostname === allowedSuffix || url.hostname.endsWith(`.${allowedSuffix}`))) throw new HttpError(400, "Domínio não permitido");
  try {
    const resolved = await Deno.resolveDns(url.hostname, "A");
    if (!resolved.length || resolved.some(isPrivateIp)) throw new HttpError(400, "Destino privado não permitido");
  } catch (e) { if (e instanceof HttpError) throw e; throw new HttpError(400, "Não foi possível validar o domínio"); }
  return url;
}

export function safeError(error: unknown, corsHeaders: Record<string, string>) {
  const status = error instanceof HttpError ? error.status : 500;
  const message = error instanceof HttpError ? error.message : "Erro interno";
  return new Response(JSON.stringify({ error: message }), { status, headers: { ...corsHeaders, ...jsonHeaders } });
}
