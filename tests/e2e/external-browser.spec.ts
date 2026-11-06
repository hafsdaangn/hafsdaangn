import { test, expect } from "@playwright/test";

test("ordinary browsers do not show the external browser notice", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("link", { name: /계정으로 시작하기/ }),
  ).toBeVisible();
  await expect(
    page.getByRole("complementary", { name: "외부 브라우저 안내" }),
  ).toHaveCount(0);
});

for (const device of ["Android 14", "iPhone; CPU iPhone OS 17_5_1"]) {
  test.describe(device, () => {
    test.use({
      userAgent: `Mozilla/5.0 (${device}) AppleWebKit/537.36 KAKAOTALK/10.8.3 (INAPP)`,
      viewport: { width: 320, height: 800 },
    });

    test("Kakao keeps a manual handoff available if the native launch is blocked", async ({
      page,
    }) => {
      await page.goto("/?from=kakao#login");
      const notice = page.getByRole("complementary", {
        name: "외부 브라우저 안내",
      });
      await expect(notice).toBeVisible();
      const href = await notice
        .getByRole("link", { name: "외부 브라우저로 열기" })
        .getAttribute("href");
      expect(new URL(href!).searchParams.get("url")).toBe(page.url());
      await expect(notice).toContainText("주소를 복사해");
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        ),
      ).toBe(false);
    });
  });
}
