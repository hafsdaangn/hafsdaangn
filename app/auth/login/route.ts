import { NextResponse } from "next/server";
import { configured, serverClient } from "@/lib/supabase/server";
import { appEnvironment } from "@/lib/environment";
import { ensureAuthPolicy } from "@/lib/auth-policy";
export async function GET(request: Request) {
  const origin = new URL(process.env.APP_URL || request.url).origin;
  if (!configured())
    return NextResponse.redirect(new URL("/?error=setup", origin));
  try {
    await ensureAuthPolicy();
  } catch {
    return NextResponse.redirect(new URL("/?error=setup", origin));
  }
  const client = await serverClient();
  const { data, error } = await client.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${origin}/auth/callback`,
      queryParams:
        appEnvironment() === "production"
          ? { hd: "hafs.hs.kr", prompt: "select_account" }
          : { prompt: "select_account" },
    },
  });
  return NextResponse.redirect(
    error || !data.url ? new URL("/?error=login", origin) : data.url,
  );
}
