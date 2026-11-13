import { test, expect, type Page } from "@playwright/test";
import { build } from "esbuild";
import { readFile } from "node:fs/promises";

let bundle: string;
let css: string;
test.beforeAll(async () => {
  // Bundle the actual components. Only the authenticated app context and Next
  // links are replaced; production routes/auth never gain a test bypass.
  const result = await build({
    entryPoints: ["tests/fixtures/pwa-onboarding.tsx"],
    bundle: true,
    write: false,
    outfile: "fixture.js",
    jsx: "automatic",
    define: { "process.env.NODE_ENV": '"production"', "process.env": "{}" },
    plugins: [
      {
        name: "fixture-context",
        setup(builder) {
          builder.onResolve({ filter: /^posthog-js$/ }, () => ({
            path: "analytics",
            namespace: "fixture-analytics",
          }));
          builder.onLoad(
            { filter: /.*/, namespace: "fixture-analytics" },
            () => ({
              contents: `export default {
              get_distinct_id: () => window.pwaTest.distinctId,
              capture(event, properties) {
                window.pwaTest.analytics.push({ event, properties, distinctId: window.pwaTest.distinctId });
                return {};
              }
            };`,
            }),
          );
          builder.onResolve({ filter: /^next\/navigation$/ }, () => ({
            path: "navigation",
            namespace: "fixture-navigation",
          }));
          builder.onLoad(
            { filter: /.*/, namespace: "fixture-navigation" },
            () => ({
              contents:
                'export const usePathname = () => location.search.includes("landing") ? "/" : "/app";',
            }),
          );
          builder.onResolve({ filter: /^\.\/provider$/ }, () => ({
            path: "context",
            namespace: "fixture",
          }));
          builder.onLoad({ filter: /.*/, namespace: "fixture" }, () => ({
            contents:
              'export const useApp = () => ({state:{viewer:{id:"test-user"}},base:"/app"});',
          }));
          builder.onResolve({ filter: /^next\/link$/ }, () => ({
            path: "link",
            namespace: "fixture-link",
          }));
          builder.onLoad({ filter: /.*/, namespace: "fixture-link" }, () => ({
            contents:
              'import {createElement} from "react"; export default function Link(props){return createElement("a",props)}',
            resolveDir: process.cwd(),
          }));
        },
      },
    ],
  });
  bundle = result.outputFiles.find((file) => file.path.endsWith(".js"))!.text;
  const globals = (await readFile("app/globals.css", "utf8")).replace(
    /^@import.*$/gm,
    "",
  );
  css =
    (await readFile("tokens.css", "utf8")) +
    globals +
    result.outputFiles.find((file) => file.path.endsWith(".css"))!.text;
});

type Options = {
  desktop?: boolean;
  ios?: boolean;
  standalone?: boolean;
  denied?: boolean;
  off?: boolean;
  connected?: boolean;
  granted?: boolean;
  inApp?: boolean;
  unconfigured?: boolean;
  holdPrepare?: boolean;
  holdSubscribe?: boolean;
  holdSave?: boolean;
  preferencesFail?: boolean;
  dismissInstall?: boolean;
  holdIdentify?: boolean;
};
async function openFixture(
  page: Page,
  options: Options = {},
  settings: boolean | "install-entry" | "landing" = false,
) {
  page.on("pageerror", (error) => console.error(error.message));
  await page.addInitScript((options) => {
    const state = {
      permission: options.denied
        ? "denied"
        : options.connected || options.granted
          ? "granted"
          : "default",
      subscriptions: 0,
      posts: 0,
      prompts: 0,
      deletes: 0,
      failSave: false,
      saved: Boolean(options.connected),
      preferencesFail: Boolean(options.preferencesFail),
      distinctId: options.holdIdentify ? "anonymous" : "test-user",
      analytics: [] as {
        event: string;
        properties: Record<string, unknown>;
        distinctId: string;
      }[],
    };
    Object.assign(window, { pwaTest: state });
    if (options.off) localStorage.setItem("push-off:v2:test-user", "true");
    Object.defineProperty(navigator, "userAgent", {
      value: options.ios
        ? "iPhone OS 26_0"
        : options.desktop
          ? "Windows NT 10.0 Chrome"
          : `Android 14${options.inApp ? " KAKAOTALK" : ""}`,
    });
    Object.defineProperty(navigator, "platform", {
      value: options.ios ? "iPhone" : "Linux",
    });
    const originalMedia = window.matchMedia.bind(window);
    window.matchMedia = (query) =>
      query.includes("display-mode")
        ? (Object.assign(new EventTarget(), {
            matches: Boolean(options.standalone),
            media: query,
            onchange: null,
            addListener() {},
            removeListener() {},
          }) as MediaQueryList)
        : originalMedia(query);
    Object.defineProperty(window, "Notification", {
      value: {
        get permission() {
          return state.permission;
        },
      },
    });
    Object.defineProperty(window, "PushManager", { value: class {} });
    const makeSubscription = () => ({
      toJSON: () => ({
        endpoint: "https://push.apple.com/test",
        keys: { p256dh: "test", auth: "test" },
      }),
      unsubscribe: async () => {
        subscription = null;
        return true;
      },
    });
    let subscription: ReturnType<typeof makeSubscription> | null =
      options.connected ? makeSubscription() : null;
    const registration = {
      pushManager: {
        getSubscription: async () => subscription,
        subscribe: async () => {
          state.subscriptions++;
          state.permission = "granted";
          if (options.holdSubscribe)
            await new Promise<void>((resolve) =>
              Object.assign(window, { releasePushSubscription: resolve }),
            );
          subscription = makeSubscription();
          return subscription;
        },
      },
      showNotification: async () => {},
    };
    Object.defineProperty(navigator, "serviceWorker", {
      value: {
        register: async () => registration,
        ready: Promise.resolve(registration),
      },
    });
    const originalFetch = window.fetch.bind(window);
    window.fetch = async (input, init) => {
      if (input === "/api/push/chat")
        return new Response(
          JSON.stringify({
            enabled:
              init?.method === "PUT"
                ? JSON.parse(String(init.body)).enabled
                : true,
          }),
        );
      if (input === "/api/push/preferences")
        return state.preferencesFail
          ? new Response(
              JSON.stringify({
                error: "게시글 알림 설정을 불러오지 못했어요.",
              }),
              { status: 503 },
            )
          : new Response(
              JSON.stringify([
                { section: "giveaway", mode: "off", keywords: [] },
                { section: "lost", mode: "off", keywords: [] },
              ]),
            );
      if (input !== "/api/push") return originalFetch(input, init);
      if (init?.method === "GET" && options.holdPrepare) {
        await new Promise<void>((resolve) =>
          Object.assign(window, { releasePushPreparation: resolve }),
        );
      }
      if (init?.method === "POST") {
        state.posts++;
        if (options.holdSave && state.posts === 1)
          await new Promise<void>((resolve) =>
            Object.assign(window, { releasePushSave: resolve }),
          );
        if (state.failSave)
          return new Response(JSON.stringify({ error: "server unavailable" }), {
            status: 503,
          });
        state.saved = true;
      }
      if (init?.method === "DELETE") {
        state.deletes++;
        state.saved = false;
      }
      return new Response(
        JSON.stringify(
          init?.method === "GET"
            ? {
                configured: !options.unconfigured,
                subscribed: state.saved,
                publicKey: "AQ",
              }
            : { ok: true },
        ),
      );
    };
    Object.assign(window, {
      sendInstallEvent: () => {
        const event = Object.assign(
          new Event("beforeinstallprompt", { cancelable: true }),
          {
            prompt: async () => {
              state.prompts++;
            },
            userChoice: Promise.resolve({
              outcome: options.dismissInstall ? "dismissed" : "accepted",
            }),
          },
        );
        window.dispatchEvent(event);
      },
    });
  }, options);
  await page.route("**/__pwa-fixture**", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: '<!doctype html><html lang="ko"><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/__pwa-style.css"></head><body><div id="root"></div><script src="/__pwa-bundle.js"></script></body></html>',
    }),
  );
  await page.route("**/__pwa-bundle.js", (route) =>
    route.fulfill({ contentType: "application/javascript", body: bundle }),
  );
  await page.route("**/__pwa-style.css", (route) =>
    route.fulfill({ contentType: "text/css", body: css }),
  );
  await page.goto(
    `/__pwa-fixture${settings === "landing" ? "?install-entry&landing" : settings === "install-entry" ? "?install-entry" : settings ? "?settings" : ""}`,
  );
}

test("website install button stays hidden until a native install event is available", async ({
  page,
}) => {
  await openFixture(page, { desktop: true }, "install-entry");
  const button = page.getByRole("button", { name: "앱 설치", exact: true });
  await expect(button).toHaveCount(0);
  await page.evaluate(() =>
    (window as unknown as { sendInstallEvent: () => void }).sendInstallEvent(),
  );
  await button.click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(
    await page.evaluate(
      () =>
        (window as unknown as { pwaTest: { prompts: number } }).pwaTest.prompts,
    ),
  ).toBe(1);
  await expect(button).toHaveCount(0);
});

test("Android login landing opens the native install prompt from its install button", async ({
  page,
}) => {
  await openFixture(page, {}, "landing");
  await page.evaluate(() =>
    (window as unknown as { sendInstallEvent: () => void }).sendInstallEvent(),
  );
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("button", { name: "앱 설치", exact: true }).click();
  expect(
    await page.evaluate(
      () =>
        (window as unknown as { pwaTest: { prompts: number } }).pwaTest.prompts,
    ),
  ).toBe(1);
});

test("iOS login landing opens instructions only when installation is clicked", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await openFixture(page, { ios: true }, "landing");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("button", { name: "앱 설치", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText("설치한 앱으로 접속해야 알림을 허용");
  await expect(dialog).toContainText("공유");
  await expect(dialog).toContainText("홈 화면에 추가");
  expect(await dialog.getByRole("listitem").count()).toBeGreaterThanOrEqual(3);
  for (const element of await dialog.locator("h2, p, li").all()) {
    expect(await element.evaluate((el) => getComputedStyle(el).textAlign)).toBe(
      "left",
    );
  }
  await dialog.getByRole("button", { name: "확인" }).click();
  await expect(dialog).toHaveCount(0);
});

test("iOS header installation button opens and reopens the manual guide", async ({
  page,
}) => {
  await openFixture(page, { ios: true }, "install-entry");
  const button = page.getByRole("button", { name: "앱 설치", exact: true });
  await expect(button).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await button.click();
  await expect(page.getByRole("dialog")).toContainText("홈 화면에 추가");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await button.click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("dialog").getByRole("button", { name: "확인" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("iOS shows manual home screen instructions after login without invoking installation or push", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await openFixture(page, { ios: true });
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText("Safari");
  await expect(dialog).toContainText("공유");
  await expect(dialog).toContainText("홈 화면에 추가");
  await expect(dialog).toContainText("합스당근 아이콘");
  await expect(dialog).toContainText("설치한 앱으로 접속해야 알림을 허용");
  await expect(
    dialog.getByRole("button", { name: "앱 설치", exact: true }),
  ).toHaveCount(0);
  await expect(dialog.getByRole("button")).toHaveCount(1);
  await dialog.getByRole("button", { name: "확인" }).click();
  await page.addInitScript(() => {
    const now = Date.now();
    Date.now = () => now + 8 * 86400000;
  });
  await page.reload();
  await expect(page.getByRole("button", { name: "설정 열기" })).toBeVisible();
  await expect(dialog).toHaveCount(0);
  await page.getByRole("button", { name: "설정 열기" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "앱 설치", exact: true }),
  ).toHaveCount(0);
  expect(
    await page.evaluate(
      () =>
        (window as unknown as { pwaTest: { subscriptions: number } }).pwaTest
          .subscriptions,
    ),
  ).toBe(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
  ).toBe(false);
});

test("iOS notification settings reopen installation help without requesting push in a browser tab", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await openFixture(page, { ios: true }, true);
  await expect(
    page.getByText("앱을 먼저 설치해야 해요", { exact: false }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "알림 허용", exact: true }),
  ).toHaveCount(0);
  const install = page.getByRole("button", { name: "앱 설치 방법 보기" });
  await install.click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText("홈 화면에 추가");
  await expect(dialog).toContainText("합스당근 아이콘");
  await dialog.getByRole("button", { name: "확인" }).click();
  await expect(dialog).toHaveCount(0);
  await install.click();
  await expect(dialog).toBeVisible();
  expect(
    await page.evaluate(
      () =>
        (window as unknown as { pwaTest: { subscriptions: number } }).pwaTest
          .subscriptions,
    ),
  ).toBe(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
  ).toBe(false);
});
test("Android installation immediately advances to push while preparation is pending", async ({
  page,
}) => {
  await openFixture(page, { holdPrepare: true });
  await page.evaluate(() =>
    (window as unknown as { sendInstallEvent: () => void }).sendInstallEvent(),
  );
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("button")).toHaveCount(2);
  await expect(dialog).not.toContainText("알림");
  await page.evaluate(() =>
    (window as unknown as { sendInstallEvent: () => void }).sendInstallEvent(),
  );
  await dialog.getByRole("button", { name: "앱 설치", exact: true }).click();
  await expect(dialog).toContainText("알림을 설정할까요?");
  const allow = dialog.getByRole("button", { name: "알림 허용", exact: true });
  await expect(allow).toBeDisabled();
  expect(
    await page.evaluate(
      () =>
        (
          window as unknown as {
            pwaTest: { subscriptions: number; posts: number; prompts: number };
          }
        ).pwaTest,
    ),
  ).toMatchObject({ subscriptions: 0, posts: 0, prompts: 1 });
  await page.evaluate(() =>
    (
      window as unknown as { releasePushPreparation: () => void }
    ).releasePushPreparation(),
  );
  await expect(allow).toBeEnabled();
  await allow.click();
  await expect(dialog).toContainText("알림을 설정했어요");
});

test("dismissing native Android installation does not advance to push", async ({
  page,
}) => {
  await openFixture(page, { holdPrepare: true, dismissInstall: true });
  await page.evaluate(() =>
    (window as unknown as { sendInstallEvent: () => void }).sendInstallEvent(),
  );
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "앱 설치", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await page.evaluate(() =>
    (
      window as unknown as { releasePushPreparation: () => void }
    ).releasePushPreparation(),
  );
  await expect(page.getByRole("button", { name: "설정 열기" })).toBeVisible();
  await expect(dialog).toHaveCount(0);
});

test("installed iOS shows push guidance before preparation finishes", async ({
  page,
}) => {
  await openFixture(page, { ios: true, standalone: true, holdPrepare: true });
  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText("알림을 설정할까요?");
  const allow = dialog.getByRole("button", { name: "알림 허용", exact: true });
  await expect(allow).toBeDisabled();
  await page.evaluate(() =>
    (
      window as unknown as { releasePushPreparation: () => void }
    ).releasePushPreparation(),
  );
  await expect(allow).toBeEnabled();
});

async function analyticsEvents(page: Page) {
  return page.evaluate(
    () =>
      (
        window as unknown as {
          pwaTest: {
            analytics: {
              event: string;
              properties: Record<string, unknown>;
              distinctId: string;
            }[];
          };
        }
      ).pwaTest.analytics,
  );
}

test("Android acceptance is not installation completion until appinstalled fires", async ({
  page,
}) => {
  await openFixture(page, { holdPrepare: true });
  await page.evaluate(() =>
    (window as unknown as { sendInstallEvent: () => void }).sendInstallEvent(),
  );
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "앱 설치", exact: true })
    .click();
  await expect
    .poll(async () => (await analyticsEvents(page)).map(({ event }) => event))
    .toContain("pwa_install_accepted");
  expect((await analyticsEvents(page)).map(({ event }) => event)).not.toContain(
    "pwa_install_completed",
  );
  await page.evaluate(() => window.dispatchEvent(new Event("appinstalled")));
  await expect
    .poll(
      async () =>
        (await analyticsEvents(page)).filter(
          ({ event }) => event === "pwa_install_completed",
        ).length,
    )
    .toBe(1);
  await page.evaluate(() => window.dispatchEvent(new Event("appinstalled")));
  const installed = (await analyticsEvents(page)).find(
    ({ event }) => event === "pwa_install_completed",
  )!;
  expect(installed.distinctId).toBe("test-user");
  expect(installed.properties.detection_method).toBe("appinstalled");
});

test("iOS analytics wait for identify and separate granted permission from a failed server save", async ({
  page,
}) => {
  await openFixture(page, { ios: true, standalone: true, holdIdentify: true });
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("button", { name: "알림 허용" })).toBeEnabled();
  expect((await analyticsEvents(page)).map(({ event }) => event)).not.toContain(
    "onboarding_started",
  );
  await page.evaluate(() => {
    const state = (
      window as unknown as {
        pwaTest: { distinctId: string; failSave: boolean };
      }
    ).pwaTest;
    state.distinctId = "test-user";
    state.failSave = true;
    window.dispatchEvent(new Event("analytics-identity-changed"));
  });
  await expect
    .poll(async () => (await analyticsEvents(page)).map(({ event }) => event))
    .toContain("pwa_install_completed");
  await dialog.getByRole("button", { name: "알림 허용" }).click();
  await expect(dialog.getByRole("alert")).toBeVisible();
  await expect
    .poll(async () => (await analyticsEvents(page)).map(({ event }) => event))
    .toContain("push_permission_granted");
  expect((await analyticsEvents(page)).map(({ event }) => event)).not.toContain(
    "push_setup_completed",
  );
  await page.evaluate(() => {
    (window as unknown as { pwaTest: { failSave: boolean } }).pwaTest.failSave =
      false;
  });
  await dialog.getByRole("button", { name: "다시 시도" }).click();
  await expect
    .poll(
      async () =>
        (await analyticsEvents(page)).filter(
          ({ event }) => event === "push_setup_completed",
        ).length,
    )
    .toBe(1);
  const milestones = (await analyticsEvents(page)).filter(({ event }) =>
    [
      "onboarding_started",
      "pwa_install_completed",
      "push_permission_granted",
      "push_setup_completed",
    ].includes(event),
  );
  expect(milestones.map(({ event }) => event)).toEqual([
    "onboarding_started",
    "pwa_install_completed",
    "push_permission_granted",
    "push_setup_completed",
  ]);
  expect(milestones.every(({ distinctId }) => distinctId === "test-user")).toBe(
    true,
  );
});

test("installed iOS retries a failed server save without creating a second subscription", async ({
  page,
}) => {
  await openFixture(page, { ios: true, standalone: true });
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("button", { name: "알림 허용" })).toBeEnabled();
  await page.evaluate(() => {
    (window as unknown as { pwaTest: { failSave: boolean } }).pwaTest.failSave =
      true;
  });
  await dialog.getByRole("button", { name: "알림 허용" }).click();
  await expect(dialog.getByRole("alert")).toContainText(
    "서버에 설정을 저장하지 못했어요",
  );
  await page.evaluate(() => {
    (window as unknown as { pwaTest: { failSave: boolean } }).pwaTest.failSave =
      false;
  });
  await dialog.getByRole("button", { name: "다시 시도" }).click();
  await expect(dialog).toContainText("알림을 설정했어요");
  expect(
    await page.evaluate(
      () =>
        (
          window as unknown as {
            pwaTest: { subscriptions: number; posts: number };
          }
        ).pwaTest,
    ),
  ).toMatchObject({ subscriptions: 1, posts: 2 });
});

for (const stage of ["subscribe", "save"] as const) {
  test(`iOS stalled ${stage} exits busy state and can recover`, async ({
    page,
  }) => {
    await openFixture(page, {
      ios: true,
      standalone: true,
      holdSubscribe: stage === "subscribe",
      holdSave: stage === "save",
    });
    const dialog = page.getByRole("dialog");
    await expect(
      dialog.getByRole("button", { name: "알림 허용" }),
    ).toBeEnabled();
    await page.clock.install();
    await dialog.getByRole("button", { name: "알림 허용" }).click();
    await expect(
      dialog.getByRole("button", { name: "설정 중" }),
    ).toBeDisabled();
    await page.clock.fastForward(stage === "subscribe" ? 31000 : 16000);
    await expect(dialog.getByRole("alert")).toContainText(
      stage === "subscribe"
        ? "기기의 알림 등록을 완료하지 못했어요"
        : "서버에 설정을 저장하지 못했어요",
    );
    await expect(dialog.getByRole("button", { name: "나중에" })).toBeEnabled();
    await page.evaluate((stage) => {
      const control = window as unknown as {
        releasePushSubscription: () => void;
        releasePushSave: () => void;
      };
      if (stage === "subscribe") control.releasePushSubscription();
      else control.releasePushSave();
    }, stage);
    await dialog.getByRole("button", { name: "다시 시도" }).click();
    await expect(dialog).toContainText("알림을 설정했어요");
    expect(
      await page.evaluate(
        () =>
          (window as unknown as { pwaTest: { subscriptions: number } }).pwaTest
            .subscriptions,
      ),
    ).toBe(1);
  });
}

test("granted permission automatically registers and ignores the old device-off choice", async ({
  page,
}) => {
  await openFixture(page, { standalone: true, off: true, granted: true }, true);
  await expect(
    page.getByText("이 기기에서 알림이 허용되어 있어요.", { exact: true }),
  ).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (window as unknown as { pwaTest: { posts: number } }).pwaTest.posts,
      ),
    )
    .toBe(1);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    page.locator('[aria-labelledby="chat-notifications-label"]'),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "알림 허용", exact: true }),
  ).toHaveCount(0);
  expect(
    await page.evaluate(
      () =>
        (
          window as unknown as {
            pwaTest: { subscriptions: number; deletes: number };
          }
        ).pwaTest,
    ),
  ).toMatchObject({ subscriptions: 1, deletes: 0 });
});

test("in-app and denied settings explain recovery without a permission CTA", async ({
  page,
}) => {
  await openFixture(page, { inApp: true }, true);
  await expect(
    page.getByText("인앱 브라우저에서는 알림을 설정하지 않아요.", {
      exact: false,
    }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: /알림 받기$/ })).toHaveCount(0);
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("denied permission shows settings help instead of another native request", async ({
  page,
}) => {
  await openFixture(page, { ios: true, standalone: true, denied: true }, true);
  await expect(
    page.getByText("알림이 차단되어 있어요.", { exact: false }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: /알림 받기$/ })).toHaveCount(0);
});

test("postponing Android installation does not open notification settings when preparation finishes", async ({
  page,
}) => {
  await openFixture(page, { holdPrepare: true });
  await page.evaluate(() =>
    (window as unknown as { sendInstallEvent: () => void }).sendInstallEvent(),
  );
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "나중에", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await page.evaluate(() =>
    (
      window as unknown as { releasePushPreparation: () => void }
    ).releasePushPreparation(),
  );
  await page.getByRole("button", { name: "설정 열기" }).click();
  await expect(
    page.getByRole("button", { name: "알림 허용", exact: true }),
  ).toBeEnabled();
  await expect(dialog).toHaveCount(0);
});

test("server-unconfigured state never pretends notifications can be connected", async ({
  page,
}) => {
  await openFixture(page, { unconfigured: true }, true);
  await expect(
    page.getByText("알림 기능을 준비하고 있어요.", { exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: /알림 받기$/ })).toHaveCount(0);
  expect(
    await page.evaluate(
      () =>
        (window as unknown as { pwaTest: { subscriptions: number } }).pwaTest
          .subscriptions,
    ),
  ).toBe(0);
});

test("account settings errors stay inside their card and retry restores the settings", async ({
  page,
}) => {
  await openFixture(page, { granted: true, preferencesFail: true }, true);
  const account = page.getByRole("region", {
    name: "게시글 알림",
    exact: true,
  });
  await expect(account.getByRole("alert")).toContainText(
    "게시글 알림 설정을 불러오지 못했어요",
  );
  await expect(account.getByRole("alert")).toBeVisible();
  await expect(page.getByText("기기를 연결", { exact: false })).toHaveCount(0);
  for (const width of [320, 375, 414, 768, 1280]) {
    await page.setViewportSize({ width, height: 1000 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
    ).toBe(false);
  }
  await page.screenshot({
    path: "output/pwa-onboarding/settings-error.png",
    fullPage: true,
  });
  await page.evaluate(() => {
    (
      window as unknown as { pwaTest: { preferencesFail: boolean } }
    ).pwaTest.preferencesFail = false;
  });
  await account.getByRole("button", { name: "다시 불러오기" }).click();
  await expect(account.getByRole("alert")).toHaveCount(0);
  await expect(
    page
      .getByRole("region", { name: "나눔 알림", exact: true })
      .getByRole("radio", { name: "끄기", exact: true }),
  ).toBeEnabled();
  await page.screenshot({
    path: "output/pwa-onboarding/settings-ready.png",
    fullPage: true,
  });
});
