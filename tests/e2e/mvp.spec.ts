import { test, expect } from "@playwright/test";
test("web push assets are public while subscription APIs require login", async ({
  request,
}) => {
  const response = await request.get("/manifest.webmanifest");
  expect(response.ok()).toBe(true);
  const manifest = await response.json();
  expect(manifest.display).toBe("standalone");
  expect(manifest.start_url).toBe("/app/chats");
  for (const icon of manifest.icons)
    expect((await request.get(icon.src)).ok()).toBe(true);
  const worker = await request.get("/sw.js");
  expect(worker.ok()).toBe(true);
  expect(worker.headers()["cache-control"]).toContain("no-store");
  expect(await worker.text()).toContain("notificationclick");
  expect((await request.get("/api/push")).ok()).toBe(false);
  expect((await request.post("/api/push", { data: {} })).ok()).toBe(false);
  expect((await request.delete("/api/push")).ok()).toBe(false);
  for (const path of [
    "/api/data",
    "/api/posts?type=market&q=교재",
    "/api/messages?conversation=00000000-0000-4000-8000-000000000001",
    "/api/media/00000000-0000-4000-8000-000000000001",
  ]) {
    const response = await request.get(path);
    expect(response.ok()).toBe(false);
    expect(response.headers()["cache-control"]).toContain("no-store");
  }
});
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
