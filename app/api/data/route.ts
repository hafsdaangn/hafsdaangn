import { member } from "@/lib/auth";
import { failure, json } from "@/lib/http";
export async function GET() {
  try {
    const { client, user } = await member();
    const results = await Promise.all([
      client.from("profiles").select("id,nickname").limit(5000),
      client
        .from("posts")
        .select("*")
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .limit(41),
      client.rpc("inbox"),
      client
        .from("messages")
        .select("*")
        .order("seq", { ascending: false })
        .limit(500),
    ]);
    const failedIndex = results.findIndex((r) => r.error);
    if (failedIndex !== -1) {
      console.error("Initial data query failed", {
        resource: ["profiles", "posts", "inbox", "messages"][failedIndex],
        code: results[failedIndex].error?.code,
      });
      return failure(
        new Error("데이터를 불러오지 못했어요. 잠시 후 다시 시도해 주세요."),
        503,
      );
    }
    const profiles = results[0].data ?? [];
    return json({
      viewer: profiles.find((p) => p.id === user.id) ?? {
        id: user.id,
        nickname: "",
      },
      profiles,
      posts: results[1].data?.slice(0, 40) ?? [],
      conversations: results[2].data ?? [],
      messages: results[3].data?.reverse() ?? [],
      hasMore: (results[1].data?.length ?? 0) > 40,
    });
  } catch (e) {
    return failure(e, 401);
  }
}
