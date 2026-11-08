import { redirect } from "next/navigation";
import { AppProvider } from "@/components/provider";
import { member, memberLoginPath } from "@/lib/auth";
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
  } catch (error) {
    redirect(memberLoginPath(error));
  }
  return <AppProvider>{children}</AppProvider>;
}
