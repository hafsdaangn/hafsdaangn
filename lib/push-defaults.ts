import type { SupabaseClient } from "@supabase/supabase-js";
import { defaultPostNotifications } from "./post-notifications";

// Only insert missing settings. Reconnects and retries must preserve member choices.
export async function initializePushDefaults(
  admin: SupabaseClient,
  userId: string,
) {
  const { error: chatError } = await admin
    .from("chat_notification_settings")
    .upsert(
      { user_id: userId, enabled: true },
      { onConflict: "user_id", ignoreDuplicates: true },
    );
  if (chatError) throw new Error("채팅 알림 기본 설정을 저장하지 못했어요.");
  const { error: postError } = await admin
    .from("post_notification_settings")
    .upsert(
      defaultPostNotifications().map((setting) => ({
        user_id: userId,
        ...setting,
      })),
      { onConflict: "user_id,section", ignoreDuplicates: true },
    );
  if (postError) throw new Error("게시글 알림 기본 설정을 저장하지 못했어요.");
}
