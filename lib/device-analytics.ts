import posthog from "posthog-js";

const captured = new Set<string>();

// Browser storage deliberately survives logout/PostHog reset. This is a device
// milestone, not an event to repeat for every account or subscription refresh.
export async function captureDeviceEventOnce(
  event: string,
  properties: Record<string, unknown> = {},
) {
  return captureMilestone(`device-milestone:v1:${event}`, event, properties);
}

export const analyticsIdentityChanged = "analytics-identity-changed";

export async function captureUserEventOnce(
  userId: string,
  event: string,
  properties: Record<string, unknown> = {},
) {
  return captureMilestone(
    `user-milestone:v1:${userId}:${event}`,
    event,
    properties,
    userId,
  );
}

async function captureMilestone(
  key: string,
  event: string,
  properties: Record<string, unknown>,
  userId?: string,
) {
  const capture = () => {
    // A child effect can run before the parent's identify(). Also recheck after
    // acquiring the cross-tab lock so an account switch cannot misattribute it.
    try {
      if (userId && posthog.get_distinct_id() !== userId) return false;
    } catch {
      return false;
    }
    if (captured.has(key)) return true;
    try {
      if (localStorage.getItem(key)) return true;
    } catch {
      // Storage may be blocked; still deduplicate within this document.
    }
    try {
      // Do not mark events when analytics is disabled or not initialized.
      if (!posthog.capture(event, properties)) return false;
      captured.add(key);
      try {
        localStorage.setItem(key, "1");
      } catch {
        // Keep the in-memory marker when persistent storage is unavailable.
      }
      return true;
    } catch {
      // Analytics must never interfere with installing or enabling push.
      return false;
    }
  };
  try {
    // Serialize the read/capture/write across tabs sharing this origin.
    if (navigator.locks) return await navigator.locks.request(key, capture);
    return capture();
  } catch {
    return capture();
  }
}
