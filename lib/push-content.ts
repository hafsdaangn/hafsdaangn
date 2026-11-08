import type { Message, Post } from "./domain";

function preview(value: string, limit: number) {
  const characters = Array.from(value.replace(/\s+/g, " ").trim());
  return characters.length > limit
    ? `${characters.slice(0, limit).join("")}…`
    : characters.join("");
}

export function postPushContent(
  post: Post,
  displayName: string | null | undefined,
) {
  return {
    title: `새 ${post.kind === "giveaway" ? "나눔" : "분실물"} 글`,
    body: `${preview(post.title, 60)} · ${preview(displayName || "", 32) || "게시자"}`,
    url: `/app/posts/${post.id}`,
    tag: `post-${post.id}`,
  };
}

export function chatPushContent(
  message: Message,
  displayName: string | null | undefined,
  productTitle: string,
) {
  const text =
    preview(message.body, 160) ||
    (message.image_id ? "사진을 보냈어요." : "새 메시지를 보냈어요.");
  const product = preview(productTitle, 60);
  const sender = preview(displayName || "", 32);
  return {
    title: sender ? `${sender} · ${product}` : product,
    body: `${text}`,
    url: `/app/chats/${message.conversation_id}`,
    tag: `chat-${message.conversation_id}`,
  };
}
