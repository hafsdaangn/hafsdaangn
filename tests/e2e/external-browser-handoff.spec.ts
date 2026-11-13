import { test, expect } from "@playwright/test";
import { build } from "esbuild";

let bundle: string;
test.beforeAll(async () => {
  const result = await build({
    stdin: {
      contents: `import { StrictMode } from "react";
        import { createRoot } from "react-dom/client";
        import { ExternalBrowser } from "./components/external-browser";
        createRoot(document.getElementById("root")).render(
          <StrictMode><ExternalBrowser><p data-testid="content">Ready</p></ExternalBrowser></StrictMode>
        );`,
      resolveDir: process.cwd(),
      loader: "tsx",
    },
    bundle: true,
    outfile: "fixture.js",
    write: false,
    jsx: "automatic",
    loader: { ".css": "empty" },
    define: { "process.env.NODE_ENV": '"development"' },
    plugins: [
      {
        name: "fixture",
        setup(builder) {
          builder.onResolve({ filter: /^next\/navigation$/ }, () => ({
            path: "navigation",
            namespace: "fixture",
          }));
          builder.onResolve({ filter: /^\.\/brand$/ }, () => ({
            path: "brand",
            namespace: "fixture",
          }));
          builder.onLoad(
            { filter: /.*/, namespace: "fixture" },
            ({ path }) => ({
              contents:
                path === "navigation"
                  ? "export const usePathname = () => location.pathname;"
                  : 'export const Brand = () => "합스당근";',
            }),
          );
        },
      },
    ],
  });
  bundle = result.outputFiles.find((file) => file.path.endsWith(".js"))!.text;
});

for (const device of ["Android 14", "iPhone; CPU iPhone OS 17_5_1"]) {
  test(`Kakao ${device} attempts handoff once and keeps the manual retry link`, async ({
    page,
  }) => {
    await page.addInitScript((device) => {
      Object.defineProperty(navigator, "userAgent", {
        value: `Mozilla/5.0 (${device}) KAKAOTALK/10.8.3`,
      });
    }, device);
    const session = await page.context().newCDPSession(page);
    await session.send("Page.enable");
    const attempts: string[] = [];
    session.on("Page.frameRequestedNavigation", ({ url }) => {
      if (url.startsWith("kakaotalk:")) attempts.push(url);
    });
    await page.route("**/__external-fixture**", (route) =>
      route.fulfill({
        contentType: "text/html",
        body: '<div id="root"></div><script src="/__external-bundle.js"></script>',
      }),
    );
    await page.route("**/__external-bundle.js", (route) =>
      route.fulfill({
        contentType: "application/javascript",
        body: bundle,
      }),
    );
    await page.goto("/__external-fixture?from=kakao#post", {
      waitUntil: "commit",
    });
    await expect.poll(() => attempts.length).toBe(1);
    expect(new URL(attempts[0]).searchParams.get("url")).toBe(page.url());
    await expect(page.getByTestId("content")).toHaveCount(0);
    await expect(
      page.getByText("자동으로 이동하지 않으면", { exact: false }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "외부 브라우저로 열기" }),
    ).toHaveAttribute("href", attempts[0]);

    // OAuth responses must stay in the browser where login started.
    attempts.length = 0;
    await page.goto("/__external-fixture?code=secret");
    await expect(page.getByTestId("content")).toBeVisible();
    expect(attempts).toEqual([]);
  });
}

test("ordinary browsers keep the application visible", async ({ page }) => {
  await page.route("**/__external-fixture", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: '<div id="root"></div><script src="/__external-bundle.js"></script>',
    }),
  );
  await page.route("**/__external-bundle.js", (route) =>
    route.fulfill({
      contentType: "application/javascript",
      body: bundle,
    }),
  );
  await page.goto("/__external-fixture");
  await expect(page.getByTestId("content")).toBeVisible();
  await expect(
    page.getByRole("link", { name: "외부 브라우저로 열기" }),
  ).toHaveCount(0);
});
