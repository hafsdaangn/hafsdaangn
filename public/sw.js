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
      icon: "/icons/push-192.png",
      tag: data?.tag || "chat",
      // Replacing an existing chat notification should alert again.
      renotify: true,
      data: { url: data?.url || "/app/chats" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL(
    event.notification.data?.url || "/app/chats",
    self.location.origin,
  );
  if (
    target.origin !== self.location.origin ||
    !target.pathname.startsWith("/app/chats")
  )
    return;
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      for (const client of windows) {
        if (new URL(client.url).origin === target.origin) {
          await client.navigate(target.href);
          return client.focus();
        }
      }
      return self.clients.openWindow(target.href);
    })(),
  );
});
