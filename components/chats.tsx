"use client";
import Link from "./app-link";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowUp, Plus, ChevronRight } from "lucide-react";
import {
  type Message,
  otherMember,
  unreadCount,
  priceLabel,
  relativeTime,
} from "@/lib/domain";
import { useApp } from "./provider";
import { closeReadChatNotifications } from "@/lib/chat-notifications";
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
  const layout = useRef<HTMLElement>(null),
    messageStack = useRef<HTMLDivElement>(null),
    file = useRef<HTMLInputElement>(null),
    messageInput = useRef<HTMLInputElement>(null),
    lastRead = useRef(0),
    confirmedRead = useRef(0),
    pinnedToBottom = useRef(true),
    touchSend = useRef<number | null>(null),
    suppressSendClick = useRef(false),
    scroller = useRef<HTMLDivElement>(null);
  const room = state?.conversations.find((c) => c.id === id),
    messages = state?.messages.filter((m) => m.conversation_id === id) ?? [],
    lastSeq = messages.at(-1)?.seq ?? 0;
  const activeRoom = Boolean(id && room);
  useLayoutEffect(() => {
    pinnedToBottom.current = true;
  }, [id]);

  useLayoutEffect(() => {
    const element = layout.current;
    if (!activeRoom || !element) return;
    const mobile = matchMedia("(max-width: 768px)");
    const viewport = window.visualViewport;
    let frame = 0;
    const measure = () => {
      if (!mobile.matches) {
        element.style.removeProperty("--chat-height");
        element.style.removeProperty("--chat-top");
        element.removeAttribute("data-keyboard");
        document.documentElement.classList.remove("chat-room-open");
        return;
      }
      const height = viewport?.height ?? window.innerHeight;
      element.style.setProperty("--chat-height", `${height}px`);
      element.style.setProperty("--chat-top", `${viewport?.offsetTop ?? 0}px`);
      element.dataset.keyboard = String(window.innerHeight - height > 120);
      document.documentElement.classList.add("chat-room-open");
      // Resizing the visible area must move the composer, without scrolling
      // the document or waiting for the next input/change event.
      const list = scroller.current;
      if (
        list &&
        (pinnedToBottom.current ||
          document.activeElement === messageInput.current)
      )
        list.scrollTop = list.scrollHeight;
    };
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measure);
    };
    measure();
    viewport?.addEventListener("resize", schedule);
    viewport?.addEventListener("scroll", schedule);
    window.addEventListener("resize", schedule);
    mobile.addEventListener("change", schedule);
    element.addEventListener("focusin", schedule);
    return () => {
      cancelAnimationFrame(frame);
      viewport?.removeEventListener("resize", schedule);
      viewport?.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      mobile.removeEventListener("change", schedule);
      element.removeEventListener("focusin", schedule);
      document.documentElement.classList.remove("chat-room-open");
      element.style.removeProperty("--chat-height");
      element.style.removeProperty("--chat-top");
      element.removeAttribute("data-keyboard");
    };
  }, [activeRoom, id]);

  useLayoutEffect(() => {
    const list = scroller.current;
    const content = messageStack.current;
    if (!activeRoom || !list || !content) return;
    const followLatest = () => {
      if (pinnedToBottom.current) list.scrollTop = list.scrollHeight;
    };
    // Also cover attachments/images loading and changes in composer height.
    const observer = new ResizeObserver(followLatest);
    observer.observe(list);
    observer.observe(content);
    followLatest();
    return () => observer.disconnect();
  }, [activeRoom, id]);
  useEffect(() => {
    lastRead.current = 0;
    confirmedRead.current = 0;
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
      if (document.visibilityState !== "visible") return;
      if (lastRead.current >= lastSeq) {
        if (confirmedRead.current >= lastSeq)
          void closeReadChatNotifications(id, lastSeq);
        return;
      }
      lastRead.current = lastSeq;
      void mutate("message.read", { conversation_id: id, seq: lastSeq })
        .then(() => {
          confirmedRead.current = Math.max(confirmedRead.current, lastSeq);
          void closeReadChatNotifications(id, lastSeq);
        })
        .catch(() => {
          lastRead.current = 0;
        });
    };
    mark();
    document.addEventListener("visibilitychange", mark);
    return () => document.removeEventListener("visibilitychange", mark);
  }, [id, lastSeq, mutate]);
  useLayoutEffect(() => {
    const list = scroller.current;
    if (list && pinnedToBottom.current) list.scrollTop = list.scrollHeight;
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
      pinnedToBottom.current = true;
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
    const oldTop = scroller.current?.scrollTop ?? 0;
    pinnedToBottom.current = false;
    try {
      setMore(await loadMessages(id, messages[0]?.seq));
      requestAnimationFrame(() => {
        if (scroller.current)
          scroller.current.scrollTop =
            oldTop + scroller.current.scrollHeight - oldHeight;
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
    <section ref={layout} className={`chat-layout ${id ? "has-room" : ""}`}>
      <aside className="chat-sidebar">
        <PageHeading title="채팅" />
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
                  <Avatar name={user?.display_name} />
                  <div className="room-copy">
                    <div>
                      {user?.display_name && (
                        <strong>{user.display_name}</strong>
                      )}
                      <small>{relativeTime(c.last_message_at)}</small>
                    </div>
                    <p>
                      {c.last_body ||
                        last?.body ||
                        (last?.image_id
                          ? "사진을 보냈어요"
                          : "대화를 시작해보세요.")}
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
          <Empty title="대화를 선택해 주세요" />
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
              <Avatar name={opposite?.display_name} />
              <div>
                {opposite?.display_name && (
                  <strong>{opposite.display_name}</strong>
                )}
              </div>
            </header>
            <Link
              href={`${base}/posts/${room.post_id}`}
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
            <div
              className="messages"
              ref={scroller}
              aria-label="대화 내용"
              onScroll={(event) => {
                const list = event.currentTarget;
                pinnedToBottom.current =
                  list.scrollHeight - list.scrollTop - list.clientHeight < 80;
              }}
            >
              <div className="message-stack" ref={messageStack}>
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
                            {
                              hour: "2-digit",
                              minute: "2-digit",
                              hour12: false,
                            },
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
              </div>
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
                // Focus synchronously within the user's action; iOS may not
                // reopen the keyboard after waiting for the send request.
                messageInput.current?.focus({ preventScroll: true });
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
                ref={messageInput}
                aria-label="메시지"
                placeholder="메시지 보내기"
                maxLength={2000}
                value={text}
                onFocus={() => {
                  pinnedToBottom.current = true;
                  const list = scroller.current;
                  if (list) list.scrollTop = list.scrollHeight;
                }}
                onChange={(e) => setText(e.target.value)}
              />
              <button
                type="submit"
                className="send-button"
                aria-label="메시지 전송"
                onPointerDown={(event) => {
                  suppressSendClick.current = false;
                  // Keep an open keyboard from closing when the send button
                  // would otherwise take focus from the message input.
                  if (
                    event.button === 0 &&
                    document.activeElement === messageInput.current
                  ) {
                    event.preventDefault();
                    if (event.pointerType !== "mouse")
                      touchSend.current = event.pointerId;
                  }
                }}
                onPointerUp={(event) => {
                  if (touchSend.current !== event.pointerId) return;
                  touchSend.current = null;
                  event.preventDefault();
                  suppressSendClick.current = true;
                  const bounds = event.currentTarget.getBoundingClientRect();
                  // WebKit can suppress click after cancelling pointerdown.
                  // Submit the touch explicitly, once, without blurring input.
                  if (
                    event.clientX >= bounds.left &&
                    event.clientX <= bounds.right &&
                    event.clientY >= bounds.top &&
                    event.clientY <= bounds.bottom
                  )
                    event.currentTarget.form?.requestSubmit();
                }}
                onPointerCancel={() => {
                  touchSend.current = null;
                }}
                onClick={(event) => {
                  if (suppressSendClick.current && event.detail > 0)
                    event.preventDefault();
                  suppressSendClick.current = false;
                }}
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
