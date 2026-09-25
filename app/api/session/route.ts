import { member } from "@/lib/auth";
import { serverClient } from "@/lib/supabase/server";
import { failure, json, sameOrigin } from "@/lib/http";
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const { action } = await request.json();
    if (action === "delete") {
      const { client } = await member();
      const { error } = await client.rpc("mutate", {
        op: "account.delete",
        payload: {},
      });
      if (error) throw new Error(error.message);
    } else if (action !== "logout") throw new Error("잘못된 요청입니다.");
    const client = await serverClient();
    await client.auth.signOut();
    return json({ ok: true });
  } catch (e) {
    return failure(e);
  }
}
