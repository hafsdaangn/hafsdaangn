type CleanupResult = { type: "chat-notifications-closed"; retryAfter: number };
type CleanupJob = {
  readSeq: number;
  requestedAt: number;
  attempts: number;
  timer?: ReturnType<typeof setTimeout>;
};
const jobs = new Map<string, CleanupJob>();
const minimumWebKitAge = 32000;

function isWebKit() {
  return (
    /AppleWebKit/.test(navigator.userAgent) &&
    !/Chrome|Chromium|Edg|OPR|Android/.test(navigator.userAgent)
  );
}

function askWorker(
  worker: ServiceWorker,
  conversationId: string,
  job: CleanupJob,
): Promise<CleanupResult | null> {
  if (typeof MessageChannel === "undefined") return Promise.resolve(null);
  return new Promise((resolve) => {
    const channel = new MessageChannel();
    const finish = (result: CleanupResult | null) => {
      clearTimeout(timer);
      channel.port1.close();
      channel.port2.close();
      resolve(result);
    };
    const timer = setTimeout(() => finish(null), 1500);
    channel.port1.onmessage = (event) => {
      if (
        event.data?.type === "chat-notifications-closed" &&
        Number.isFinite(event.data.retryAfter)
      )
        finish(event.data);
    };
    try {
      worker.postMessage(
        {
          type: "close-read-chat-notifications",
          conversationId,
          readSeq: job.readSeq,
          requestedAt: job.requestedAt,
        },
        [channel.port2],
      );
    } catch {
      finish(null);
    }
  });
}

async function closeFromPage(
  registration: ServiceWorkerRegistration,
  conversationId: string,
  job: CleanupJob,
) {
  if (!registration.getNotifications) return 0;
  let retryAfter = 0;
  const now = Date.now();
  for (const notification of await registration.getNotifications()) {
    const data = notification.data;
    let sameRoom =
      notification.tag === `chat-${conversationId}` ||
      data?.conversationId === conversationId;
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
    if (!sameRoom || (typeof data?.seq === "number" && data.seq > job.readSeq))
      continue;
    const timestamp =
      (notification as Notification & { timestamp?: number }).timestamp ?? 0;
    const shownAt = Number.isFinite(data?.shownAt)
      ? data.shownAt
      : timestamp > 0
        ? timestamp
        : job.requestedAt;
    const wait = isWebKit() ? Math.max(0, shownAt + minimumWebKitAge - now) : 0;
    if (wait) retryAfter = retryAfter ? Math.min(retryAfter, wait) : wait;
    else notification.close();
  }
  return retryAfter;
}

async function attempt(conversationId: string, job: CleanupJob): Promise<void> {
  job.attempts++;
  const readSeq = job.readSeq;
  try {
    const registration = await navigator.serviceWorker.getRegistration("/");
    if (!registration) {
      jobs.delete(conversationId);
      return;
    }
    // Prefer the worker that created these persistent notifications. An older
    // worker without this message handler falls back to the page implementation.
    const result = registration.active
      ? await askWorker(registration.active, conversationId, job)
      : null;
    const retryAfter = result
      ? result.retryAfter
      : await closeFromPage(registration, conversationId, job);
    if (!retryAfter && job.readSeq > readSeq && job.attempts < 5)
      return attempt(conversationId, job);
    if (retryAfter > 0 && job.attempts < 5) {
      job.timer = setTimeout(
        () => {
          job.timer = undefined;
          void attempt(conversationId, job);
        },
        Math.min(retryAfter + 200, 33000),
      );
      return;
    }
  } catch {
    /* Cleanup must not block reading or request notification permission. */
  }
  jobs.delete(conversationId);
}

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
  const existing = jobs.get(conversationId);
  if (existing) {
    existing.readSeq = Math.max(existing.readSeq, readSeq);
    return;
  }
  const job: CleanupJob = { readSeq, requestedAt: Date.now(), attempts: 0 };
  jobs.set(conversationId, job);
  await attempt(conversationId, job);
}
