import { redirect } from "next/navigation";
import { appEnvironment } from "@/lib/environment";
import { Brand } from "@/components/ui";
import { configured } from "@/lib/supabase/server";
export default async function Landing({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; code?: string }>;
}) {
  const development = appEnvironment() === "development";
  const { error, code } = await searchParams,
    ready = configured();
  if (code) redirect(`/auth/callback?code=${encodeURIComponent(code)}`);
  const errors: Record<string, string> = {
    setup: "로그인 연결을 준비하고 있어요. 서비스 설정 후 이용할 수 있어요.",
    school: development
      ? "Google 계정으로 다시 로그인해 주세요."
      : "@hafs.hs.kr 학교 Google 계정으로 로그인해 주세요.",
    login: "로그인을 시작하지 못했어요. 잠시 후 다시 시도해 주세요.",
  };
  return (
    <div className="landing">
      <header className="landing-header">
        <Brand />
      </header>
      <main className="landing-main">
        <div className="landing-copy">
          <h1>
            쓰던 물건의
            <br />
            다음 이야기는
            <br />
            <em>우리 학교에서.</em>
          </h1>
          <p>
            필요한 물건을 사고, 나누고.
            <br />
            잃어버린 물건도 다시 만나는 합스당근.
          </p>
          <div className="login-actions">
            <a
              className={`button google-button ${!ready ? "not-ready" : ""}`}
              href="/auth/login"
            >
              {development
                ? "Google 계정으로 시작하기"
                : "학교 Google 계정으로 시작하기"}
            </a>
            {error && (
              <p className="error-notice" role="alert">
                {errors[error] ?? errors.login}
              </p>
            )}
          </div>
        </div>
      </main>
      <footer className="landing-footer">
        <span>합스당근 · HAFS 구성원을 위한 중고거래와 분실물 연결</span>
      </footer>
    </div>
  );
}
