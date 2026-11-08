import { NextResponse } from "next/server";
// Authorization belongs to member() in every protected page/handler.
export function proxy() {
  const response = NextResponse.next();
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
export const config = { matcher: ["/app/:path*", "/auth/:path*"] };
