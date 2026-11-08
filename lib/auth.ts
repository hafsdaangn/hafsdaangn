import "server-only";
import { cookies } from "next/headers";
import { databaseClient, storageAdmin } from "@/lib/supabase/server";
import { allowedEmail } from "@/lib/environment";
import { ensureAuthPolicy } from "@/lib/auth-policy";
import { sessionCookie, tokenHash } from "@/lib/google-oauth";
import { databaseToken } from "@/lib/database-token";
export class MembershipError extends Error {
  constructor(public readonly reason: "session" | "school") {
    super(
      reason === "session"
        ? "로그인해 주세요."
        : "학교 Google 계정으로 로그인해 주세요.",
    );
    this.name = "MembershipError";
  }
}
export function memberLoginPath(error: unknown) {
  if (error instanceof MembershipError)
    return error.reason === "session" ? "/?error=session" : "/?error=school";
  return "/?error=connection";
}
export async function member() {
  const token = (await cookies()).get(sessionCookie())?.value;
  if (!token || !/^[A-Za-z0-9_-]{43}$/.test(token))
    throw new MembershipError("session");
  await ensureAuthPolicy();
  const { data, error } = await storageAdmin().rpc("app_session", {
    session_hash: tokenHash(token),
  });
  if (error)
    throw new Error(
      "로그인 상태를 확인하지 못했어요. 잠시 후 다시 시도해 주세요.",
    );
  if (!data) throw new MembershipError("session");
  const user = data as { id: string; email: string; session_id: string };
  if (!allowedEmail(user.email)) throw new MembershipError("school");
  const accessToken = await databaseToken(user.id, user.session_id);
  return { user, accessToken, client: databaseClient(accessToken) };
}
