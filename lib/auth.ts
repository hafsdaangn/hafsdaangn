import "server-only";
import { serverClient } from "@/lib/supabase/server";
import { allowedEmail } from "@/lib/environment";
import { ensureAuthPolicy } from "@/lib/auth-policy";
export async function member() {
  await ensureAuthPolicy();
  const client = await serverClient();
  const {
    data: { user },
    error,
  } = await client.auth.getUser();
  if (
    error ||
    !user ||
    !allowedEmail(user.email) ||
    !user.email_confirmed_at ||
    !user.identities?.some((i) => i.provider === "google")
  )
    throw new Error("허용된 Google 계정으로 로그인해 주세요.");
  const { data: allowed, error: accessError } = await client.rpc("is_member");
  if (accessError || !allowed)
    throw new Error("학교 계정으로 다시 로그인해 주세요.");
  return { client, user };
}
