import "server-only";
import { appEnvironment } from "./environment";
import { storageAdmin } from "./supabase/server";
let pending: Promise<void> | undefined;
export function ensureAuthPolicy() {
  if (!pending)
    pending = (async () => {
      const { error } = await storageAdmin().rpc("set_app_environment", {
        environment: appEnvironment(),
      });
      if (error?.code === "PGRST202")
        throw new Error(
          "Supabase SQL Editor에서 20260925132923_app_environment.sql을 적용한 뒤 다시 로그인해 주세요.",
        );
      if (error)
        throw new Error(
          `로그인 정책 동기화 실패 (${error.code || "연결 오류"}). DB 마이그레이션과 서버 키를 확인해 주세요.`,
        );
    })().catch((error) => {
      pending = undefined;
      throw error;
    });
  return pending;
}
