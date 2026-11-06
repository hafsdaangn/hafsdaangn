import { test, expect } from "@playwright/test";
import { build } from "esbuild";
import { readFile } from "node:fs/promises";
import type { PostNotificationSetting } from "../../lib/post-notifications";

test("post notification sections save independently, retain keywords and recover from save errors", async ({
  page,
}) => {
  const result = await build({
    stdin: {
      contents:
        'import {createRoot} from "react-dom/client"; import {PostNotificationSettings} from "./components/post-notification-settings"; import {ChatNotificationSettings} from "./components/chat-notification-settings"; createRoot(document.getElementById("root")).render(<main className="notification-page page-width"><ChatNotificationSettings/><PostNotificationSettings/></main>);',

      resolveDir: process.cwd(),
      loader: "tsx",
    },
    bundle: true,
    write: false,
    outfile: "post-fixture.js",
    jsx: "automatic",
    define: { "process.env.NODE_ENV": '"production"', "process.env": "{}" },
  });
  let settings: PostNotificationSetting[] = [
    { section: "giveaway", mode: "off", keywords: [] },
    { section: "lost", mode: "off", keywords: [] },
  ];
  let chatEnabled = true;
  await page.route("**/api/push/chat", async (route) => {
    if (route.request().method() === "PUT")
      chatEnabled = route.request().postDataJSON().enabled;
    return route.fulfill({ json: { enabled: chatEnabled } });
  });
  let failSave = false;
  await page.route("**/api/push/preferences", async (route) => {
    if (route.request().method() === "GET")
      return route.fulfill({ json: settings });
    if (failSave)
      return route.fulfill({ status: 503, json: { error: "저장 실패" } });
    const next = route.request().postDataJSON() as PostNotificationSetting;
    settings = settings.map((setting) =>
      setting.section === next.section ? next : setting,
    );
    return route.fulfill({ json: next });
  });
  const css =
    (await readFile("tokens.css", "utf8")) +
    (await readFile("app/globals.css", "utf8")).replace(/^@import.*$/gm, "") +
    result.outputFiles.find((file) => file.path.endsWith(".css"))!.text;
  await page.route("**/__post-notifications", (route) =>
    route.fulfill({
      contentType: "text/html",
      body:
        '<!doctype html><html lang="ko"><meta name="viewport" content="width=device-width,initial-scale=1"><style>' +
        css +
        '</style><div id="root"></div><script>' +
        result.outputFiles.find((file) => file.path.endsWith(".js"))!.text +
        "</script></html>",
    }),
  );
  await page.goto("/__post-notifications");
  const chat = page.getByRole("region", { name: "채팅 알림", exact: true });
  await expect(chat.getByRole("switch")).toBeEnabled();
  await chat.getByRole("switch").click();
  await expect(chat.getByRole("switch")).not.toBeChecked();
  const giveaway = page.getByRole("region", { name: "나눔 알림" });
  const lost = page.getByRole("region", { name: "분실물 알림" });
  await expect(
    giveaway.getByRole("radio", { name: "모든 새 글", exact: true }),
  ).toBeEnabled();
  await giveaway
    .getByRole("radio", { name: "모든 새 글", exact: true })
    .click();
  await expect(
    giveaway.getByRole("radio", { name: "모든 새 글", exact: true }),
  ).toBeChecked();
  await expect(
    lost.getByRole("radio", { name: "모든 새 글", exact: true }),
  ).not.toBeChecked();
  await lost
    .getByRole("radio", { name: "키워드 일치 글만", exact: true })
    .click();
  await lost.getByLabel("키워드 구독").fill("에어팟");
  await lost.getByRole("button", { name: "추가", exact: true }).click();
  await expect(
    lost.getByRole("button", { name: "분실물 키워드 에어팟 삭제" }),
  ).toBeVisible();
  await page.reload();
  await expect(chat.getByRole("switch")).not.toBeChecked();
  await expect(
    giveaway.getByRole("radio", { name: "모든 새 글", exact: true }),
  ).toBeChecked();
  await expect(
    lost.getByRole("button", { name: "분실물 키워드 에어팟 삭제" }),
  ).toBeVisible();
  await lost.getByRole("radio", { name: "끄기", exact: true }).click();
  await expect(lost.getByLabel("키워드 구독")).toHaveCount(0);
  await lost
    .getByRole("radio", { name: "키워드 일치 글만", exact: true })
    .click();
  await expect(
    lost.getByRole("button", { name: "분실물 키워드 에어팟 삭제" }),
  ).toBeVisible();
  failSave = true;
  await lost.getByRole("button", { name: "분실물 키워드 에어팟 삭제" }).click();
  await expect(lost.getByRole("alert")).toHaveText("저장 실패");
  await expect(
    lost.getByRole("button", { name: "분실물 키워드 에어팟 삭제" }),
  ).toBeVisible();
  failSave = false;
  await lost.getByRole("button", { name: "분실물 키워드 에어팟 삭제" }).click();
  await expect(
    lost.getByRole("button", { name: "분실물 키워드 에어팟 삭제" }),
  ).toHaveCount(0);
  await page.screenshot({
    path: "output/notification-modes.png",
    fullPage: true,
  });
  for (const width of [320, 375, 768]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
    ).toBe(false);
  }
});
