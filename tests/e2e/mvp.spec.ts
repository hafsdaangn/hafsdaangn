import { test, expect } from "@playwright/test";
test("login landing and protected routes", async ({
  page,
  request,
}, testInfo) => {
  const development = testInfo.project.name === "development";
  await page.goto("/");
  await expect(
    page.getByRole("link", {
      name: development
        ? "Google 계정으로 시작하기"
        : "학교 Google 계정으로 시작하기",
    }),
  ).toBeVisible();
  await expect(
    page.getByText(
      development
        ? "개발 환경 · 모든 Google 계정을 사용할 수 있어요"
        : "@hafs.hs.kr 계정만 이용할 수 있어요",
    ),
  ).toBeVisible();
  await expect(page.locator('a[href^="/demo"]')).toHaveCount(0);
  for (const path of ["/demo", "/demo/new", "/demo/chats"])
    expect((await request.get(path)).status()).toBe(404);
  await page.goto("/app");
  await expect(page).toHaveURL(/error=setup/);
  expect((await request.get("/api/data")).ok()).toBe(false);
  for (const width of [320, 375, 414, 768, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
    ).toBe(false);
  }
});
