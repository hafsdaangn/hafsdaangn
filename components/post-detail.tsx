"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  MapPin,
  PackageOpen,
  Pencil,
  Trash2,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import {
  type Conversation,
  isMarket,
  priceLabel,
  relativeTime,
} from "@/lib/domain";
import { useApp } from "./provider";
import {
  Avatar,
  Empty,
  ErrorNotice,
  PageHeading,
  PostPhoto,
  Spinner,
  StatusBadge,
} from "./ui";
import { PostForm } from "./post-form";
export function PostDetail({
  id,
  edit = false,
}: {
  id: string;
  edit?: boolean;
}) {
  const { state, base, mutate, addPosts } = useApp(),
    router = useRouter(),
    [index, setIndex] = useState(0),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [confirm, setConfirm] = useState(false),
    [loaded, setLoaded] = useState(false),
    [missing, setMissing] = useState(false);
  useEffect(() => {
    let active = true;
    fetch(`/api/posts?id=${encodeURIComponent(id)}`)
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error);
        if (active) {
          addPosts(d.posts);
          setMissing(d.posts.length === 0);
          setLoaded(true);
        }
      })
      .catch((e) => {
        if (active) {
          setError(e.message);
          setLoaded(true);
        }
      });
    return () => {
      active = false;
    };
  }, [id, addPosts]);
  if (!state) return null;
  const post = missing
    ? undefined
    : state.posts.find((p) => p.id === id && !p.deleted_at);
  if (!post)
    return loaded ? (
      <section className="page-width">
        <PageHeading title="게시글" back={base} />
        <Empty
          title="게시글을 찾을 수 없어요"
          body="삭제되었거나 접근할 수 없는 글이에요."
        />
        <ErrorNotice message={error} />
      </section>
    ) : (
      <div className="loading-page">
        <Spinner />
      </div>
    );
  const author = state.profiles.find((p) => p.id === post.author_id),
    mine = post.author_id === state.viewer.id,
    market = isMarket(post.kind);
  if (edit)
    return mine ? (
      <PostForm post={post} lost={!market} />
    ) : (
      <Empty title="내 게시글만 수정할 수 있어요" />
    );
  async function action(op: string, payload: Record<string, unknown>) {
    setBusy(true);
    setError("");
    try {
      return await mutate<Conversation>(op, payload);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function contact() {
    const c = await action("conversation.create", { post_id: id });
    if (c) router.push(`${base}/chats/${c.id}`);
  }
  const existing = state.conversations.find(
    (c) =>
      c.post_id === id &&
      (c.buyer_id === state.viewer.id || c.seller_id === state.viewer.id),
  );
  return (
    <section className="detail-page">
      <PageHeading
        title={market ? "나눔 상세" : "분실물 상세"}
        back={market ? base : `${base}/lost`}
      />
      <div className="detail-grid">
        <div className="detail-photo">
          <PostPhoto post={post} index={index} />
          {post.image_ids.length > 1 && (
            <>
              <div className="photo-counter">
                {index + 1} / {post.image_ids.length}
              </div>
              <button
                className="photo-prev icon-button"
                aria-label="이전 사진"
                onClick={() =>
                  setIndex(
                    (index + post.image_ids.length - 1) % post.image_ids.length,
                  )
                }
              >
                <ChevronLeft />
              </button>
              <button
                className="photo-next icon-button"
                aria-label="다음 사진"
                onClick={() => setIndex((index + 1) % post.image_ids.length)}
              >
                <ChevronRight />
              </button>
            </>
          )}
        </div>
        <div className="detail-info">
          <div className="seller">
            <Avatar name={author?.display_name} />
            <div>
              {author?.display_name && <strong>{author.display_name}</strong>}
            </div>
            {mine && <span className="mine-label">내 게시글</span>}
          </div>
          <div className="detail-copy">
            <StatusBadge post={post} />
            <h1>{post.title}</h1>
            <p className="metadata">
              {market ? post.category : priceLabel(post)} ·{" "}
              {relativeTime(post.created_at)}
            </p>
            {market && post.kind !== "giveaway" && (
              <strong className="detail-price">{priceLabel(post)}</strong>
            )}
            <p className="description">{post.body}</p>
            {!market && post.place && (
              <div className="location-info">
                <MapPin size={19} />
                <div>
                  <span>분실·발견 장소</span>
                  <strong>{post.place}</strong>
                </div>
              </div>
            )}
            {post.kind === "found" && post.custody && (
              <div className="location-info">
                <PackageOpen size={19} />
                <div>
                  <span>보관 방법</span>
                  <strong>{post.custody}</strong>
                </div>
              </div>
            )}
          </div>
          <ErrorNotice message={error} />
          {mine ? (
            <div className="owner-actions">
              <label htmlFor="post-status">진행 상태</label>
              <select
                id="post-status"
                disabled={busy}
                value={post.status}
                onChange={(e) =>
                  void action("post.status", {
                    id,
                    status: e.target.value,
                    updated_at: post.updated_at,
                  })
                }
              >
                <option value="active">{market ? "나눔 중" : "찾는 중"}</option>
                {market && <option value="reserved">예약 중</option>}
                <option value="completed">
                  {market ? "나눔 완료" : "해결 완료"}
                </option>
              </select>
              <div className="owner-buttons">
                <Link
                  className="button ghost"
                  href={`${base}/posts/${id}/edit`}
                >
                  <Pencil size={15} />
                  수정
                </Link>
                <button
                  className="button ghost danger"
                  onClick={() => setConfirm(true)}
                >
                  <Trash2 size={15} />
                  삭제
                </button>
              </div>
              {confirm && (
                <div className="confirm-panel" role="alert">
                  <p>게시글을 삭제할까요? 기존 채팅은 유지돼요.</p>
                  <div>
                    <button
                      className="button secondary"
                      onClick={() => setConfirm(false)}
                    >
                      취소
                    </button>
                    <button
                      className="button danger-solid"
                      disabled={busy}
                      onClick={async () => {
                        const result = await action("post.delete", { id });
                        if (result) router.push(market ? base : `${base}/lost`);
                      }}
                    >
                      삭제하기
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="detail-action">
              <div>
                <small>{market ? "가격" : "분실물 연결"}</small>
                <strong>{priceLabel(post)}</strong>
              </div>
              <button
                className="button primary"
                disabled={busy || (post.status === "completed" && !existing)}
                onClick={() =>
                  existing
                    ? router.push(`${base}/chats/${existing.id}`)
                    : void contact()
                }
              >
                {busy ? (
                  <Spinner />
                ) : existing ? (
                  "대화 이어가기"
                ) : post.status === "completed" ? (
                  "완료된 게시글"
                ) : market ? (
                  "채팅하기"
                ) : post.kind === "lost" ? (
                  "관련 정보 보내기"
                ) : (
                  "제 물건 같아요"
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
