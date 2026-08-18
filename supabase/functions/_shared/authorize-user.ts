import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

export class AuthorizationError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "AuthorizationError";
    this.status = status;
  }
}

export type AuthorizedUser = {
  userId: string;
  isServiceCall: boolean;
};

export async function authorizeUserRequest(
  req: Request,
  requestedUserId?: string | null,
): Promise<AuthorizedUser> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    throw new AuthorizationError("Server authentication is not configured", 500);
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    throw new AuthorizationError("Unauthorized", 401);
  }

  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) throw new AuthorizationError("Unauthorized", 401);

  if (token === serviceRoleKey) {
    if (!requestedUserId) {
      throw new AuthorizationError("userId is required for internal calls", 400);
    }
    return { userId: requestedUserId, isServiceCall: true };
  }

  const client = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data, error } = await client.auth.getUser(token);
  if (error || !data?.user) throw new AuthorizationError("Unauthorized", 401);

  if (requestedUserId && requestedUserId !== data.user.id) {
    throw new AuthorizationError("Forbidden", 403);
  }

  return { userId: data.user.id, isServiceCall: false };
}
