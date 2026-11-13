"use client";
import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  type ReactNode,
} from "react";
import { browserClient } from "@/lib/supabase/browser";
import posthog from "posthog-js";
import { analyticsIdentityChanged } from "@/lib/device-analytics";
import type { RealtimePostgresInsertPayload } from "@supabase/supabase-js";
import {
  unreadCount,
  type Snapshot,
  type Message,
  type Post,
  type Conversation,
  type Profile,
} from "@/lib/domain";
type Model = {
  state: Snapshot | null;
  base: string;
  error: string;
  refresh: () => Promise<void>;
  mutate: <T>(op: string, payload: Record<string, unknown>) => Promise<T>;
  upload: (file: File, room?: string) => Promise<string>;
  image: (id: string, width?: number) => string;
  addPosts: (posts: Post[], profiles?: Profile[]) => void;
  loadMessages: (id: string, before?: number) => Promise<boolean>;
  getFeed: (query: string) => FeedPage | undefined;
  cacheFeed: (
    query: string,
    posts: Post[],
    hasMore: boolean,
    profiles?: Profile[],
  ) => void;
  loadPosts: (query: string) => Promise<FeedPage>;
};
type FeedPage = {
  posts: Post[];
  profiles?: Profile[];
  hasMore: boolean;
  fetchedAt: number;
};
const Context = createContext<Model | null>(null);
export const useApp = () => {
  const ctx = useContext(Context);
  if (!ctx) throw new Error("앱을 불러오지 못했어요.");
  return ctx;
};
async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    signal: init?.signal ?? AbortSignal.timeout(15000),
    cache: "no-store",
  });
  const value = await res.json();
  if (!res.ok) throw new Error(value.error ?? "요청을 처리하지 못했어요.");
  return value;
}
export function AppProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<Snapshot | null>(null),
    [error, setError] = useState("");
  const current = useRef<Snapshot | null>(null);
  const identifiedUser = useRef<string | null>(null);
  const refreshing = useRef<Promise<void> | null>(null);
  // Memory belongs to this mounted, authenticated provider, never another user.
  const feeds = useRef(new Map<string, FeedPage>());
  const postRequests = useRef(new Map<string, Promise<FeedPage>>());
  const feedVersion = useRef(0);
  const mutationVersion = useRef(0);
  const messagePages = useRef(
    new Map<string, { hasMore: boolean; fetchedAt: number }>(),
  );
  const messageRequests = useRef(new Map<string, Promise<boolean>>());
  const getFeed = useCallback((query: string) => feeds.current.get(query), []);
  const cacheFeed = useCallback(
    (
      query: string,
      posts: Post[],
      hasMore: boolean,
      profiles: Profile[] = [],
    ) => {
      feeds.current.delete(query);
      feeds.current.set(query, {
        posts,
        profiles,
        hasMore,
        fetchedAt: Date.now(),
      });
      if (feeds.current.size > 20)
        feeds.current.delete(feeds.current.keys().next().value!);
    },
    [],
  );
  const apply = useCallback((value: Snapshot) => {
    current.current = value;
    setState(value);
  }, []);
  const loadPosts = useCallback(
    function requestPosts(query: string): Promise<FeedPage> {
      const cached = feeds.current.get(query);
      if (cached && Date.now() - cached.fetchedAt < 15000)
        return Promise.resolve(cached);
      const pending = postRequests.current.get(query);
      if (pending) return pending;
      const version = feedVersion.current;
      const request = api<FeedPage>(`/api/posts?${query}`)
        .then((data) => {
          if (version !== feedVersion.current) return requestPosts(query);
          const page = { ...data, fetchedAt: Date.now() };
          cacheFeed(query, page.posts, page.hasMore, page.profiles);
          return page;
        })
        .finally(() => {
          if (postRequests.current.get(query) === request)
            postRequests.current.delete(query);
        });
      postRequests.current.set(query, request);
      return request;
    },
    [cacheFeed],
  );
  const refresh = useCallback(() => {
    if (refreshing.current) return refreshing.current;
    const version = mutationVersion.current;
    refreshing.current = (async () => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 20000);
      try {
        const activeRoom = window.location.pathname.match(
          /^\/app\/chats\/([0-9a-f-]{36})$/,
        )?.[1];
        const data = await api<Snapshot>(
          `/api/data${activeRoom ? `?conversation=${activeRoom}` : ""}`,
          {
            signal: controller.signal,
          },
        );
        // A response started before a successful mutation must not undo its
        // unread count, preview, or post status while reconciling in the back.
        if (version !== mutationVersion.current) return;
        const old = current.current;
        if (old && old.viewer.id !== data.viewer.id) {
          // Another tab signed in as a different account. Discard this document's
          // private message/feed caches before showing that account's data.
          window.location.reload();
          return;
        }
        const cached = [...feeds.current.values()];
        apply({
          ...data,
          profiles: [
            ...new Map(
              [
                ...(old?.profiles ?? []),
                ...cached.flatMap((page) => page.profiles ?? []),
                ...data.profiles,
              ].map((p) => [p.id, p]),
            ).values(),
          ],
          posts: [
            ...data.posts,
            ...[
              ...new Map(
                [
                  ...cached.flatMap((page) => page.posts),
                  ...(old?.posts ?? []),
                ].map((p) => [p.id, p]),
              ).values(),
            ].filter((p) => !data.posts.some((n) => n.id === p.id)),
          ],
          messages: mergeMessages(old?.messages ?? [], data.messages),
        });
        setError("");
      } catch (e) {
        setError(
          controller.signal.aborted
            ? "데이터 요청이 오래 걸리고 있어요. 연결을 확인한 뒤 다시 불러와 주세요."
            : e instanceof Error
              ? e.message
              : "데이터를 불러오지 못했어요.",
        );
      } finally {
        clearTimeout(timeout);
      }
    })().finally(() => {
      refreshing.current = null;
    });
    return refreshing.current;
  }, [apply]);
  useEffect(() => {
    void refresh();
  }, [refresh]);
  const viewerId = state?.viewer.id;
  const viewerDisplayName = state?.viewer.display_name;
  const viewerEmail = state?.viewer.email;
  useEffect(() => {
    if (!viewerId) return;
    const identity = JSON.stringify([viewerId, viewerDisplayName, viewerEmail]);
    if (identifiedUser.current === identity) return;

    const previousUserId = posthog.get_property("$user_id");
    if (previousUserId && previousUserId !== viewerId) posthog.reset();

    posthog.identify(viewerId, {
      name: viewerDisplayName,
      display_name: viewerDisplayName,
      ...(viewerEmail ? { email: viewerEmail } : {}),
    });
    identifiedUser.current = identity;
    window.dispatchEvent(new Event(analyticsIdentityChanged));
  }, [viewerId, viewerDisplayName, viewerEmail]);
  useEffect(() => {
    const client = browserClient();
    if (!client) return;
    let timer: ReturnType<typeof setTimeout>;
    const sync = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        if (refreshing.current) void refreshing.current.then(refresh);
        else void refresh();
      }, 180);
    };
    const channel = client
      .channel("inbox")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        (payload: RealtimePostgresInsertPayload<Message>) => {
          const message = payload.new as Message;
          const old = current.current;
          if (
            old &&
            message.id &&
            !old.messages.some((m) => m.id === message.id)
          ) {
            mutationVersion.current++;
            apply({
              ...old,
              messages: mergeMessages(old.messages, [message]),
              conversations: old.conversations.map((c) =>
                c.id === message.conversation_id
                  ? {
                      ...c,
                      last_body:
                        message.body ||
                        (message.image_id ? "사진을 보냈어요" : ""),
                      last_message_at: message.created_at,
                      unread_count:
                        message.sender_id === old.viewer.id
                          ? c.unread_count
                          : unreadCount(c, old.messages, old.viewer.id) + 1,
                    }
                  : c,
              ),
            });
          }
          sync();
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "conversations" },
        sync,
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "conversations" },
        sync,
      )
      .subscribe((status: string) => {
        if (status === "SUBSCRIBED") sync();
      });
    const focus = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    window.addEventListener("focus", focus);
    document.addEventListener("visibilitychange", focus);
    const interval = setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, 30000);
    return () => {
      clearTimeout(timer);
      clearInterval(interval);
      window.removeEventListener("focus", focus);
      document.removeEventListener("visibilitychange", focus);
      void client.removeChannel(channel);
    };
  }, [refresh, apply]);
  const mutate = useCallback(
    async <T,>(op: string, payload: Record<string, unknown>): Promise<T> => {
      if (!current.current) throw new Error("잠시 기다려 주세요.");
      const result = await api<T>("/api/mutate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ op, payload }),
      });
      mutationVersion.current++;
      if (op === "message.send")
        apply({
          ...current.current,
          messages: mergeMessages(current.current.messages, [
            result as Message,
          ]),
        });
      if (op === "post.save" || op === "post.status") {
        const p = result as Post;
        apply({
          ...current.current,
          posts: [p, ...current.current.posts.filter((old) => old.id !== p.id)],
        });
      }
      if (op === "conversation.create") {
        const c = result as Conversation;
        apply({
          ...current.current,
          conversations: [
            c,
            ...current.current.conversations.filter((old) => old.id !== c.id),
          ],
        });
      }
      if (op === "post.delete") {
        const id = payload.id;
        apply({
          ...current.current,
          posts: current.current.posts.filter((p) => p.id !== id),
        });
      }
      if (op === "message.read") {
        const seq = Number(payload.seq);
        apply({
          ...current.current,
          conversations: current.current.conversations.map((c) => {
            if (c.id !== payload.conversation_id) return c;
            const field =
              c.seller_id === current.current!.viewer.id
                ? "seller_read_seq"
                : "buyer_read_seq";
            const read = Math.max(c[field], seq);
            return {
              ...c,
              [field]: read,
              unread_count: current.current!.messages.filter(
                (m) =>
                  m.conversation_id === c.id &&
                  m.sender_id !== current.current!.viewer.id &&
                  m.seq > read,
              ).length,
            };
          }),
        });
        return result;
      }
      if (op === "message.send") {
        const m = result as Message;
        apply({
          ...current.current,
          conversations: current.current.conversations.map((c) =>
            c.id === m.conversation_id
              ? {
                  ...c,
                  last_body: m.body || (m.image_id ? "사진을 보냈어요" : ""),
                  last_message_at: m.created_at,
                }
              : c,
          ),
        });
        return result;
      }
      if (op.startsWith("post.")) {
        feeds.current.clear();
        postRequests.current.clear();
        feedVersion.current++;
      }
      // The mutation result is already applied. Do not hold navigation or the
      // composer hostage to an additional full snapshot request.
      if (refreshing.current) void refreshing.current.then(refresh);
      else void refresh();
      return result;
    },
    [refresh, apply],
  );
  const upload = useCallback(async (file: File, room?: string) => {
    if (file.size > 10 * 1024 * 1024)
      throw new Error("사진은 10MB 이하로 올려 주세요.");
    const bitmap = await createImageBitmap(file).catch(() => {
      throw new Error(
        "이 사진을 읽을 수 없어요. JPG 또는 PNG를 선택해 주세요.",
      );
    });
    const canvas = document.createElement("canvas"),
      ratio = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
    canvas.width = Math.round(bitmap.width * ratio);
    canvas.height = Math.round(bitmap.height * ratio);
    canvas
      .getContext("2d")!
      .drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/webp", 0.8),
    );
    if (!blob || blob.size > 3 * 1024 * 1024)
      throw new Error("사진 용량을 줄여 다시 올려 주세요.");
    const form = new FormData();
    form.set("file", blob, "photo.webp");
    if (room) form.set("conversation_id", room);
    return (
      await api<{ id: string }>("/api/upload", {
        method: "POST",
        body: form,
      })
    ).id;
  }, []);
  const addPosts = useCallback(
    (posts: Post[], profiles: Profile[] = []) => {
      if (current.current)
        apply({
          ...current.current,
          profiles: [
            ...new Map(
              [...current.current.profiles, ...profiles].map((p) => [p.id, p]),
            ).values(),
          ],
          posts: [
            ...current.current.posts.filter(
              (p) => !posts.some((n) => n.id === p.id),
            ),
            ...posts,
          ],
        });
    },
    [apply],
  );
  const loadMessages = useCallback(
    (id: string, before?: number) => {
      const key = `${id}:${before ?? "latest"}`;
      const cached = messagePages.current.get(key);
      if (cached && (before || Date.now() - cached.fetchedAt < 5000))
        return Promise.resolve(cached.hasMore);
      const pending = messageRequests.current.get(key);
      if (pending) return pending;
      const request = api<{ messages: Message[]; hasMore: boolean }>(
        `/api/messages?conversation=${id}${before ? `&before=${before}` : ""}`,
      )
        .then((result) => {
          if (current.current)
            apply({
              ...current.current,
              messages: mergeMessages(
                current.current.messages,
                result.messages,
              ),
            });
          messagePages.current.set(key, {
            hasMore: result.hasMore,
            fetchedAt: Date.now(),
          });
          if (messagePages.current.size > 100)
            messagePages.current.delete(
              messagePages.current.keys().next().value!,
            );
          return result.hasMore;
        })
        .finally(() => messageRequests.current.delete(key));
      messageRequests.current.set(key, request);
      return request;
    },
    [apply],
  );
  useEffect(() => {
    if (!viewerId) return;
    const timer = setTimeout(() => {
      const recent = [...(current.current?.conversations ?? [])].sort((a, b) =>
        (b.last_message_at ?? "").localeCompare(a.last_message_at ?? ""),
      )[0];
      void Promise.allSettled([
        loadPosts("type=lost&q=&available=true"),
        loadPosts("mine=true&completed=false"),
        ...(recent ? [loadMessages(recent.id)] : []),
      ]);
    }, 1200);
    return () => clearTimeout(timer);
  }, [viewerId, loadPosts, loadMessages]);
  return (
    <Context.Provider
      value={{
        state,
        base: "/app",
        error,
        refresh,
        mutate,
        upload,
        image: (id, width) => `/api/media/${id}${width ? `?w=${width}` : ""}`,
        addPosts,
        loadMessages,
        getFeed,
        cacheFeed,
        loadPosts,
      }}
    >
      {children}
    </Context.Provider>
  );
}
function mergeMessages(old: Message[], recent: Message[]) {
  return [...new Map([...old, ...recent].map((m) => [m.id, m])).values()].sort(
    (a, b) => a.seq - b.seq,
  );
}
