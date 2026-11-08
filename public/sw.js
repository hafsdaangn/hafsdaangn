self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let data;
  try {
    data = event.data?.json();
  } catch {
    /* Show a safe fallback. */
  }
  event.waitUntil(
    self.registration.showNotification(data?.title || "합스당근", {
      body: data?.body || "새 채팅 메시지가 도착했어요.",
      badge: "/icons/notification-badge.png",
      // An explicit transparent large icon avoids Android's fallback avatar.
      ...(/Android/i.test(self.navigator?.userAgent || "")
        ? { icon: "/icons/notification-transparent.png" }
        : {}),
      tag: data?.tag || "chat",
      // Replacing an existing chat notification should alert again.
      renotify: true,
      data: {
        url: data?.url || "/app/chats",
        conversationId: data?.conversationId,
        seq: data?.seq,
        shownAt: Date.now(),
      },
    }),
  );
});

self.addEventListener("message", (event) => {
  const request = event.data;
  if (
    request?.type !== "close-read-chat-notifications" ||
    typeof request.conversationId !== "string" ||
    !Number.isSafeInteger(request.readSeq) ||
    request.readSeq < 1
  )
    return;
  try {
    if (
      !event.source?.url ||
      new URL(event.source.url).origin !== self.location.origin
    )
      return;
  } catch {
    return;
  }
  event.waitUntil(
    (async () => {
      let retryAfter = 0;
      try {
        const now = Date.now();
        const userAgent = self.navigator?.userAgent || "";
        const webkit =
          /AppleWebKit/.test(userAgent) &&
          !/Chrome|Chromium|Edg|OPR|Android/.test(userAgent);
        for (const notification of await self.registration.getNotifications()) {
          const data = notification.data;
          let sameRoom =
            notification.tag === `chat-${request.conversationId}` ||
            data?.conversationId === request.conversationId;
          if (!sameRoom && typeof data?.url === "string") {
            try {
              const url = new URL(data.url, self.location.origin);
              sameRoom =
                url.origin === self.location.origin &&
                url.pathname === `/app/chats/${request.conversationId}`;
            } catch {
              /* Ignore invalid legacy URLs. */
            }
          }
          if (
            !sameRoom ||
            (typeof data?.seq === "number" && data.seq > request.readSeq)
          )
            continue;
          const shownAt = Number.isFinite(data?.shownAt)
            ? data.shownAt
            : notification.timestamp > 0
              ? notification.timestamp
              : request.requestedAt || now;
          // WebKit refuses early close() calls. Respect the minimum visible
          // lifetime instead of treating a no-op as successful deletion.
          const wait = webkit ? Math.max(0, shownAt + 32000 - now) : 0;
          if (wait) retryAfter = retryAfter ? Math.min(retryAfter, wait) : wait;
          else notification.close();
        }
      } catch {
        retryAfter = 1000;
      }
      event.ports?.[0]?.postMessage({
        type: "chat-notifications-closed",
        retryAfter,
      });
    })(),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  let target;
  try {
    target = new URL(
      event.notification.data?.url || "/app/chats",
      self.location.origin,
    );
  } catch {
    return;
  }
  if (
    target.origin !== self.location.origin ||
    (target.pathname !== "/app/chats" &&
      !target.pathname.startsWith("/app/chats/") &&
      !/^\/app\/posts\/[0-9a-f-]{36}$/.test(target.pathname))
  )
    return;
  event.waitUntil(
    (async () => {
      const windows = await self.clients
        .matchAll({ type: "window", includeUncontrolled: true })
        .catch(() => []);
      for (const client of windows) {
        try {
          if (new URL(client.url).origin !== target.origin) continue;
          // Bring the app forward before navigating: navigation can replace
          // the document and invalidate the old WindowClient on mobile.
          await client.focus();
          const navigated = await client.navigate(target.href);
          if (navigated) return;
        } catch {
          // A suspended/closed window must not prevent opening the chat.
        }
      }
      const opened = await self.clients.openWindow(target.href);
      if (opened) await opened.focus();
    })(),
  );
});
