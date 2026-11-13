import { member } from "@/lib/auth";
import { failure, json } from "@/lib/http";
import type { Conversation } from "@/lib/domain";
import { z } from "zod";
export async function GET(request: Request) {
  try {
    const started = performance.now();
    const { client, user } = await member();
    const authenticated = performance.now();
    const room = new URL(request.url).searchParams.get("conversation");
    if (room) z.uuid().parse(room);
    const [inbox, messages] = await Promise.all([
      client.rpc("inbox"),
      room
        ? client
            .from("messages")
            .select("*")
            .eq("conversation_id", room)
            .order("seq", { ascending: false })
            .limit(50)
        : Promise.resolve({ data: [], error: null }),
    ]);
    if (inbox.error || messages.error)
      throw new Error("대화 목록을 불러오지 못했어요.");
    const conversations = (inbox.data ?? []) as Conversation[];
    // Older inbox RPC deployments may not yet include previews/counts. Keep
    // their previous history fallback rather than silently losing unread data.
    const legacy = conversations.some(
      (c) => c.unread_count === undefined || !("last_body" in c),
    );
    const people = [
      ...new Set([
        user.id,
        ...conversations.flatMap((c) => [c.buyer_id, c.seller_id]),
      ]),
    ];
    const postIds = [...new Set(conversations.map((c) => c.post_id))];
    // The inbox already supplies previews and unread counts. Fetch history only
    // for the opened room, and names only for the people in this user's inbox.
    const [profiles, posts, legacyMessages] = await Promise.all([
      client.from("profiles").select("id,display_name").in("id", people),
      postIds.length
        ? client.from("posts").select("*").in("id", postIds)
        : Promise.resolve({ data: [], error: null }),
      legacy
        ? client
            .from("messages")
            .select("*")
            .order("seq", { ascending: false })
            .limit(500)
        : Promise.resolve({ data: [], error: null }),
    ]);
    if (profiles.error || posts.error || legacyMessages.error)
      throw new Error(
        "데이터를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.",
      );
    const response = json({
      viewer: {
        ...(profiles.data?.find((p) => p.id === user.id) ?? {
          id: user.id,
          display_name: "",
        }),
        email: user.email,
      },
      profiles: profiles.data ?? [],
      posts: posts.data ?? [],
      conversations,
      messages: [
        ...(legacyMessages.data?.reverse() ?? []),
        ...(messages.data?.reverse() ?? []),
      ],
      hasMore: false,
    });
    response.headers.set(
      "Server-Timing",
      `auth;dur=${(authenticated - started).toFixed(1)}, db;dur=${(performance.now() - authenticated).toFixed(1)}`,
    );
    return response;
  } catch (e) {
    return failure(e, 401);
  }
}
