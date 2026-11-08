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
    const response = json({ ok: true });
    response.headers.set("Clear-Site-Data", '"cache"');
    return response;
  } catch (e) {
    return failure(e);
  }
}
