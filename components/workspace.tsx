"use client";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Home, Search, MessageCircle, UserRound } from "lucide-react";
import { unreadCount } from "@/lib/domain";
import { useApp } from "./provider";
import { Brand, ErrorNotice, Spinner } from "./ui";
import { Feed } from "./feed";
import { PostDetail } from "./post-detail";
import { PostForm } from "./post-form";
import { Chats } from "./chats";
import { Nickname, ProfilePage } from "./profile";
export function Workspace() {
  const { state, base, error, refresh } = useApp(),
    pathname = usePathname(),
    params = useSearchParams();
  const path = pathname.slice(base.length).split("/").filter(Boolean);
  const section = path[0] ?? "market",
    focus =
      section === "posts" ||
      section === "new" ||
      (section === "chats" && !!path[1]);
  const unread =
    state?.conversations.reduce(
      (sum, c) => sum + unreadCount(c, state.messages, state.viewer.id),
      0,
    ) ?? 0;
  const navigation = [
    {
      path: "",
      label: "장터",
      icon: Home,
      active: section === "market" || section === "posts" || section === "new",
    },
    {
      path: "/lost",
      label: "분실물",
      icon: Search,
      active: section === "lost",
    },
    {
      path: "/chats",
      label: "채팅",
      icon: MessageCircle,
      active: section === "chats",
    },
    {
      path: "/me",
      label: "내 정보",
      icon: UserRound,
      active: section === "me",
    },
  ];
  return (
    <div
      className={`app-shell ${focus ? "focused" : ""} ${section === "chats" ? "chat-shell" : ""}`}
    >
      <a className="skip-link" href="#content">
        본문으로 이동
      </a>
      <header className="site-header">
        <div className="header-inner">
          <Link href={base} aria-label="합스당근 장터">
            <Brand />
          </Link>
          <nav aria-label="주요 메뉴">
            {navigation.map(({ path, label, active }) => (
              <Link
                className={active ? "active" : ""}
                href={`${base}${path}`}
                key={label}
              >
                {label}
                {label === "채팅" && unread > 0 && <span className="nav-dot" />}
              </Link>
            ))}
          </nav>
          <span className="header-note">우리 학교에서 시작하는 연결</span>
        </div>
      </header>
      <main id="content">
        {!state ? (
          <div className="loading-page">
            {error ? (
              <>
                <ErrorNotice message={error} />
                <button
                  className="button secondary"
                  onClick={() => void refresh()}
                >
                  다시 불러오기
                </button>
                <Link href="/">로그인으로 돌아가기</Link>
              </>
            ) : (
              <>
                <Spinner />
                <p>학교 소식을 불러오는 중이에요</p>
              </>
            )}
          </div>
        ) : !state.viewer.nickname ? (
          <section className="onboarding">
            <span className="welcome-dot">반가워요!</span>
            <h1>
              어떤 이름으로
              <br />
              만나볼까요?
            </h1>
            <p>학교 친구들에게 보일 닉네임을 정해 주세요.</p>
            <Nickname />
          </section>
        ) : (
          <>
            {error && (
              <div className="page-width">
                <ErrorNotice message={error} />
              </div>
            )}
            {section === "market" ? (
              <Feed />
            ) : section === "lost" ? (
              <Feed lost />
            ) : section === "posts" ? (
              <PostDetail
                id={path[1]}
                edit={path[2] === "edit"}
                key={path.join("/")}
              />
            ) : section === "new" ? (
              <PostForm lost={params.get("type") === "lost"} />
            ) : section === "chats" ? (
              <Chats id={path[1]} key={path[1] ?? "list"} />
            ) : section === "me" ? (
              <ProfilePage />
            ) : (
              <Feed />
            )}
          </>
        )}
      </main>
      {!focus && (
        <nav className="bottom-nav" aria-label="하단 메뉴">
          {navigation.map(({ path, label, icon: Icon, active }) => (
            <Link
              href={`${base}${path}`}
              className={active ? "active" : ""}
              key={label}
            >
              <span>
                <Icon size={23} strokeWidth={active ? 2.2 : 1.7} />
                {label === "채팅" && unread > 0 && <span className="nav-dot" />}
              </span>
              {label}
            </Link>
          ))}
        </nav>
      )}
    </div>
  );
}
