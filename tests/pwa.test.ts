import { test } from "node:test";
import assert from "node:assert/strict";
import posthog from "posthog-js";
import { captureDeviceEventOnce } from "../lib/device-analytics";
import {
  connectPush,
  snooze,
  snoozed,
  withTimeout,
  readPushChoice,
  writePushChoice,
  type PreparedPush,
} from "../lib/push-client";
import { devicePermission } from "../lib/push-permission";
import { closeReadChatNotifications } from "../lib/chat-notifications";
import {
  deviceEnvironment,
  observeInstall,
  installSnapshot,
  promptInstall,
} from "../lib/pwa-install";

function replace(name: string, value: unknown) {
  const old = Object.getOwnPropertyDescriptor(globalThis, name);
  Object.defineProperty(globalThis, name, {
    value,
    configurable: true,
    writable: true,
  });
  return () => {
    if (old) Object.defineProperty(globalThis, name, old);
    else Reflect.deleteProperty(globalThis, name);
  };
}

test("reading a chat closes only its read notifications, including legacy URL-only notifications", async () => {
  const closed: string[] = [];
  const notification = (
    name: string,
    tag: string,
    data: Record<string, unknown>,
  ) => ({ tag, data, close: () => closed.push(name) });
  const notifications = [
    notification("read", "chat-room", { conversationId: "room", seq: 5 }),
    notification("newer", "chat-room", { conversationId: "room", seq: 6 }),
    notification("other room", "chat-other", {
      conversationId: "other",
      seq: 1,
    }),
    notification("post", "post-post", { url: "/app/posts/post" }),
    notification("legacy", "", { url: "/app/chats/room" }),
    notification("external", "", {
      url: "https://other.example/app/chats/room",
    }),
  ];
  const restore = [
    replace("window", { location: { origin: "https://app.example" } }),
    replace("navigator", {
      serviceWorker: {
        getRegistration: async () => ({
          getNotifications: async () => notifications,
        }),
      },
    }),
  ];
  try {
    await closeReadChatNotifications("room", 5);
    assert.deepEqual(closed, ["read", "legacy"]);
  } finally {
    restore.reverse().forEach((undo) => undo());
  }
});

test("notification cleanup is harmless without a worker or when notification access fails", async () => {
  const restore = [
    replace("window", { location: { origin: "https://app.example" } }),
    replace("navigator", {}),
  ];
  try {
    await closeReadChatNotifications("room", 5);
    Object.assign(navigator, {
      serviceWorker: {
        getRegistration: async () => {
          throw new Error("unsupported");
        },
      },
    });
    await closeReadChatNotifications("room", 5);
  } finally {
    restore.reverse().forEach((undo) => undo());
  }
});

test("notification cleanup prefers an acknowledged request to the active service worker", async () => {
  let requested:
    { type: string; conversationId: string; readSeq: number } | undefined;
  let pageQueries = 0;
  const restore = [
    replace("window", { location: { origin: "https://app.example" } }),
    replace("navigator", {
      userAgent: "iPhone AppleWebKit/605.1.15 Safari/604.1",
      serviceWorker: {
        getRegistration: async () => ({
          active: {
            postMessage: (
              data: NonNullable<typeof requested>,
              ports: MessagePort[],
            ) => {
              requested = data;
              ports[0].postMessage({
                type: "chat-notifications-closed",
                retryAfter: 0,
              });
            },
          },
          getNotifications: async () => {
            pageQueries++;
            return [];
          },
        }),
      },
    }),
  ];
  try {
    await closeReadChatNotifications("worker-room", 9);
    assert.equal(requested?.type, "close-read-chat-notifications");
    assert.equal(requested?.conversationId, "worker-room");
    assert.equal(requested?.readSeq, 9);
    assert.equal(pageQueries, 0);
  } finally {
    restore.reverse().forEach((undo) => undo());
  }
});

test("device eligibility distinguishes iOS tabs, installed apps, old OS, in-app and insecure contexts", () => {
  const browser = Object.assign(new EventTarget(), {
    isSecureContext: true,
    Notification: {},
    PushManager: {},
  });
  const navigator = {
    userAgent: "iPhone OS 18_4",
    platform: "iPhone",
    maxTouchPoints: 1,
    serviceWorker: {},
  };
  let standalone = false;
  const restore = [
    replace("window", browser),
    replace("navigator", navigator),
    replace("Notification", { permission: "default" }),
    replace("matchMedia", () => ({ matches: standalone })),
  ];
  try {
    assert.equal(devicePermission(), "install");
    standalone = true;
    assert.equal(devicePermission(), "default");
    navigator.userAgent = "iPhone OS 16_3";
    assert.equal(devicePermission(), "old-ios");
    navigator.userAgent = "iPhone OS 18_4 KAKAOTALK";
    assert.equal(devicePermission(), "in-app");
    navigator.userAgent = "Android 14";
    browser.isSecureContext = false;
    assert.equal(devicePermission(), "insecure");
    browser.isSecureContext = true;
    navigator.userAgent = "Macintosh";
    navigator.platform = "MacIntel";
    navigator.maxTouchPoints = 5;
    assert.equal(deviceEnvironment().ios, true);
  } finally {
    restore.reverse().forEach((undo) => undo());
  }
});

test("install event may arrive late and can only be consumed once", async () => {
  const browser = Object.assign(new EventTarget(), { isSecureContext: true });
  const restore = [
    replace("window", browser),
    replace("navigator", {
      userAgent: "Android",
      platform: "Linux",
      maxTouchPoints: 1,
    }),
    replace("matchMedia", () =>
      Object.assign(new EventTarget(), { matches: false }),
    ),
  ];
  const stop = observeInstall();
  try {
    assert.equal(installSnapshot().prompt, null);
    let calls = 0;
    const event = Object.assign(
      new Event("beforeinstallprompt", { cancelable: true }),
      {
        prompt: async () => {
          calls++;
        },
        userChoice: Promise.resolve({ outcome: "accepted" }),
      },
    );
    browser.dispatchEvent(event);
    assert.equal(event.defaultPrevented, true);
    const first = promptInstall();
    await assert.rejects(promptInstall());
    assert.equal(await first, "accepted");
    assert.equal(calls, 1);
    assert.equal(installSnapshot().installed, false);
    browser.dispatchEvent(new Event("appinstalled"));
    assert.equal(installSnapshot().installed, true);
  } finally {
    stop();
    restore.reverse().forEach((undo) => undo());
  }
});

test("subscribe starts synchronously from click and server failure retains subscription for retry", async (t) => {
  const events: string[] = [];
  t.mock.method(posthog, "capture", (event: string) => {
    events.push(event);
    return {};
  });
  const restoreStorage = replace("localStorage", {
    getItem: () => null,
    setItem: () => {},
  });
  const calls: string[] = [];
  const subscription = {
    toJSON: () => ({ endpoint: "https://push.apple.com/test" }),
  } as PushSubscription;
  const prepared = {
    config: { configured: true, publicKey: "key", subscribed: false },
    key: new Uint8Array([1]),
    subscription: null,
    registration: {
      pushManager: {
        subscribe: () => {
          calls.push("subscribe");
          return Promise.resolve(subscription);
        },
      },
    },
  } as unknown as PreparedPush;
  let fail = true;
  const undo = replace("fetch", async (_url: string, request: RequestInit) => {
    calls.push(request.method!);
    return new Response(
      JSON.stringify(fail ? { error: "save failed" } : { ok: true }),
      { status: fail ? 503 : 200 },
    );
  });
  try {
    const result = connectPush(prepared);
    assert.deepEqual(calls, ["subscribe"]);
    await assert.rejects(result, /서버에 설정을 저장하지 못했어요/);
    assert.equal(prepared.subscription, subscription);
    assert.deepEqual(events, []);
    fail = false;
    assert.equal(await connectPush(prepared), subscription);
    assert.deepEqual(calls, ["subscribe", "POST", "POST"]);
    await connectPush(prepared);
    assert.deepEqual(events, ["push_subscription_enabled"]);
  } finally {
    undo();
    restoreStorage();
  }
});

test("device milestones respect persistent markers and retry if analytics was unavailable", async (t) => {
  const storage = new Map([["device-milestone:v1:already-recorded", "1"]]);
  const restore = replace("localStorage", {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
  });
  let ready = false;
  const events: string[] = [];
  t.mock.method(posthog, "capture", (event: string) => {
    if (!ready) return undefined;
    events.push(event);
    return {};
  });
  try {
    await captureDeviceEventOnce("retry-milestone");
    assert.equal(storage.has("device-milestone:v1:retry-milestone"), false);
    ready = true;
    await captureDeviceEventOnce("already-recorded");
    await Promise.all([
      captureDeviceEventOnce("retry-milestone"),
      captureDeviceEventOnce("retry-milestone"),
    ]);
    assert.deepEqual(events, ["retry-milestone"]);
    assert.equal(storage.get("device-milestone:v1:retry-milestone"), "1");
  } finally {
    restore();
  }
});

test("installation and standalone launch produce separate milestones only once", async (t) => {
  const browser = Object.assign(new EventTarget(), { isSecureContext: true });
  let standalone = false;
  const events: string[] = [];
  t.mock.method(posthog, "capture", (event: string) => {
    events.push(event);
    return {};
  });
  const restore = [
    replace("window", browser),
    replace("navigator", { userAgent: "iPhone", platform: "iPhone" }),
    replace("matchMedia", () =>
      Object.assign(new EventTarget(), { matches: standalone }),
    ),
    replace("localStorage", {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
    }),
  ];
  const stop = observeInstall();
  try {
    assert.deepEqual(events, []);
    browser.dispatchEvent(new Event("appinstalled"));
    browser.dispatchEvent(new Event("appinstalled"));
    standalone = true;
    browser.dispatchEvent(new Event("pageshow"));
    browser.dispatchEvent(new Event("focus"));
    assert.deepEqual(events, ["pwa_installed", "pwa_first_open"]);
  } finally {
    stop();
    restore.reverse().forEach((undo) => undo());
  }
});

test("unconfigured push cannot subscribe and stalled preparation times out", async () => {
  await assert.rejects(
    connectPush({ config: { configured: false } } as PreparedPush),
    /준비/,
  );
  await assert.rejects(withTimeout(new Promise(() => {}), 5), /오래/);
});

test("stage snoozes expire independently and choices survive blocked storage", () => {
  const undo = replace("localStorage", {
    getItem: () => "stale",
    setItem: () => {
      throw new Error("blocked");
    },
  });
  try {
    snooze("member-a", "install");
    assert.equal(snoozed("member-a", "install"), true);
    assert.equal(snoozed("member-a", "push"), false);
    assert.equal(snoozed("member-b", "install"), false);
    assert.equal(
      snoozed("member-a", "install", Date.now() + 8 * 86400000),
      false,
    );
    writePushChoice("choice", "new");
    assert.equal(readPushChoice("choice"), "new");
  } finally {
    undo();
  }
});
