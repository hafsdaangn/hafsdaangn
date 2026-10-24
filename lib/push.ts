import "server-only";
import webpush from "web-push";
import { cookies } from "next/headers";
import { storageAdmin } from "@/lib/supabase/server";
import { pushEndpoint } from "@/lib/push-schema";
import type { Message } from "@/lib/domain";
import { chatPushContent } from "@/lib/push-content";

export const pushCookie = "push-device";
function trace(event: string, details: Record<string, unknown> = {}) {
  if (process.env.NODE_ENV !== "production")
    console.info("Chat push", event, details);
}
export const pushConfigured = () =>
  Boolean(
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY &&
    process.env.VAPID_PRIVATE_KEY &&
    process.env.VAPID_SUBJECT,
  );

export async function forgetPushDevice() {
  const jar = await cookies();
  const device = jar.get(pushCookie)?.value;
  if (device) {
    const { error } = await storageAdmin()
      .from("push_subscriptions")
      .delete()
      .eq("device_id", device);
    if (error)
      throw new Error("알림 연결을 해제하지 못했어요. 다시 시도해 주세요.");
  }
  jar.delete(pushCookie);
}

export async function notifyChat(message: Message) {
  if (!pushConfigured()) {
    trace("skipped: not configured");
    return;
  }
  const admin = storageAdmin();
  const { data: room, error: roomError } = await admin
    .from("conversations")
    .select("seller_id,buyer_id,seller_read_seq,buyer_read_seq,title")
    .eq("id", message.conversation_id)
    .single();
  if (roomError) throw new Error("Push conversation lookup failed");
  const recipient =
    room.seller_id === message.sender_id ? room.buyer_id : room.seller_id;
  const readSeq =
    room.seller_id === recipient ? room.seller_read_seq : room.buyer_read_seq;
  if (readSeq >= message.seq) {
    trace("skipped: already read", { seq: message.seq });
    return;
  }
  const { data: sender, error: senderError } = await admin
    .from("profiles")
    .select("display_name")
    .eq("id", message.sender_id)
    .maybeSingle();
  if (senderError) throw new Error("Push sender lookup failed");
  const content = chatPushContent(message, sender?.display_name, room.title);
  const { data: subscriptions, error } = await admin
    .from("push_subscriptions")
    .select("endpoint,keys,device_id")
    .eq("user_id", recipient);
  if (error) throw new Error("Push subscriptions lookup failed");
  trace("subscriptions found", {
    count: subscriptions?.length ?? 0,
    seq: message.seq,
  });
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT!,
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!,
  );
  await Promise.all(
    (subscriptions ?? []).map(async (subscription) => {
      if (!pushEndpoint(subscription.endpoint)) {
        trace("skipped: unsupported provider");
        return;
      }
      const provider = new URL(subscription.endpoint).hostname;
      // Atomic claim prevents duplicate alerts when a message request is retried.
      const { error: claimError } = await admin
        .from("push_deliveries")
        .insert({ message_id: message.id, device_id: subscription.device_id });
      if (claimError?.code === "23505") {
        trace("skipped: duplicate", { seq: message.seq });
        return;
      }
      if (claimError) throw new Error("Push delivery claim failed");
      try {
        const response = await webpush.sendNotification(
          subscription,
          JSON.stringify(content),
          {
            TTL: 3600,
            urgency: "high",
            timeout: 8000,
          },
        );
        trace("accepted by push service", {
          provider,
          seq: message.seq,
          status: response.statusCode,
        });
      } catch (error) {
        const status = (error as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          trace("subscription expired", { provider, status });
          await admin
            .from("push_subscriptions")
            .delete()
            .eq("device_id", subscription.device_id)
            .eq("endpoint", subscription.endpoint);
        } else {
          await admin
            .from("push_deliveries")
            .delete()
            .eq("message_id", message.id)
            .eq("device_id", subscription.device_id);
          // Do not log endpoint URLs or message contents.
          console.error("Chat push delivery failed", {
            provider,
            status: status ?? "network",
          });
        }
      }
    }),
  );
}
