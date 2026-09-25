import Link from "next/link";
import { ShieldCheck, MessageCircle, Search } from "lucide-react";
import { appEnvironment } from "@/lib/environment";
import { Brand } from "@/components/ui";
import { configured } from "@/lib/supabase/server";
export default async function Landing({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const development = appEnvironment() === "development";
  const { error } = await searchParams,
    ready = configured();
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
        <span>우리 학교의 작은 장터</span>
      </header>
      <main className="landing-main">
        <div className="landing-copy">
          <span className="welcome-dot">안녕, HAFS!</span>
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
            <Link
              className={`button google-button ${!ready ? "not-ready" : ""}`}
              href="/auth/login"
            >
              <span className="google-letter" aria-hidden="true">
                G
              </span>
              {development
                ? "Google 계정으로 시작하기"
                : "학교 Google 계정으로 시작하기"}
            </Link>
            <small>
              <ShieldCheck size={14} />
              {development
                ? "개발 환경 · 모든 Google 계정을 사용할 수 있어요"
                : "@hafs.hs.kr 계정만 이용할 수 있어요"}
            </small>
            {error && (
              <p className="error-notice" role="alert">
                {errors[error] ?? errors.login}
              </p>
            )}
          </div>
        </div>
        <div className="landing-art" aria-hidden="true">
          <div className="art-paper">
            <span className="art-label">HAFS / 함께 쓰는 일상</span>
            <div className="large-carrot">
              <i />
              <i />
              <i />
              <b />
            </div>
            <div className="art-caption">
              <strong>가까워서 더 좋은 거래.</strong>
              <span>
                다음 주인도, 잃어버린 주인도
                <br />
                생각보다 가까이 있을 거예요.
              </span>
            </div>
          </div>
          <div className="art-tag tag-one">
            <MessageCircle size={18} />
            점심시간에 만나요!
          </div>
          <div className="art-tag tag-two">
            <Search size={18} />
            찾았어요, 내 물건
          </div>
        </div>
      </main>
      <footer className="landing-footer">
        <span>합스당근 · HAFS 구성원을 위한 중고거래와 분실물 연결</span>
        <span>학교 계정으로, 우리끼리.</span>
      </footer>
    </div>
  );
}
