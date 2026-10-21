import { NextResponse } from "next/server";
import { serverClient } from "@/lib/supabase/server";
import { member } from "@/lib/auth";
export async function GET(request: Request) {
  const url = new URL(request.url),
    origin = new URL(process.env.APP_URL || url).origin;
  const code = url.searchParams.get("code");
  const client = await serverClient();
  if (code) {
    const { error } = await client.auth.exchangeCodeForSession(code);
    if (!error) {
      try {
        await member();
        return NextResponse.redirect(new URL("/app", origin));
      } catch {
        await client.auth.signOut();
      }
    }
  }
  return NextResponse.redirect(new URL("/?error=school", origin));
}
