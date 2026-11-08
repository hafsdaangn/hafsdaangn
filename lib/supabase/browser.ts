"use client";
import { createClient } from "@supabase/supabase-js";
let client: ReturnType<typeof createClient> | undefined;
let cached: { token: string; expiresAt: number } | undefined;
let pending: Promise<string> | undefined;
export async function realtimeToken() {
  if (cached && cached.expiresAt > Date.now() + 30000) return cached.token;
  if (!pending)
    pending = (async () => {
      const response = await fetch("/api/session", {
        cache: "no-store",
        signal: AbortSignal.timeout(10000),
      });
      if (!response.ok) throw new Error("로그인 상태를 확인해 주세요.");
      const data = await response.json();
      if (typeof data.accessToken !== "string")
        throw new Error("Invalid realtime session.");
      cached = { token: data.accessToken, expiresAt: Date.now() + 240000 };
      return cached.token;
    })().finally(() => {
      pending = undefined;
    });
  return pending;
}
export function browserClient() {
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  )
    return null;
  return (client ??= createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      accessToken: realtimeToken,
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    },
  ));
}
