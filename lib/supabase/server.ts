import "server-only";
import { createClient } from "@supabase/supabase-js";
import { googleConfigured } from "@/lib/google-oauth";
import { databaseTokenConfigured } from "@/lib/database-token";
export const configured = () =>
  Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY &&
    process.env.SUPABASE_SECRET_KEY &&
    googleConfigured() &&
    databaseTokenConfigured(),
  );
export function databaseClient(token: string) {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      accessToken: async () => token,
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    },
  );
}
export function storageAdmin() {
  if (!process.env.SUPABASE_SECRET_KEY)
    throw new Error("서버 비밀 키를 설정해 주세요.");
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    },
  );
}
