import { NextResponse } from "next/server";
import { configured } from "@/lib/supabase/server";
import {
  appOrigin,
  beginGoogleLogin,
  cookieOptions,
  oauthCookie,
} from "@/lib/google-oauth";
export async function GET(request: Request) {
  const origin = process.env.APP_URL
    ? appOrigin()
    : new URL(request.url).origin;
  if (!configured())
    return NextResponse.redirect(new URL("/?error=setup", origin));
  const transaction = await beginGoogleLogin();
  const response = NextResponse.redirect(transaction.url);
  response.cookies.set(oauthCookie, transaction.cookie, {
    ...cookieOptions(),
    maxAge: 600,
  });
  response.headers.set("Cache-Control", "private, no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}
