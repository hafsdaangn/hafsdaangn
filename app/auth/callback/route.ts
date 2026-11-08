import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { configured, storageAdmin } from "@/lib/supabase/server";
import { ensureAuthPolicy } from "@/lib/auth-policy";
import { forgetPushDevice } from "@/lib/push";
import {
  appOrigin,
  cookieOptions,
  finishGoogleLogin,
  GoogleMembershipError,
  oauthCookie,
  randomToken,
  readGoogleTransaction,
  sessionCookie,
  sessionSeconds,
  tokenHash,
} from "@/lib/google-oauth";
export async function GET(request: Request) {
  const url = new URL(request.url);
  const origin = process.env.APP_URL ? appOrigin() : url.origin;
  const redirect = (path: string) => {
    const response = NextResponse.redirect(new URL(path, origin));
    response.cookies.set(oauthCookie, "", { ...cookieOptions(), maxAge: 0 });
    response.headers.set("Cache-Control", "private, no-store");
    response.headers.set("Referrer-Policy", "no-referrer");
    return response;
  };
  if (!configured())
    return NextResponse.redirect(new URL("/?error=setup", origin));
  try {
    const code = url.searchParams.get("code"),
      state = url.searchParams.get("state");
    const jar = await cookies(),
      cookie = jar.get(oauthCookie)?.value;
    if (!code || !state || !cookie || url.searchParams.has("error"))
      return redirect("/?error=login");
    const transaction = await readGoogleTransaction(cookie, state);
    const identity = await finishGoogleLogin(code, transaction);
    await ensureAuthPolicy();
    const token = randomToken();
    const { data, error } = await storageAdmin().rpc("google_login", {
      google_sub: identity.sub,
      google_email: identity.email,
      google_name: identity.name,
      session_hash: tokenHash(token),
    });
    if (error || !data)
      throw new Error("Could not establish application session.");
    const previous = jar.get(sessionCookie())?.value;
    if (previous) {
      const { error: revokeError } = await storageAdmin().rpc(
        "revoke_app_session",
        { session_hash: tokenHash(previous) },
      );
      if (revokeError) throw new Error("Could not rotate application session.");
    }
    await forgetPushDevice();
    const response = redirect("/app");
    response.cookies.set(sessionCookie(), token, {
      ...cookieOptions(),
      maxAge: sessionSeconds,
    });
    return response;
  } catch (error) {
    return redirect(
      error instanceof GoogleMembershipError
        ? "/?error=school"
        : "/?error=login",
    );
  }
}
