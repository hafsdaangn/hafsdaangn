import { z } from "zod";
import type { Post } from "./domain";

export const notificationSections = ["giveaway", "lost"] as const;
export type NotificationSection = (typeof notificationSections)[number];
export const postNotificationSchema = z.object({
  section: z.enum(notificationSections),
  mode: z.enum(["off", "all", "keywords"]),
  keywords: z
    .array(
      z
        .string()
        .trim()
        .min(1, "키워드를 입력해 주세요.")
        .max(30, "키워드는 30자까지 입력할 수 있어요.")
        .transform((word) => word.normalize("NFC")),
    )
    .max(20, "키워드는 20개까지 등록할 수 있어요.")
    .transform((words) => [
      ...new Map(words.map((word) => [word.toLowerCase(), word])).values(),
    ]),
});
export type PostNotificationSetting = z.infer<typeof postNotificationSchema>;
export const defaultPostNotifications = (): PostNotificationSetting[] =>
  notificationSections.map((section) => ({
    section,
    mode: "all",
    keywords: [],
  }));

export function postNotificationSection(
  kind: Post["kind"],
): NotificationSection | null {
  return kind === "giveaway"
    ? "giveaway"
    : kind === "lost" || kind === "found"
      ? "lost"
      : null;
}
export function matchesPostNotification(
  post: Pick<Post, "kind" | "title" | "body">,
  setting: PostNotificationSetting,
) {
  if (postNotificationSection(post.kind) !== setting.section) return false;
  if (setting.mode === "off") return false;
  if (setting.mode === "all") return true;
  const fields = [post.title, post.body].map((value) =>
    value.normalize("NFC").toLowerCase(),
  );
  return setting.keywords.some(
    (word) =>
      word.trim() &&
      fields.some((value) =>
        value.includes(word.trim().normalize("NFC").toLowerCase()),
      ),
  );
}
