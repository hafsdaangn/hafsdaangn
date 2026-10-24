import { serverClient } from "@/lib/supabase/server";
import { failure, json, sameOrigin } from "@/lib/http";
import { forgetPushDevice } from "@/lib/push";
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const { action } = await request.json();
    if (action !== "logout") throw new Error("잘못된 요청입니다.");
    await forgetPushDevice();
    const client = await serverClient();
    await client.auth.signOut();
    return json({ ok: true });
  } catch (e) {
    return failure(e);
  }
}
