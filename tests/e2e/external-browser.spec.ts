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

    test("Kakao shows the logo and external browser action instead of login", async ({
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
      await expect(notice).toContainText(
        "카카오톡 내부 브라우저에서는 기능이 제한돼요. 외부 브라우저에서 이용해 주세요.",
      );
      await expect(page.getByRole("img", { name: "합스당근" })).toBeVisible();
      await expect(page.locator('a[href="/auth/login"]')).toHaveCount(0);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        ),
      ).toBe(false);
    });
  });
}
