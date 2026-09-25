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
    const error = results.find((r) => r.error)?.error;
    if (error)
      throw new Error("데이터를 불러오지 못했어요. 연결 설정을 확인해 주세요.");
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
