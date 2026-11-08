"use client";
import { useEffect, useState } from "react";
import Link from "./app-link";
import { Bell, LogOut, ChevronRight } from "lucide-react";
import type { Post } from "@/lib/domain";
import { useApp } from "./provider";
import {
  Avatar,
  Empty,
  ErrorNotice,
  PageHeading,
  PostCard,
  Spinner,
} from "./ui";
export function ProfilePage() {
  const { state, base, getFeed, loadPosts, addPosts, cacheFeed } = useApp(),
    [tab, setTab] = useState("active"),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [ownPosts, setOwnPosts] = useState<Post[]>(
      getFeed("mine=true&completed=false")?.posts ?? [],
    ),
    [more, setMore] = useState(false),
    [loading, setLoading] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    const query = `mine=true&completed=${tab === "completed"}`;
    const cached = getFeed(query);
    queueMicrotask(() => {
      if (controller.signal.aborted) return;
      setOwnPosts(cached?.posts ?? []);
      setMore(cached?.hasMore ?? false);
      setLoading(true);
      setError("");
    });
    loadPosts(query)
      .then((d) => {
        if (controller.signal.aborted) return;
        addPosts(d.posts, d.profiles);
        setOwnPosts(d.posts);
        setMore(d.hasMore);
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(e.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [tab, getFeed, loadPosts, addPosts]);
  async function loadMore() {
    const last = ownPosts.at(-1);
    if (!last) return;
    setLoading(true);
    try {
      const r = await fetch(
          `/api/posts?mine=true&completed=${tab === "completed"}&before=${encodeURIComponent(last.created_at)}&beforeId=${last.id}`,
        ),
        d = await r.json();
      if (!r.ok) throw new Error(d.error);
      const posts = [...ownPosts, ...d.posts];
      cacheFeed(
        `mine=true&completed=${tab === "completed"}`,
        posts,
        d.hasMore,
        d.profiles,
      );
      addPosts(d.posts, d.profiles);
      setOwnPosts(posts);
      setMore(d.hasMore);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }
  if (!state) return null;
  const posts = ownPosts;
  async function logout() {
    setBusy(true);
    try {
      const r = await fetch("/api/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "logout" }),
      });
      if (!r.ok) throw new Error((await r.json()).error);
      window.location.assign("/");
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }
  return (
    <section className="profile-page page-width">
      <PageHeading title="내 정보" />
      <div className="profile-header">
        <Avatar name={state.viewer.display_name} large />
        <div>
          <h2>{state.viewer.display_name}</h2>
        </div>
      </div>
      <div className="profile-tabs">
        <button
          className={tab === "active" ? "active" : ""}
          onClick={() => setTab("active")}
        >
          내 게시글
        </button>
        <button
          className={tab === "completed" ? "active" : ""}
          onClick={() => setTab("completed")}
        >
          완료한 글
        </button>
      </div>
      {loading && !posts.length ? (
        <div className="empty">
          <Spinner />
        </div>
      ) : posts.length ? (
        <div className="post-grid">
          {posts.map((p) => (
            <PostCard post={p} key={p.id} />
          ))}
        </div>
      ) : (
        <Empty
          title="아직 게시글이 없어요"
          body="사용하지 않는 물건을 나눠보세요."
        />
      )}
      {more && (
        <button
          className="button secondary load-more"
          disabled={loading}
          onClick={loadMore}
        >
          {loading ? <Spinner /> : "더 보기"}
        </button>
      )}
      <div className="settings-list">
        <Link href={`${base}/me/notifications`}>
          <Bell size={18} />
          알림 설정
          <ChevronRight size={17} />
        </Link>
        <button disabled={busy} onClick={() => void logout()}>
          <LogOut size={18} />
          로그아웃
          <ChevronRight size={17} />
        </button>
      </div>
      <ErrorNotice message={error} />
    </section>
  );
}
