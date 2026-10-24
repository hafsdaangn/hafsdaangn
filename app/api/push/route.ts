import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { member } from "@/lib/auth";
import { storageAdmin } from "@/lib/supabase/server";
import { failure, json, sameOrigin } from "@/lib/http";
import { forgetPushDevice, pushConfigured, pushCookie } from "@/lib/push";
import { subscriptionSchema } from "@/lib/push-schema";

export async function GET() {
  try {
    const { user } = await member();
    const device = (await cookies()).get(pushCookie)?.value;
    let subscribed = false;
    if (device && pushConfigured()) {
      const { data, error } = await storageAdmin()
        .from("push_subscriptions")
        .select("device_id")
        .eq("device_id", device)
        .eq("user_id", user.id)
        .maybeSingle();
      if (error) throw new Error("알림 상태를 확인하지 못했어요.");
      subscribed = Boolean(data);
    }
    return json({
      configured: pushConfigured(),
      subscribed,
      publicKey: pushConfigured()
        ? process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
        : null,
    });
  } catch (error) {
    return failure(error);
  }
}

export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const { user } = await member();
    if (!pushConfigured()) throw new Error("채팅 알림을 준비하고 있어요.");
    const subscription = subscriptionSchema.parse(await request.json());
    const jar = await cookies();
    // The random, HttpOnly device cookie lets logout detach this device safely.
    const device = jar.get(pushCookie)?.value || randomUUID();
    const admin = storageAdmin();
    const { error: cleanupError } = await admin
      .from("push_subscriptions")
      .delete()
      .eq("device_id", device)
      .neq("endpoint", subscription.endpoint);
    if (cleanupError) throw new Error("알림 연결을 갱신하지 못했어요.");
    const { error } = await admin
      .from("push_subscriptions")
      .upsert(
        {
          ...subscription,
          device_id: device,
          user_id: user.id,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "endpoint" },
      );
    if (error)
      throw new Error("알림을 설정하지 못했어요. 잠시 후 다시 시도해 주세요.");
    jar.set(pushCookie, device, {
      httpOnly: true,
      secure: new URL(request.url).protocol === "https:",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    });
    return json({ ok: true });
  } catch (error) {
    return failure(error);
  }
}

export async function DELETE(request: Request) {
  try {
    sameOrigin(request);
    await member();
    await forgetPushDevice();
    return json({ ok: true });
  } catch (error) {
    return failure(error);
  }
}
