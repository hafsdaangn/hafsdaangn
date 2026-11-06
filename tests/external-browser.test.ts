import { test } from "node:test";
import assert from "node:assert/strict";
import { kakaoExternalBrowserUrl } from "../lib/external-browser";

const android = "Mozilla/5.0 (Linux; Android 14) KAKAOTALK/10.8.3 (INAPP)";
const ios =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5_1) KAKAOTALK/10.8.2 (INAPP)";

test("Kakao handoff preserves the complete URL on Android and iOS", () => {
  const href = "https://example.com/app/posts/123?q=교재&from=kakao#photos";
  for (const ua of [android, ios, ios.toLowerCase()]) {
    const result = kakaoExternalBrowserUrl(ua, href);
    assert.ok(result);
    assert.equal(new URL(result).searchParams.get("url"), new URL(href).href);
  }
});

test("regular browsers and desktop Kakao do not trigger a handoff", () => {
  for (const ua of [
    "Mozilla/5.0 Chrome/140.0",
    "iPhone Safari/604.1",
    "Windows KAKAOTALK/10.8.3",
  ]) {
    assert.equal(kakaoExternalBrowserUrl(ua, "https://example.com/"), null);
  }
});

test("handoff never transfers OAuth callbacks or non-web URLs", () => {
  for (const path of [
    "/auth",
    "/auth/login",
    "/auth/callback?code=secret",
    "/?code=secret",
    "/#access_token=secret",
  ]) {
    assert.equal(
      kakaoExternalBrowserUrl(android, `https://example.com${path}`),
      null,
    );
  }
  assert.equal(kakaoExternalBrowserUrl(android, "javascript:alert(1)"), null);
});
