import { z } from "zod";

export const categories = [
  "교재·도서",
  "문구·학습용품",
  "전자기기",
  "의류·잡화",
  "생활용품",
  "기타",
] as const;
export const places = [
  "직접 정하기",
  "도서관 앞",
  "급식실 앞",
  "교실",
  "기숙사 앞",
  "기타·모름",
] as const;
export type Kind = "sale" | "giveaway" | "barter" | "lost" | "found";
export type Status = "active" | "reserved" | "completed";
export type Profile = { id: string; display_name: string };
export type Post = {
  id: string;
  author_id: string;
  kind: Kind;
  title: string;
  body: string;
  price: number;
  category: string;
  place: string;
  occurred_on: string | null;
  custody: string;
  wanted: string;
  status: Status;
  image_ids: string[];
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};
export type Conversation = {
  id: string;
  post_id: string;
  seller_id: string;
  buyer_id: string;
  title: string;
  price: number;
  kind: Kind;
  seller_read_seq: number;
  buyer_read_seq: number;
  last_message_at: string;
  created_at: string;
  unread_count?: number;
  last_body?: string;
};
export type Message = {
  id: string;
  seq: number;
  conversation_id: string;
  sender_id: string;
  body: string;
  image_id: string | null;
  client_id: string;
  created_at: string;
};
export type Snapshot = {
  viewer: Profile;
  profiles: Profile[];
  posts: Post[];
  conversations: Conversation[];
  messages: Message[];
  hasMore: boolean;
};
export const isMarket = (kind: Kind) =>
  kind === "sale" || kind === "giveaway" || kind === "barter";
export const priceLabel = (post: Pick<Post, "kind" | "price">) =>
  post.kind === "giveaway"
    ? "나눔"
    : post.kind === "barter"
      ? "물물교환"
      : post.kind === "sale"
        ? `${post.price.toLocaleString("ko-KR")}원`
        : post.kind === "lost"
          ? "잃어버렸어요"
          : "주웠어요";
export const statusLabel = (post: Pick<Post, "status" | "kind">) =>
  post.status === "completed"
    ? isMarket(post.kind)
      ? post.kind === "giveaway"
        ? "나눔 완료"
        : post.kind === "barter"
          ? "교환 완료"
          : "거래 완료"
      : "해결 완료"
    : post.status === "reserved"
      ? "예약 중"
      : isMarket(post.kind)
        ? post.kind === "giveaway"
          ? "나눔 중"
          : post.kind === "barter"
            ? "교환 가능"
            : "판매 중"
        : post.kind === "lost"
          ? "찾는 중"
          : "주인 찾는 중";
export function relativeTime(value: string) {
  const minutes = Math.max(
    0,
    Math.floor((Date.now() - new Date(value).getTime()) / 60_000),
  );
  return minutes < 1
    ? "방금 전"
    : minutes < 60
      ? `${minutes}분 전`
      : minutes < 1440
        ? `${Math.floor(minutes / 60)}시간 전`
        : `${Math.floor(minutes / 1440)}일 전`;
}
export function searchKeywords(input: string | null | undefined) {
  const words = (input ?? "")
    .slice(0, 60)
    .replace(/[\\%_,().*"]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
  return [...new Set(words.map((w) => w.toLowerCase()))].slice(0, 5);
}
export function isSchoolEmail(email: string | undefined) {
  return !!email && /^[^\s@]+@hafs\.hs\.kr$/i.test(email);
}
export const postSchema = z
  .object({
    id: z.uuid().optional(),
    kind: z.enum(["sale", "giveaway", "barter", "lost", "found"]),
    title: z.string().trim().min(2, "제목은 2자 이상 입력해 주세요.").max(60),
    body: z.string().trim().min(5, "설명을 5자 이상 입력해 주세요.").max(3000),
    price: z.number().int().min(0).max(100_000_000),
    category: z.enum(categories),
    place: z.enum(places),
    occurred_on: z.iso.date().nullable(),
    custody: z.string().trim().max(100),
    wanted: z.string().trim().max(60).default(""),
    image_ids: z.array(z.uuid()).max(5),
  })
  .superRefine((post, ctx) => {
    if (post.kind === "sale" && post.price < 1)
      ctx.addIssue({
        code: "custom",
        message: "판매 가격을 입력해 주세요.",
        path: ["price"],
      });
    if (post.kind !== "sale" && post.price !== 0)
      ctx.addIssue({
        code: "custom",
        message: "판매 이외의 글에는 가격을 입력할 수 없어요.",
        path: ["price"],
      });
    if (isMarket(post.kind) && !post.image_ids.length)
      ctx.addIssue({
        code: "custom",
        message: "사진을 한 장 이상 올려 주세요.",
        path: ["image_ids"],
      });
    if (!isMarket(post.kind) && !post.occurred_on)
      ctx.addIssue({
        code: "custom",
        message: "분실 또는 발견 날짜를 입력해 주세요.",
        path: ["occurred_on"],
      });
    if (
      post.occurred_on &&
      post.occurred_on >
        new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" })
    )
      ctx.addIssue({
        code: "custom",
        message: "미래 날짜는 선택할 수 없어요.",
        path: ["occurred_on"],
      });
    if (post.kind === "barter" && post.wanted.length < 2)
      ctx.addIssue({
        code: "custom",
        message: "받고 싶은 물건을 2자 이상 입력해 주세요.",
        path: ["wanted"],
      });
    if (post.kind !== "barter" && post.wanted)
      ctx.addIssue({
        code: "custom",
        message: "물물교환 이외의 글에는 받고 싶은 물건을 입력할 수 없어요.",
        path: ["wanted"],
      });
    if (post.kind === "found" && !post.custody)
      ctx.addIssue({
        code: "custom",
        message: "보관 방법을 입력해 주세요.",
        path: ["custody"],
      });
  });
export type PostInput = z.infer<typeof postSchema>;
export const messageSchema = z
  .object({
    conversation_id: z.uuid(),
    client_id: z.uuid(),
    body: z.string().trim().max(2000),
    image_id: z.uuid().nullable(),
  })
  .refine(
    (v) => v.body.length > 0 || v.image_id,
    "메시지 또는 사진을 입력해 주세요.",
  );
export function otherMember(c: Conversation, user: string) {
  return c.seller_id === user ? c.buyer_id : c.seller_id;
}
export function unreadCount(
  c: Conversation,
  messages: Message[],
  user: string,
) {
  if (c.unread_count !== undefined) return c.unread_count;
  const read = c.seller_id === user ? c.seller_read_seq : c.buyer_read_seq;
  return messages.filter(
    (m) => m.conversation_id === c.id && m.sender_id !== user && m.seq > read,
  ).length;
}
