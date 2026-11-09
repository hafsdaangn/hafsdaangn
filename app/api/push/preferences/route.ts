import { member } from "@/lib/auth";
import { storageAdmin } from "@/lib/supabase/server";
import { failure, json, sameOrigin } from "@/lib/http";
import {
  defaultPostNotifications,
  postNotificationSchema,
} from "@/lib/post-notifications";
import { captureServerEvent } from "@/lib/posthog-server";

export async function GET() {
  try {
    const { user } = await member();
    const { data, error } = await storageAdmin()
      .from("post_notification_settings")
      .select("section,mode,keywords")
      .eq("user_id", user.id);
    if (error) throw new Error("게시글 알림 설정을 불러오지 못했어요.");
    return json(
      defaultPostNotifications().map(
        (setting) =>
          data.find((row) => row.section === setting.section) ?? setting,
      ),
    );
  } catch (error) {
    return failure(error);
  }
}

export async function PUT(request: Request) {
  try {
    sameOrigin(request);
    const { user } = await member();
    const parsed = postNotificationSchema.safeParse(await request.json());
    if (!parsed.success) throw new Error(parsed.error.issues[0].message);
    const { error } = await storageAdmin()
      .from("post_notification_settings")
      .upsert(
        { user_id: user.id, ...parsed.data },
        { onConflict: "user_id,section" },
      );
    if (error) throw new Error("게시글 알림 설정을 저장하지 못했어요.");
    await captureServerEvent({
      request,
      distinctId: user.id,
      event: "post_notification_preferences_updated",
      properties: {
        notification_section: parsed.data.section,
        notification_mode: parsed.data.mode,
        keyword_count: parsed.data.keywords.length,
      },
    });
    return json(parsed.data);
  } catch (error) {
    return failure(error);
  }
}
