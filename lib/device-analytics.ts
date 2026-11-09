import posthog from "posthog-js";

const captured = new Set<string>();

// Browser storage deliberately survives logout/PostHog reset. This is a device
// milestone, not an event to repeat for every account or subscription refresh.
export async function captureDeviceEventOnce(
  event: string,
  properties: Record<string, string | boolean> = {},
) {
  const key = `device-milestone:v1:${event}`;
  const capture = () => {
    if (captured.has(key)) return;
    try {
      if (localStorage.getItem(key)) return;
    } catch {
      // Storage may be blocked; still deduplicate within this document.
    }
    try {
      // Do not mark events when analytics is disabled or not initialized.
      if (!posthog.capture(event, properties)) return;
      captured.add(key);
      try {
        localStorage.setItem(key, "1");
      } catch {
        // Keep the in-memory marker when persistent storage is unavailable.
      }
    } catch {
      // Analytics must never interfere with installing or enabling push.
    }
  };
  try {
    // Serialize the read/capture/write across tabs sharing this origin.
    if (navigator.locks) await navigator.locks.request(key, capture);
    else capture();
  } catch {
    capture();
  }
}
