import "server-only";
export function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const expected = process.env.APP_URL || new URL(request.url).origin;
  if (!origin || origin !== new URL(expected).origin)
    throw new Error("허용되지 않은 요청입니다.");
}
export function failure(error: unknown, status = 400) {
  const message =
    error instanceof Error
      ? error.message
      : "요청을 처리하지 못했어요. 다시 시도해 주세요.";
  return Response.json(
    { error: message },
    { status, headers: { "Cache-Control": "private, no-store" } },
  );
}
export function json(data: unknown) {
  return Response.json(data, {
    headers: { "Cache-Control": "private, no-store" },
  });
}
