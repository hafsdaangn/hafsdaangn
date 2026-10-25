"use client";
import { useEffect, useState, useRef } from "react";
import { useSearchParams, usePathname } from "next/navigation";
import { SlidersHorizontal, ArrowDown, X } from "lucide-react";
import { categories, places, type Post } from "@/lib/domain";
import { useApp } from "./provider";
import {
  Empty,
  ErrorNotice,
  PageHeading,
  PostCard,
  SearchInput,
  Spinner,
  WriteButton,
} from "./ui";
export function Feed({ lost = false }: { lost?: boolean }) {
  const { state, addPosts } = useApp(),
    params = useSearchParams(),
    path = usePathname();
  const q = params.get("q") ?? "",
    category = params.get("category") ?? "전체",
    kind = params.get("kind") ?? "all",
    place = params.get("place") ?? "전체",
    available = params.get("available") !== "false";
  const [search, setSearch] = useState(q),
    [busy, setBusy] = useState(true),
    [error, setError] = useState(""),
    [remote, setRemote] = useState<Post[]>([]),
    [more, setMore] = useState(false);
  const version = useRef(0),
    latest = useRef(params.toString());
  useEffect(() => {
    latest.current = params.toString();
  }, [params]);
  function filter(key: string, value: string) {
    const next = new URLSearchParams(latest.current);
    if (value === "all" || value === "전체" || value === "") next.delete(key);
    else next.set(key, value);
    latest.current = next.toString();
    window.history.replaceState(
      null,
      "",
      `${path}${next.size ? `?${next}` : ""}`,
    );
  }
  useEffect(() => {
    const timer = setTimeout(() => {
      if (search !== q) {
        const next = new URLSearchParams(latest.current);
        if (search) next.set("q", search);
        else next.delete("q");
        latest.current = next.toString();
        window.history.replaceState(
          null,
          "",
          `${path}${next.size ? `?${next}` : ""}`,
        );
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [search, q, path]);
  useEffect(() => {
    queueMicrotask(() => setSearch(q));
  }, [q]);
  const query = new URLSearchParams({
    type: lost ? "lost" : "market",
    q,
    available: String(available),
  });
  if (category !== "전체") query.set("category", category);
  if (kind !== "all") query.set("kind", kind);
  if (place !== "전체") query.set("place", place);
  const queryString = query.toString();
  useEffect(() => {
    const controller = new AbortController(),
      n = ++version.current;
    queueMicrotask(() => {
      setBusy(true);
      setError("");
    });
    fetch(`/api/posts?${queryString}`, { signal: controller.signal })
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error);
        if (n === version.current) {
          setRemote(data.posts);
          setMore(data.hasMore);
        }
      })
      .catch((e) => {
        if (n === version.current && e.name !== "AbortError")
          setError(e.message);
      })
      .finally(() => {
        if (n === version.current) setBusy(false);
      });
    return () => {
      controller.abort();
      version.current = n + 1;
    };
  }, [queryString]);
  // The feed can finish before the rest of the app's initial data.
  const ready = Boolean(state);
  useEffect(() => {
    if (ready && remote.length) addPosts(remote);
  }, [ready, remote, addPosts]);
  const posts = remote;
  async function loadMore() {
    const last = remote.at(-1);
    if (!last || busy) return;
    const n = version.current;
    setBusy(true);
    try {
      const r = await fetch(
          `/api/posts?${queryString}&before=${encodeURIComponent(last.created_at)}&beforeId=${last.id}`,
        ),
        data = await r.json();
      if (!r.ok) throw new Error(data.error);
      if (n !== version.current) return;
      setRemote((old) => [...old, ...data.posts]);
      setMore(data.hasMore);
    } catch (e) {
      if (n === version.current) setError((e as Error).message);
    } finally {
      if (n === version.current) setBusy(false);
    }
  }
  return (
    <section className="feed page-width">
      <div className="feed-intro">
        <div>
          <PageHeading title={lost ? "분실물" : "우리 학교 나눔"} />
          <p>
            {lost
              ? "잃어버린 물건, 여기서 찾아요."
              : "필요한 물건은 가까이, 쓰던 물건은 다음 친구에게."}
          </p>
        </div>
      </div>
      <SearchInput
        value={search}
        onChange={setSearch}
        placeholder={lost ? "물건 이름이나 특징 검색" : "어떤 물건을 찾으세요?"}
      />
      <div className="chips" aria-label={lost ? "분실물 유형" : "카테고리"}>
        {(lost
          ? [
              { label: "전체", value: "all" },
              { label: "잃어버렸어요", value: "lost" },
              { label: "주웠어요", value: "found" },
            ]
          : ["전체", ...categories].map((c) => ({ label: c, value: c }))
        ).map((item) => (
          <button
            key={item.value}
            className={`chip ${(lost ? kind : category) === item.value ? "selected" : ""}`}
            aria-pressed={(lost ? kind : category) === item.value}
            onClick={() => filter(lost ? "kind" : "category", item.value)}
          >
            {item.label}
          </button>
        ))}
      </div>
      <div className="filter-row">
        <div className="filter-controls">
          <SlidersHorizontal size={16} />
          {lost ? (
            <select
              aria-label="장소 필터"
              value={place}
              onChange={(e) => filter("place", e.target.value)}
            >
              <option value="전체">장소 전체</option>
              {places.map((p) => (
                <option key={p}>{p}</option>
              ))}
            </select>
          ) : (
            <select
              aria-label="글 유형 필터"
              value={kind === "all" ? "giveaway" : kind}
              onChange={(e) => filter("kind", e.target.value)}
            >
              <option value="giveaway">나눔</option>
            </select>
          )}
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={available}
              onChange={(e) => filter("available", String(e.target.checked))}
            />
            {lost ? "찾는 중만" : "나눔 가능한 글"}
          </label>
        </div>
        <span className="sort-label">
          최신순 <ArrowDown size={13} />
        </span>
      </div>
      <ErrorNotice message={error} />
      {busy && !posts.length ? (
        <div className="skeleton-list" aria-label="목록 불러오는 중">
          {[1, 2, 3, 4].map((i) => (
            <div className="skeleton" key={i} />
          ))}
        </div>
      ) : posts.length ? (
        <div className="post-grid">
          {posts.map((post) => (
            <PostCard key={post.id} post={post} />
          ))}
        </div>
      ) : (
        <Empty
          title={q ? "검색 결과가 없어요" : "아직 올라온 글이 없어요"}
          body={
            q
              ? "다른 검색어나 필터로 찾아보세요."
              : "첫 번째 글로 학교 친구들과 연결해 보세요."
          }
          action={
            q && (
              <button
                className="button secondary"
                onClick={() => {
                  setSearch("");
                  latest.current = "";
                  window.history.replaceState(null, "", path);
                }}
              >
                <X size={16} />
                필터 초기화
              </button>
            )
          }
        />
      )}
      {more && (
        <button
          className="button secondary load-more"
          disabled={busy}
          onClick={loadMore}
        >
          {busy ? <Spinner /> : "더 보기"}
        </button>
      )}
      <WriteButton lost={lost} />
    </section>
  );
}
