import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { pushEndpoint, subscriptionSchema } from "../lib/push-schema";
import { chatPushContent, postPushContent } from "../lib/push-content";
import {
  defaultPostNotifications,
  matchesPostNotification,
  postNotificationSchema,
} from "../lib/post-notifications";
import type { Message, Post } from "../lib/domain";
import { initializePushDefaults } from "../lib/push-defaults";

test("first push registration enables chat and all new posts without overwriting saved choices", async () => {
  const tables = new Map<string, Map<string, Record<string, unknown>>>();
  let failedTable = "";
  const client = {
    from(table: string) {
      return {
        async upsert(
          input: Record<string, unknown> | Record<string, unknown>[],
          options: { onConflict: string; ignoreDuplicates: boolean },
        ) {
          assert.equal(options.ignoreDuplicates, true);
          if (table === failedTable)
            return { error: { message: "unavailable" } };
          const rows =
            tables.get(table) ?? new Map<string, Record<string, unknown>>();
          tables.set(table, rows);
          for (const row of Array.isArray(input) ? input : [input]) {
            const key = options.onConflict
              .split(",")
              .map((column) => row[column])
              .join(":");
            if (!rows.has(key)) rows.set(key, { ...row });
          }
          return { error: null };
        },
      };
    },
  } as unknown as Parameters<typeof initializePushDefaults>[0];
  await initializePushDefaults(client, "member");
  assert.equal(
    tables.get("chat_notification_settings")!.get("member")!.enabled,
    true,
  );
  const posts = tables.get("post_notification_settings")!;
  assert.equal(posts.get("member:giveaway")!.mode, "all");
  assert.equal(posts.get("member:lost")!.mode, "all");
  tables.get("chat_notification_settings")!.get("member")!.enabled = false;
  posts.get("member:giveaway")!.mode = "off";
  posts.get("member:lost")!.mode = "keywords";
  posts.get("member:lost")!.keywords = ["지갑"];
  await initializePushDefaults(client, "member");
  assert.equal(
    tables.get("chat_notification_settings")!.get("member")!.enabled,
    false,
  );
  assert.equal(posts.get("member:giveaway")!.mode, "off");
  assert.equal(posts.get("member:lost")!.mode, "keywords");
  assert.deepEqual(posts.get("member:lost")!.keywords, ["지갑"]);
  failedTable = "post_notification_settings";
  await assert.rejects(
    initializePushDefaults(client, "new-member"),
    /게시글 알림 기본 설정/,
  );
  failedTable = "";
  await initializePushDefaults(client, "new-member");
  assert.equal(posts.get("new-member:lost")!.mode, "all");
});

test("post subscriptions separate sections and match literal keywords in title or body", () => {
  const post = {
    kind: "giveaway",
    title: "수학 교재 나눔",
    body: "USB 케이블도 있어요.",
  } as Post;
  const setting = {
    section: "giveaway",
    mode: "keywords",
    keywords: ["usb", "지갑"],
  } as const;
  const preference = { ...setting, keywords: [...setting.keywords] };
  assert.equal(matchesPostNotification(post, preference), true);
  assert.equal(
    matchesPostNotification({ ...post, body: "없어요" }, preference),
    false,
  );
  assert.equal(
    matchesPostNotification(post, { ...preference, keywords: ["수학"] }),
    true,
  );
  assert.equal(
    matchesPostNotification(post, { ...preference, keywords: ["%"] }),
    false,
  );
  assert.equal(
    matchesPostNotification(post, {
      ...preference,
      section: "lost",
      mode: "all",
    }),
    false,
  );
  for (const kind of ["lost", "found"] as const)
    assert.equal(
      matchesPostNotification(
        { ...post, kind },
        { section: "lost", mode: "all", keywords: [] },
      ),
      true,
    );
  for (const kind of ["sale", "barter"] as const)
    assert.equal(
      matchesPostNotification(
        { ...post, kind },
        { ...preference, mode: "all" },
      ),
      false,
    );
  assert.equal(
    matchesPostNotification(post, {
      ...preference,
      mode: "all",
      keywords: [],
    }),
    true,
  );
  assert.equal(
    matchesPostNotification(post, { ...preference, keywords: ["수학"] }),
    true,
  );
  for (const defaults of defaultPostNotifications())
    assert.equal(
      matchesPostNotification(post, defaults),
      defaults.section === "giveaway",
    );
  assert.equal(
    matchesPostNotification(post, {
      ...preference,
      mode: "off",
      keywords: ["수학"],
    }),
    false,
  );
  assert.equal(
    matchesPostNotification(post, {
      ...preference,
      mode: "keywords",
      keywords: [],
    }),
    false,
  );
});

test("keyword validation trims, deduplicates and limits saved subscriptions", () => {
  const setting = {
    section: "lost",
    mode: "keywords",
    keywords: [" USB ", "usb", "지갑"],
  };
  assert.deepEqual(postNotificationSchema.parse(setting).keywords, [
    "usb",
    "지갑",
  ]);
  for (const keywords of [
    [" "],
    ["a".repeat(31)],
    Array.from({ length: 21 }, (_, i) => String(i)),
  ])
    assert.equal(
      postNotificationSchema.safeParse({ ...setting, keywords }).success,
      false,
    );
  assert.equal(
    postNotificationSchema.safeParse({ ...setting, section: "sale" }).success,
    false,
  );
  assert.equal(
    postNotificationSchema.safeParse({ ...setting, mode: "invalid" }).success,
    false,
  );
});

test("new post push links to the post with bounded content", () => {
  const post = {
    id: "post",
    kind: "found",
    title: "지갑을 주웠어요",
    body: "🥕".repeat(2000),
  } as Post;
  const content = postPushContent(post, "김민수");
  assert.equal(content.url, "/app/posts/post");
  assert.equal(content.tag, "post-post");
  assert.equal(content.title, "새 분실물 글");
  assert.equal(content.body, "지갑을 주웠어요 · 김민수");
  const giveaway = postPushContent(
    { ...post, kind: "giveaway", title: "수학 교재 나눔" },
    " 이서연 ",
  );
  assert.equal(giveaway.title, "새 나눔 글");
  assert.equal(giveaway.body, "수학 교재 나눔 · 이서연");
  assert.equal(
    postPushContent({ ...post, kind: "lost" }, "김민수").title,
    "새 분실물 글",
  );
  assert.ok(Buffer.byteLength(JSON.stringify(content)) < 4000);
});

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
    conversationId: "room",
    seq: 1,
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
  for (const url of [
    "https://attacker.example/app/chats/room",
    "/app/chats-unrelated",
    "https://[invalid",
  ])
    handlers.notificationclick({
      notification: { close() {}, data: { url } },
      waitUntil,
    });
  assert.equal(opened.length, 1);
  const postUrl = "/app/posts/00000000-0000-4000-8000-000000000001";
  handlers.notificationclick({
    notification: { close() {}, data: { url: postUrl } },
    waitUntil,
  });
  await Promise.all(pending);
  assert.equal(opened.at(-1), `https://school.example${postUrl}`);
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

test("notification clicks activate the app before navigating and recover from stale windows", async (t) => {
  for (const scenario of [
    "existing",
    "focus-rejected",
    "navigate-rejected",
    "navigate-null",
    "no-windows",
    "match-rejected",
    "open-null",
  ]) {
    await t.test(scenario, async () => {
      const calls: string[] = [];
      const target = "https://school.example/app/chats/room";
      let click: (event: unknown) => void = () => {};
      const client = {
        url: "https://school.example/app",
        focus: async () => {
          calls.push("focus");
          if (scenario === "focus-rejected") throw new Error("window closed");
          return client;
        },
        navigate: async (url: string) => {
          assert.equal(url, target);
          calls.push("navigate");
          if (scenario === "navigate-rejected") throw new Error("window gone");
          // Return a different client to model a replaced document on Android.
          return scenario === "navigate-null" ? null : { url: target };
        },
      };
      const self = {
        location: { origin: "https://school.example" },
        addEventListener: (name: string, handler: typeof click) => {
          if (name === "notificationclick") click = handler;
        },
        clients: {
          matchAll: async () => {
            if (scenario === "match-rejected") throw new Error("unavailable");
            return ["no-windows", "open-null"].includes(scenario)
              ? []
              : [client];
          },
          openWindow: async (url: string) => {
            assert.equal(url, target);
            calls.push("open");
            return scenario === "open-null"
              ? null
              : {
                  focus: async () => {
                    calls.push("opened-focus");
                  },
                };
          },
        },
      };
      runInNewContext(readFileSync("public/sw.js", "utf8"), { self, URL });
      const pending: Promise<unknown>[] = [];
      click({
        notification: { close() {}, data: { url: "/app/chats/room" } },
        waitUntil: (task: Promise<unknown>) => pending.push(task),
      });
      await Promise.all(pending);
      const expected =
        scenario === "existing"
          ? ["focus", "navigate"]
          : scenario === "focus-rejected"
            ? ["focus", "open", "opened-focus"]
            : scenario.startsWith("navigate-")
              ? ["focus", "navigate", "open", "opened-focus"]
              : scenario === "open-null"
                ? ["open"]
                : ["open", "opened-focus"];
      assert.deepEqual(calls, expected);
    });
  }
});

test("successive chat pushes request another alert and worker updates activate immediately", async () => {
  const handlers: Record<string, (event: unknown) => void> = {};
  const notifications: {
    tag: string;
    renotify: boolean;
    body: string;
    data?: { conversationId: string; seq: number };
  }[] = [];
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
      data: {
        json: () => ({
          title: "학교친구",
          body,
          tag: "chat-room",
          conversationId: "room",
          seq: body === "첫 메시지" ? 1 : 2,
        }),
      },
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
  assert.equal(notifications[1].data?.conversationId, "room");
  assert.equal(notifications[1].data?.seq, 2);
});

test("worker cleanup respects WebKit lifetime and removes only the read chat's mature notifications", async () => {
  const handlers: Record<string, (event: unknown) => void> = {};
  const closed: string[] = [];
  let now = 100000;
  const replies: { retryAfter: number }[] = [];
  const notification = (
    id: string,
    room: string,
    seq: number,
    shownAt: number,
  ) => ({
    id,
    tag: `chat-${room}`,
    data: { conversationId: room, seq, shownAt },
    close: () => closed.push(id),
  });
  const notifications = [
    notification("mature", "room", 4, 60000),
    notification("young", "room", 5, 99000),
    notification("unread", "room", 6, 60000),
    notification("other", "other", 1, 60000),
  ];
  const self = {
    addEventListener: (type: string, handler: (event: unknown) => void) => {
      handlers[type] = handler;
    },
    location: { origin: "https://app.example" },
    navigator: { userAgent: "iPhone AppleWebKit/605.1.15 Safari/604.1" },
    registration: {
      getNotifications: async () =>
        notifications.filter((n) => !closed.includes(n.id)),
    },
  };
  runInNewContext(readFileSync("public/sw.js", "utf8"), {
    self,
    URL,
    Date: { now: () => now },
  });
  const pending: Promise<unknown>[] = [];
  const message = () =>
    handlers.message({
      data: {
        type: "close-read-chat-notifications",
        conversationId: "room",
        readSeq: 5,
        requestedAt: 100000,
      },
      source: { url: "https://app.example/app/chats/room" },
      ports: [
        { postMessage: (value: { retryAfter: number }) => replies.push(value) },
      ],
      waitUntil: (task: Promise<unknown>) => pending.push(task),
    });
  message();
  await Promise.all(pending);
  assert.deepEqual(closed, ["mature"]);
  assert.equal(replies[0].retryAfter, 31000);
  now += 32000;
  message();
  await Promise.all(pending);
  assert.deepEqual(closed, ["mature", "young"]);
  assert.equal(replies[1].retryAfter, 0);
});
