export function kakaoExternalBrowserUrl(userAgent: string, href: string) {
  if (!/KAKAOTALK/i.test(userAgent)) return null;
  if (!/Android|iPhone|iPad|iPod/i.test(userAgent)) return null;

  const url = new URL(href);
  if (!["http:", "https:"].includes(url.protocol)) return null;
  // OAuth codes must be redeemed in the browser that started the login.
  if (url.pathname === "/auth" || url.pathname.startsWith("/auth/"))
    return null;
  if (url.searchParams.has("code") || url.hash.includes("access_token="))
    return null;

  return `kakaotalk://web/openExternal?url=${encodeURIComponent(url.href)}`;
}
