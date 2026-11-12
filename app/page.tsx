import { appEnvironment } from "@/lib/environment";
import { Brand } from "@/components/brand";
import { InstallEntry } from "@/components/install-entry";
import { LandingLogin } from "@/components/landing-login";
import { configured } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { member, MembershipError } from "@/lib/auth";
export default async function Landing({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const development = appEnvironment() === "development";
  let { error } = await searchParams;
  const ready = configured();
  if (ready) {
    let signedIn = false;
    try {
      await member();
      signedIn = true;
    } catch (cause) {
      // A failed lookup must not clear a durable session or imply a wrong account.
      if (!(cause instanceof MembershipError)) error = "connection";
    }
    // Keep redirect outside the catch: Next.js implements it by throwing.
    if (signedIn) redirect("/app");
  }
  const errors: Record<string, string> = {
    setup: "로그인 연결을 준비하고 있어요. 서비스 설정 후 이용할 수 있어요.",
    school: development
      ? "Google 계정으로 다시 로그인해 주세요."
      : "선택한 계정은 이용할 수 없어요. @hafs.hs.kr 학교 Google 계정을 선택해 주세요.",
    session: "로그인 상태가 만료되었거나 해제됐어요. 다시 로그인해 주세요.",
    connection: "로그인 상태를 확인하지 못했어요. 잠시 후 새로고침해 주세요.",
    login: "로그인을 완료하지 못했어요. 잠시 후 다시 시도해 주세요.",
  };
  return (
    <div className="landing">
      <main className="landing-main">
        <div className="landing-copy">
          <h1>
            <Brand full />
          </h1>
          <div className="login-actions">
            <LandingLogin ready={ready}>
              {development
                ? "Google 계정으로 시작하기"
                : "학교 Google 계정으로 시작하기"}
            </LandingLogin>
            <InstallEntry landing />
            {error && (
              <p className="error-notice" role="alert">
                {errors[error] ?? errors.login}
              </p>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
