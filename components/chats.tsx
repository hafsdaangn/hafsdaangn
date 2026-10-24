"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowUp,
  Plus,
  MessageCircle,
  ChevronRight,
} from "lucide-react";
import {
  type Message,
  otherMember,
  unreadCount,
  priceLabel,
  relativeTime,
} from "@/lib/domain";
import { useApp } from "./provider";
import { PushSettings } from "./push-settings";
import {
  Avatar,
  Empty,
  ErrorNotice,
  PageHeading,
  PostPhoto,
  Spinner,
} from "./ui";
type Pending = {
  client_id: string;
  body: string;
  image_id: string | null;
  failed: boolean;
};
export function Chats({ id }: { id?: string }) {
  const { state, base, mutate, upload, image, loadMessages } = useApp(),
    [text, setText] = useState(""),
    [error, setError] = useState(""),
    [pending, setPending] = useState<Pending[]>([]),
    [busy, setBusy] = useState(false),
    [more, setMore] = useState(false),
    [loadingOlder, setLoadingOlder] = useState(false),
    [attachment, setAttachment] = useState<string | null>(null);
  const end = useRef<HTMLDivElement>(null),
    file = useRef<HTMLInputElement>(null),
    lastRead = useRef(0),
    scroller = useRef<HTMLDivElement>(null);
  const room = state?.conversations.find((c) => c.id === id),
    messages = state?.messages.filter((m) => m.conversation_id === id) ?? [],
    lastSeq = messages.at(-1)?.seq ?? 0;
  useEffect(() => {
    lastRead.current = 0;
    if (!id) return;
    let active = true;
    void loadMessages(id)
      .then((value) => {
        if (active) setMore(value);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [id, loadMessages]);
  useEffect(() => {
    if (!id || !lastSeq) return;
    const mark = () => {
      if (document.visibilityState !== "visible" || lastRead.current >= lastSeq)
        return;
      lastRead.current = lastSeq;
      void mutate("message.read", { conversation_id: id, seq: lastSeq }).catch(
        () => {
          lastRead.current = 0;
        },
      );
    };
    mark();
    document.addEventListener("visibilitychange", mark);
    return () => document.removeEventListener("visibilitychange", mark);
  }, [id, lastSeq, mutate]);
  useEffect(() => {
    end.current?.scrollIntoView({ behavior: "instant", block: "end" });
  }, [lastSeq, pending.length]);
  if (!state) return null;
  const rooms = [...state.conversations].sort((a, b) =>
    b.last_message_at.localeCompare(a.last_message_at),
  );
  async function send(item?: Pending) {
    if (!id || (!item && !text.trim() && !attachment)) return;
    const value = item ?? {
      client_id: crypto.randomUUID(),
      body: text.trim(),
      image_id: attachment,
      failed: false,
    };
    if (!item) {
      setText("");
      setAttachment(null);
      setPending((old) => [...old, value]);
    } else
      setPending((old) =>
        old.map((p) =>
          p.client_id === value.client_id ? { ...p, failed: false } : p,
        ),
      );
    try {
      await mutate<Message>("message.send", {
        conversation_id: id,
        client_id: value.client_id,
        body: value.body,
        image_id: value.image_id,
      });
      setPending((old) => old.filter((p) => p.client_id !== value.client_id));
    } catch (e) {
      setError((e as Error).message);
      setPending((old) =>
        old.map((p) =>
          p.client_id === value.client_id ? { ...p, failed: true } : p,
        ),
      );
    }
  }
  async function attach(selected: File | undefined) {
    if (!selected || !id) return;
    setBusy(true);
    setError("");
    try {
      setAttachment(await upload(selected, id));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
      if (file.current) file.current.value = "";
    }
  }
  async function older() {
    if (!id) return;
    setLoadingOlder(true);
    const oldHeight = scroller.current?.scrollHeight ?? 0;
    try {
      setMore(await loadMessages(id, messages[0]?.seq));
      requestAnimationFrame(() => {
        if (scroller.current)
          scroller.current.scrollTop =
            scroller.current.scrollHeight - oldHeight;
      });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoadingOlder(false);
    }
  }
  const opposite = room
      ? state.profiles.find((p) => p.id === otherMember(room, state.viewer.id))
      : null,
    post = state.posts.find((p) => p.id === room?.post_id && !p.deleted_at);
  const readSeq = room
    ? room.seller_id === state.viewer.id
      ? room.buyer_read_seq
      : room.seller_read_seq
    : 0;
  return (
    <section className={`chat-layout ${id ? "has-room" : ""}`}>
      <aside className="chat-sidebar">
        <PageHeading title="채팅" />
        <p className="section-subtitle">물건도, 마음도 가까이.</p>
        <PushSettings />
        <div className="room-list">
          {rooms.length ? (
            rooms.map((c) => {
              const user = state.profiles.find(
                  (p) => p.id === otherMember(c, state.viewer.id),
                ),
                last = state.messages
                  .filter((m) => m.conversation_id === c.id)
                  .at(-1),
                unread = unreadCount(c, state.messages, state.viewer.id);
              return (
                <Link
                  href={`${base}/chats/${c.id}`}
                  className={`room-row ${c.id === id ? "selected" : ""}`}
                  key={c.id}
                >
                  <Avatar name={user?.nickname} />
                  <div className="room-copy">
                    <div>
                      <strong>{user?.nickname || "학교 친구"}</strong>
                      <small>{relativeTime(c.last_message_at)}</small>
                    </div>
                    <p>
                      {c.last_body ||
                        last?.body ||
                        (last?.image_id
                          ? "사진을 보냈어요"
                          : "첫 인사를 건네보세요.")}
                    </p>
                    <small>{c.title}</small>
                  </div>
                  {unread > 0 && (
                    <span className="unread">
                      {unread > 99 ? "99+" : unread}
                    </span>
                  )}
                </Link>
              );
            })
          ) : (
            <Empty
              title="아직 대화가 없어요"
              body="게시글에서 채팅을 시작해 보세요."
            />
          )}
        </div>
      </aside>
      <div className="chat-main">
        {!id ? (
          <Empty
            title="대화를 선택해 주세요"
            body="학교 친구와 거래를 이야기해 보세요."
            action={<MessageCircle size={28} />}
          />
        ) : !room ? (
          <Empty title="대화를 찾을 수 없어요" />
        ) : (
          <>
            <header className="chat-header">
              <Link
                href={`${base}/chats`}
                className="icon-button"
                aria-label="채팅 목록으로"
              >
                <ArrowLeft />
              </Link>
              <Avatar name={opposite?.nickname} />
              <div>
                <strong>{opposite?.nickname || "학교 친구"}</strong>
                <small>Google 계정 인증</small>
              </div>
            </header>
            <Link
              href={post ? `${base}/posts/${post.id}` : `${base}/chats/${id}`}
              className="chat-product"
            >
              {post && (
                <div className="mini-thumb">
                  <PostPhoto post={post} />
                </div>
              )}
              <div>
                <strong>{post?.title ?? room.title}</strong>
                <span>
                  {priceLabel(post ?? room)} ·{" "}
                  {post
                    ? post.status === "completed"
                      ? "완료"
                      : "게시글 보기"
                    : "삭제된 게시글"}
                </span>
              </div>
              {post && <ChevronRight size={18} />}
            </Link>
            <div className="messages" ref={scroller} aria-label="대화 내용">
              <p className="chat-date">대화가 시작되었어요</p>
              {more && (
                <button
                  className="older-button"
                  disabled={loadingOlder}
                  onClick={older}
                >
                  {loadingOlder ? "불러오는 중…" : "이전 메시지 보기"}
                </button>
              )}
              {messages.map((message, i) => {
                const mine = message.sender_id === state.viewer.id,
                  date = new Date(message.created_at).toLocaleDateString(
                    "ko-KR",
                  );
                return (
                  <div key={message.id}>
                    {(i === 0 ||
                      new Date(messages[i - 1].created_at).toLocaleDateString(
                        "ko-KR",
                      ) !== date) && <p className="chat-date">{date}</p>}
                    <div className={`message ${mine ? "mine" : ""}`}>
                      <div className="bubble">
                        {message.image_id && (
                          <a
                            href={image(message.image_id)}
                            target="_blank"
                            rel="noreferrer"
                          >
                            <img
                              src={image(message.image_id)}
                              alt="채팅에 첨부된 사진"
                            />
                          </a>
                        )}
                        {message.body && <p>{message.body}</p>}
                      </div>
                      <span className="message-time">
                        {mine && message.seq <= readSeq && <span>읽음</span>}
                        {new Date(message.created_at).toLocaleTimeString(
                          "ko-KR",
                          { hour: "2-digit", minute: "2-digit", hour12: false },
                        )}
                      </span>
                    </div>
                  </div>
                );
              })}
              {pending
                .filter(
                  (p) => !messages.some((m) => m.client_id === p.client_id),
                )
                .map((p) => (
                  <div className="message mine" key={p.client_id}>
                    <div className="bubble pending">
                      {p.image_id && (
                        <img src={image(p.image_id)} alt="보내는 사진" />
                      )}
                      <p>{p.body}</p>
                    </div>
                    {p.failed ? (
                      <button
                        className="retry-button"
                        onClick={() => void send(p)}
                      >
                        전송 실패 · 재시도
                      </button>
                    ) : (
                      <span className="message-time">전송 중</span>
                    )}
                  </div>
                ))}
              <div ref={end} />
            </div>
            <ErrorNotice message={error} />
            {attachment && (
              <div className="attachment-preview">
                <img src={image(attachment)} alt="첨부할 사진" />
                <button onClick={() => setAttachment(null)}>사진 취소</button>
              </div>
            )}
            <form
              className="composer"
              onSubmit={(e) => {
                e.preventDefault();
                void send();
              }}
            >
              <button
                type="button"
                className="icon-button attach-button"
                aria-label="사진 첨부"
                disabled={busy}
                onClick={() => file.current?.click()}
              >
                {busy ? <Spinner /> : <Plus />}
              </button>
              <input
                type="file"
                ref={file}
                hidden
                accept="image/*"
                onChange={(e) => void attach(e.target.files?.[0])}
              />
              <input
                aria-label="메시지"
                placeholder="메시지 보내기"
                maxLength={2000}
                value={text}
                onChange={(e) => setText(e.target.value)}
              />
              <button
                type="submit"
                className="send-button"
                aria-label="메시지 전송"
                disabled={busy || (!text.trim() && !attachment)}
              >
                <ArrowUp size={23} />
              </button>
            </form>
          </>
        )}
      </div>
    </section>
  );
}
