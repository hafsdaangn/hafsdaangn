import { z } from "zod";
import { member } from "@/lib/auth";
import { storageAdmin } from "@/lib/supabase/server";
import { failure, json, sameOrigin } from "@/lib/http";

export async function GET() {
  try {
    const { user } = await member();
    const { data, error } = await storageAdmin()
      .from("chat_notification_settings")
      .select("enabled")
      .eq("user_id", user.id)
      .maybeSingle();
    if (error) throw new Error("채팅 알림 설정을 불러오지 못했어요.");
    return json({ enabled: data?.enabled ?? true });
  } catch (error) {
    return failure(error);
  }
}

export async function PUT(request: Request) {
  try {
    sameOrigin(request);
    const { user } = await member();
    const setting = z
      .object({ enabled: z.boolean() })
      .parse(await request.json());
    const { error } = await storageAdmin()
      .from("chat_notification_settings")
      .upsert({ user_id: user.id, ...setting });
    if (error) throw new Error("채팅 알림 설정을 저장하지 못했어요.");
    return json(setting);
  } catch (error) {
    return failure(error);
  }
}
