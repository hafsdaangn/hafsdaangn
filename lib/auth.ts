import "server-only";
import { isAuthSessionMissingError } from "@supabase/supabase-js";
import { serverClient } from "@/lib/supabase/server";
import { allowedEmail } from "@/lib/environment";
import { ensureAuthPolicy } from "@/lib/auth-policy";
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
    return error.reason === "session" ? "/" : "/?error=school";
  return "/?error=login";
}

export async function member() {
  const client = await serverClient();
  const {
    data: { user },
    error,
  } = await client.auth.getUser();
  // Installed web apps can start with a separate, empty cookie store. That is
  // an ordinary sign-in, not a rejected school account.
  if (!user) {
    if (
      error &&
      !isAuthSessionMissingError(error) &&
      ![
        "session_not_found",
        "refresh_token_not_found",
        "refresh_token_already_used",
        "bad_jwt",
        "user_not_found",
      ].includes(error.code ?? "")
    )
      throw error;
    throw new MembershipError("session");
  }
  if (error) throw error;
  if (
    !allowedEmail(user.email) ||
    !user.email_confirmed_at ||
    !user.identities?.some((i) => i.provider === "google")
  )
    throw new MembershipError("school");
  await ensureAuthPolicy();
  const { data: allowed, error: accessError } = await client.rpc("is_member");
  if (accessError) throw accessError;
  if (!allowed) throw new MembershipError("school");
  return { client, user };
}
