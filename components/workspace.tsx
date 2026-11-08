"use client";
import Link from "./app-link";
import { usePathname, useSearchParams } from "next/navigation";
import { Home, PackageSearch, MessageCircle, UserRound } from "lucide-react";
import { isMarket, unreadCount } from "@/lib/domain";
import { useApp } from "./provider";
import { Brand, ErrorNotice, Spinner } from "./ui";
import { Feed } from "./feed";
import { PostDetail } from "./post-detail";
import { PostForm } from "./post-form";
import { Chats } from "./chats";
import { ProfilePage } from "./profile";
import { PushSettings } from "./push-settings";
import { PushPermissionDialog } from "./push-permission-dialog";
import { PushDeviceProvider } from "./push-device-provider";
import { InstallEntry } from "./install-entry";
export function Workspace() {
  const { state } = useApp();
  return (
    <PushDeviceProvider
      key={state?.viewer.id ?? "guest"}
      userId={state?.viewer.id}
    >
      <WorkspaceContent />
    </PushDeviceProvider>
  );
}
function WorkspaceContent() {
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
  const currentPost =
    section === "posts"
      ? state?.posts.find((post) => post.id === path[1] && !post.deleted_at)
      : undefined;
  const activeSection =
    section === "posts"
      ? currentPost
        ? isMarket(currentPost.kind)
          ? "market"
          : "lost"
        : null
      : section === "new"
        ? params.get("type") === "lost"
          ? "lost"
          : "market"
        : section;
  const navigation = [
    {
      path: "",
      label: "나눔",
      icon: Home,
      active: activeSection === "market",
    },
    {
      path: "/lost",
      label: "분실물",
      icon: PackageSearch,
      active: activeSection === "lost",
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
      <PushPermissionDialog eligible={!focus && section !== "me"} />
      <header className="site-header">
        <div className="header-inner">
          <Link href={base} aria-label="합스당근 나눔">
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
          <InstallEntry />
        </div>
      </header>
      <main id="content">
        {!state && section !== "market" && section !== "lost" ? (
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
                <p>내용을 불러오는 중이에요.</p>
              </>
            )}
          </div>
        ) : (
          <>
            {error && (
              <div className="page-width">
                <ErrorNotice message={error} />
                {!state && (
                  <button
                    className="button secondary"
                    onClick={() => void refresh()}
                  >
                    다시 불러오기
                  </button>
                )}
              </div>
            )}
            {section === "market" ? (
              <Feed key="market" />
            ) : section === "lost" ? (
              <Feed lost key="lost" />
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
              path[1] === "notifications" ? (
                <PushSettings />
              ) : (
                <ProfilePage />
              )
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
