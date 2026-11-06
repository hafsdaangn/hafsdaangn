export type PushConfig = {
  configured: boolean;
  publicKey: string | null;
  subscribed: boolean;
};
export type PreparedPush = {
  registration: ServiceWorkerRegistration;
  subscription: PushSubscription | null;
  config: PushConfig;
  key: Uint8Array<ArrayBuffer> | null;
};

export async function pushRequest<T>(
  method: string,
  body?: unknown,
): Promise<T> {
  const response = await fetch("/api/push", {
    method,
    cache: "no-store",
    signal: AbortSignal.timeout(15000),
    headers: { "Content-Type": "application/json" },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const result = await response.json();
  if (!response.ok)
    throw new Error(result.error || "알림 설정을 저장하지 못했어요.");
  return result;
}

function applicationKey(value: string) {
  const raw = atob(
    value.replace(/-/g, "+").replace(/_/g, "/") +
      "=".repeat((4 - (value.length % 4)) % 4),
  );
  return Uint8Array.from(raw, (character) => character.charCodeAt(0));
}

export async function withTimeout<T>(task: Promise<T>, ms = 15000): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      task,
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () =>
            reject(
              new Error("알림 준비 시간이 오래 걸려요. 다시 확인해 주세요."),
            ),
          ms,
        );
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

export async function preparePush(): Promise<PreparedPush> {
  const [config, registration] = await withTimeout(
    Promise.all([
      pushRequest<PushConfig>("GET"),
      navigator.serviceWorker
        .register("/sw.js", { scope: "/", updateViaCache: "none" })
        .then(() => navigator.serviceWorker.ready),
    ]),
  );
  const subscription = await withTimeout(
    registration.pushManager.getSubscription(),
  );
  return {
    config,
    registration,
    subscription,
    key: config.publicKey ? applicationKey(config.publicKey) : null,
  };
}

// Call directly in a click handler. SW and VAPID are prepared before the click.
// No network/storage await may precede the browser's subscribe() call.
export async function connectPush(
  prepared: PreparedPush,
): Promise<PushSubscription> {
  if (!prepared.config.configured || !prepared.key)
    throw new Error("알림 기능을 준비하고 있어요.");
  const subscription =
    prepared.subscription ||
    (await prepared.registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: prepared.key,
    }));
  // Retain a created subscription even if the subsequent server save fails.
  prepared.subscription = subscription;
  await pushRequest("POST", subscription.toJSON());
  return subscription;
}

const memory = new Map<string, string>();
export function readPushChoice(key: string) {
  try {
    return memory.get(key) ?? localStorage.getItem(key);
  } catch {
    return memory.get(key) ?? null;
  }
}
export function writePushChoice(key: string, value: string) {
  memory.set(key, value);
  try {
    localStorage.setItem(key, value);
  } catch {
    /* Retain this visit's choice. */
  }
}
export const snoozeKey = (userId: string, stage: "install" | "push") =>
  `push-onboarding:v2:${userId}:${stage}`;
export function snoozed(
  userId: string,
  stage: "install" | "push",
  now = Date.now(),
) {
  return Number(readPushChoice(snoozeKey(userId, stage))) > now;
}
export function snooze(userId: string, stage: "install" | "push") {
  writePushChoice(snoozeKey(userId, stage), String(Date.now() + 7 * 86400000));
}
