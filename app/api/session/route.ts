import { storageAdmin } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { cookieOptions, sessionCookie, tokenHash } from "@/lib/google-oauth";
import { member } from "@/lib/auth";
import { failure, json, sameOrigin } from "@/lib/http";
import { forgetPushDevice } from "@/lib/push";
export async function GET() {
  try {
    const { accessToken } = await member();
    return json({ accessToken, expiresIn: 300 });
  } catch (error) {
    return failure(error, 401);
  }
}
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const { action } = await request.json();
    if (action !== "logout") throw new Error("잘못된 요청입니다.");
    await forgetPushDevice();
    const jar = await cookies();
    const token = jar.get(sessionCookie())?.value;
    if (token) {
      const { error } = await storageAdmin().rpc("revoke_app_session", {
        session_hash: tokenHash(token),
      });
      if (error) throw new Error("로그아웃하지 못했어요. 다시 시도해 주세요.");
    }
    jar.set(sessionCookie(), "", { ...cookieOptions(), maxAge: 0 });
    const response = json({ ok: true });
    response.headers.set("Clear-Site-Data", '"cache"');
    return response;
  } catch (e) {
    return failure(e);
  }
}
