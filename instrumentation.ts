export async function register() {
  if (
    process.env.NEXT_RUNTIME === "nodejs" &&
    process.env.NEXT_PHASE !== "phase-production-build"
  ) {
    const { appEnvironment } = await import("./lib/environment");
    appEnvironment();
    const { configured } = await import("./lib/supabase/server");
    if (configured()) {
      const { ensureAuthPolicy } = await import("./lib/auth-policy");
      try {
        await ensureAuthPolicy();
      } catch (error) {
        // Login and member requests retry and remain blocked until policy sync succeeds.
        console.error(
          "[auth-policy]",
          error instanceof Error ? error.message : "로그인 정책 동기화 실패",
        );
      }
    }
  }
}
