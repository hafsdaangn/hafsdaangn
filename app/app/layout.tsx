import { redirect } from "next/navigation";
import { AppProvider } from "@/components/provider";
import { member } from "@/lib/auth";
import { configured } from "@/lib/supabase/server";
export const dynamic = "force-dynamic";
export default async function PlatformLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!configured()) redirect("/?error=setup");
  try {
    await member();
  } catch {
    redirect("/?error=school");
  }
  return <AppProvider>{children}</AppProvider>;
}
