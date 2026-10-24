import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { pushEndpoint, subscriptionSchema } from "../lib/push-schema";
import { chatPushContent } from "../lib/push-content";
import type { Message } from "../lib/domain";

test("chat preview includes the sender, message and product within push payload limits", () => {
  const message: Message = {
    id: "message",
    seq: 1,
    conversation_id: "room",
    sender_id: "sender",
    body: "아직 구매 가능한가요?",
    image_id: null,
    client_id: "client",
    created_at: new Date().toISOString(),
  };
  assert.deepEqual(chatPushContent(message, "김민수", "수학 교재"), {
    title: "김민수 · 수학 교재",
    body: "아직 구매 가능한가요?",
    url: "/app/chats/room",
    tag: "chat-room",
  });
  const photo = chatPushContent(
    { ...message, body: "", image_id: "image" },
    null,
    "수학 교재",
  );
  assert.equal(photo.title, "수학 교재");
  assert.equal(photo.body, "사진을 보냈어요.");
  const long = chatPushContent(
    { ...message, body: "🥕".repeat(2000) },
    "김민수",
    "교재",
  );
  assert.ok(long.body.startsWith("🥕".repeat(160) + "…"));
  assert.ok(Buffer.byteLength(JSON.stringify(long)) < 4000);
});

test("push subscriptions reject arbitrary URLs and malformed credentials", () => {
  for (const value of [
    "http://fcm.googleapis.com/a",
    "https://localhost/a",
    "https://169.254.169.254/",
    "https://fcm.googleapis.com.attacker.com/a",
    "https://user:pass@push.apple.com/a",
    "https://push.apple.com:8443/a",
  ])
    assert.equal(pushEndpoint(value), false, value);
  for (const value of [
    "https://fcm.googleapis.com/fcm/send/token",
    "https://web.push.apple.com/token",
    "https://updates.push.services.mozilla.com/wpush/v2/token",
  ])
    assert.equal(pushEndpoint(value), true);
  assert.equal(
    subscriptionSchema.safeParse({
      endpoint: "https://web.push.apple.com/token",
      keys: { p256dh: "A".repeat(87), auth: "B".repeat(22) },
    }).success,
    true,
  );
  assert.equal(
    subscriptionSchema.safeParse({
      endpoint: "https://web.push.apple.com/token",
      keys: { p256dh: "bad", auth: "bad" },
    }).success,
    false,
  );
});

test("service worker shows notifications and opens only same-origin chat links", async () => {
  const handlers: Record<string, (event: unknown) => void> = {};
  const notifications: unknown[][] = [];
  const opened: string[] = [];
  const self = {
    location: { origin: "https://school.example" },
    addEventListener: (event: string, handler: (event: unknown) => void) => {
      handlers[event] = handler;
    },
    registration: {
      showNotification: async (...args: unknown[]) => {
        notifications.push(args);
      },
    },
    clients: {
      matchAll: async () => [],
      openWindow: async (url: string) => {
        opened.push(url);
      },
    },
  };
  runInNewContext(readFileSync("public/sw.js", "utf8"), { self, URL });
  const pending: Promise<unknown>[] = [];
  const waitUntil = (task: Promise<unknown>) => pending.push(task);
  handlers.push({
    data: { json: () => ({ body: "새 메시지", url: "/app/chats/room" }) },
    waitUntil,
  });
  await Promise.all(pending);
  assert.equal(notifications[0][0], "합스당근");
  handlers.notificationclick({
    notification: { close() {}, data: { url: "/app/chats/room" } },
    waitUntil,
  });
  await Promise.all(pending);
  assert.deepEqual(opened, ["https://school.example/app/chats/room"]);
  handlers.notificationclick({
    notification: {
      close() {},
      data: { url: "https://attacker.example/app/chats/room" },
    },
    waitUntil,
  });
  assert.equal(opened.length, 1);
  handlers.push({
    data: {
      json() {
        throw new Error("malformed");
      },
    },
    waitUntil,
  });
  await Promise.all(pending);
  assert.equal(notifications.length, 2);
});

test("successive chat pushes request another alert and worker updates activate immediately", async () => {
  const handlers: Record<string, (event: unknown) => void> = {};
  const notifications: { tag: string; renotify: boolean; body: string }[] = [];
  let activated = false,
    claimed = false;
  const self = {
    addEventListener: (event: string, handler: (event: unknown) => void) => {
      handlers[event] = handler;
    },
    skipWaiting: async () => {
      activated = true;
    },
    clients: {
      claim: async () => {
        claimed = true;
      },
    },
    registration: {
      showNotification: async (
        _title: string,
        options: (typeof notifications)[number],
      ) => {
        notifications.push(options);
      },
    },
  };
  runInNewContext(readFileSync("public/sw.js", "utf8"), { self, URL });
  const pending: Promise<unknown>[] = [];
  const waitUntil = (promise: Promise<unknown>) => pending.push(promise);
  handlers.install({ waitUntil });
  handlers.activate({ waitUntil });
  for (const body of ["첫 메시지", "두 번째 메시지"])
    handlers.push({
      data: { json: () => ({ title: "학교친구", body, tag: "chat-room" }) },
      waitUntil,
    });
  await Promise.all(pending);
  assert.equal(activated, true);
  assert.equal(claimed, true);
  assert.equal(notifications.length, 2);
  assert.ok(
    notifications.every(
      (notification) =>
        notification.tag === "chat-room" && notification.renotify,
    ),
  );
  assert.equal(notifications[1].body, "두 번째 메시지");
});
