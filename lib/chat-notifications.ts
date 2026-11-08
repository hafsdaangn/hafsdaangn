// Notification cleanup is local to this installed app/browser. A failure must
// never block reading a conversation or trigger a permission request.
export async function closeReadChatNotifications(
  conversationId: string,
  readSeq: number,
) {
  if (
    !conversationId ||
    !Number.isSafeInteger(readSeq) ||
    readSeq < 1 ||
    typeof window === "undefined" ||
    !("serviceWorker" in navigator)
  )
    return;
  try {
    const registration = await navigator.serviceWorker.getRegistration("/");
    if (!registration?.getNotifications) return;
    const notifications = await registration.getNotifications();
    for (const notification of notifications) {
      const data = notification.data;
      let sameRoom =
        notification.tag === `chat-${conversationId}` ||
        data?.conversationId === conversationId;
      // Older notifications and browsers without working tag support can be
      // matched using the chat URL that has always been part of the payload.
      if (!sameRoom && typeof data?.url === "string") {
        try {
          const url = new URL(data.url, window.location.origin);
          sameRoom =
            url.origin === window.location.origin &&
            url.pathname === `/app/chats/${conversationId}`;
        } catch {
          /* Ignore an invalid legacy URL. */
        }
      }
      if (!sameRoom || (typeof data?.seq === "number" && data.seq > readSeq))
        continue;
      notification.close();
    }
  } catch {
    /* Notification cleanup is best effort on unsupported platforms. */
  }
}
