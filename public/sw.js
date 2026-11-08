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
      tag: data?.tag || "chat",
      // Replacing an existing chat notification should alert again.
      renotify: true,
      data: { url: data?.url || "/app/chats" },
    }),
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
