"use client";
import { useEffect, useState } from "react";
import { LogOut, ChevronRight, ShieldCheck } from "lucide-react";
import { nicknameSchema, type Post } from "@/lib/domain";
import { useApp } from "./provider";
import {
  Avatar,
  Empty,
  ErrorNotice,
  PageHeading,
  PostCard,
  Spinner,
} from "./ui";
export function Nickname({ onDone }: { onDone?: () => void }) {
  const { state, mutate } = useApp(),
    [name, setName] = useState(state?.viewer.nickname ?? ""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        const valid = nicknameSchema.safeParse(name);
        if (!valid.success) {
          setError(valid.error.issues[0].message);
          return;
        }
        setBusy(true);
        try {
          await mutate("profile.save", { nickname: valid.data });
          onDone?.();
        } catch (e) {
          setError((e as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <div className="field">
        <label htmlFor="nickname">닉네임</label>
        <input
          id="nickname"
          value={name}
          onChange={(e) => setName(e.target.value)}
          minLength={2}
          maxLength={16}
          required
          placeholder="학교에서 사용할 닉네임"
        />
        <p className="field-help">
          2~16자. 실명이나 학번을 공개할 필요는 없어요.
        </p>
      </div>
      <ErrorNotice message={error} />
      <button className="button primary full" disabled={busy}>
        {busy ? <Spinner /> : onDone ? "저장하기" : "합스당근 시작하기"}
      </button>
    </form>
  );
}
export function ProfilePage() {
  const { state } = useApp(),
    [edit, setEdit] = useState(false),
    [tab, setTab] = useState("active"),
    [confirm, setConfirm] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [ownPosts, setOwnPosts] = useState<Post[]>([]),
    [more, setMore] = useState(false),
    [loading, setLoading] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    queueMicrotask(() => setLoading(true));
    fetch(`/api/posts?mine=true&completed=${tab === "completed"}`, {
      signal: controller.signal,
    })
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error);
        setOwnPosts(d.posts);
        setMore(d.hasMore);
      })
      .catch((e) => {
        if (e.name !== "AbortError") setError(e.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [tab]);
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
      setOwnPosts((old) => [...old, ...d.posts]);
      setMore(d.hasMore);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }
  if (!state) return null;
  const posts = ownPosts;
  async function session(action: string) {
    setBusy(true);
    try {
      const r = await fetch("/api/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
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
        <Avatar name={state.viewer.nickname} large />
        <div>
          <h2>{state.viewer.nickname}</h2>
          <p>
            <ShieldCheck size={14} />
            Google 계정 인증
          </p>
        </div>
        <button className="button secondary" onClick={() => setEdit(!edit)}>
          {edit ? "닫기" : "프로필 수정"}
        </button>
      </div>
      {edit && (
        <div className="profile-edit">
          <Nickname onDone={() => setEdit(false)} />
        </div>
      )}
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
          body="사용하지 않는 물건을 학교 친구와 나눠보세요."
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
        <button disabled={busy} onClick={() => void session("logout")}>
          <LogOut size={18} />
          로그아웃
          <ChevronRight size={17} />
        </button>
        <button className="withdraw" onClick={() => setConfirm(!confirm)}>
          회원 탈퇴
        </button>
      </div>
      {confirm && (
        <div className="confirm-panel">
          <h3>합스당근을 탈퇴할까요?</h3>
          <p>
            프로필은 익명화되고 게시글은 숨겨져요. 기존 상대방의 대화 기록은
            유지돼요. 재가입은 현재 지원하지 않아요.
          </p>
          <button
            className="button danger-solid"
            disabled={busy}
            onClick={() => void session("delete")}
          >
            {busy ? <Spinner /> : "탈퇴하기"}
          </button>
        </div>
      )}
      <ErrorNotice message={error} />
    </section>
  );
}
