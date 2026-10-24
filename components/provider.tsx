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
import {
  type Snapshot,
  type Message,
  type Post,
  type Conversation,
} from "@/lib/domain";
type Model = {
  state: Snapshot | null;
  base: string;
  error: string;
  refresh: () => Promise<void>;
  mutate: <T>(op: string, payload: Record<string, unknown>) => Promise<T>;
  upload: (file: File, room?: string) => Promise<string>;
  image: (id: string) => string;
  addPosts: (posts: Post[]) => void;
  loadMessages: (id: string, before?: number) => Promise<boolean>;
};
const Context = createContext<Model | null>(null);
export const useApp = () => {
  const ctx = useContext(Context);
  if (!ctx) throw new Error("앱을 불러오지 못했어요.");
  return ctx;
};
async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...init, cache: "no-store" });
  const value = await res.json();
  if (!res.ok) throw new Error(value.error ?? "요청을 처리하지 못했어요.");
  return value;
}
export function AppProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<Snapshot | null>(null),
    [error, setError] = useState("");
  const current = useRef<Snapshot | null>(null);
  const apply = useCallback((value: Snapshot) => {
    current.current = value;
    setState(value);
  }, []);
  const refresh = useCallback(async () => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);
    try {
      const data = await api<Snapshot>("/api/data", {
        signal: controller.signal,
      });
      const old = current.current;
      apply({
        ...data,
        posts: [
          ...data.posts,
          ...(old?.posts ?? []).filter(
            (p) => !data.posts.some((n) => n.id === p.id),
          ),
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
  }, [apply]);
  useEffect(() => {
    void refresh();
  }, [refresh]);
  useEffect(() => {
    const client = browserClient();
    if (!client) return;
    let timer: ReturnType<typeof setTimeout>;
    const sync = () => {
      clearTimeout(timer);
      timer = setTimeout(() => void refresh(), 180);
    };
    const channel = client
      .channel("inbox")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        sync,
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
  }, [refresh]);
  const mutate = useCallback(
    async <T,>(op: string, payload: Record<string, unknown>): Promise<T> => {
      if (!current.current) throw new Error("잠시 기다려 주세요.");
      const result = await api<T>("/api/mutate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ op, payload }),
      });
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
      await refresh();
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
    (posts: Post[]) => {
      if (current.current)
        apply({
          ...current.current,
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
    async (id: string, before?: number) => {
      const result = await api<{ messages: Message[]; hasMore: boolean }>(
        `/api/messages?conversation=${id}${before ? `&before=${before}` : ""}`,
      );
      if (current.current)
        apply({
          ...current.current,
          messages: mergeMessages(current.current.messages, result.messages),
        });
      return result.hasMore;
    },
    [apply],
  );
  return (
    <Context.Provider
      value={{
        state,
        base: "/app",
        error,
        refresh,
        mutate,
        upload,
        image: (id) => `/api/media/${id}`,
        addPosts,
        loadMessages,
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
