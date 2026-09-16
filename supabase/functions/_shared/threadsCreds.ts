// Busca as credenciais do app do Threads de um usuário (com fallback para as
// variáveis de ambiente globais, caso o usuário ainda não tenha cadastrado).
export async function getThreadsAppCredentials(admin: any, userId: string) {
  const { data } = await admin
    .from("threads_app_credentials")
    .select("app_id, app_secret")
    .eq("user_id", userId)
    .maybeSingle();

  let appId = data?.app_id || null;
  let appSecret = data?.app_secret || null;

  if (appSecret && String(appSecret).startsWith("ENCRYPTED:")) {
    const { data: decrypted } = await admin.rpc("decrypt_credential", { val: appSecret, enc_key: "" });
    appSecret = decrypted || null;
  }

  if (!appId) appId = Deno.env.get("THREADS_APP_ID") || null;
  if (!appSecret) appSecret = Deno.env.get("THREADS_APP_SECRET") || null;

  return { appId, appSecret };
}
