import { PostHog } from "posthog-node";

let client: PostHog | null | undefined;
let warnedAboutMissingConfig = false;

function getPostHogClient() {
  if (client !== undefined) return client;

  const projectToken = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;
  const host = process.env.NEXT_PUBLIC_POSTHOG_HOST;
  if (!projectToken || !host) {
    client = null;
    if (!warnedAboutMissingConfig && process.env.NODE_ENV !== "production") {
      warnedAboutMissingConfig = true;
      const missing = !projectToken
        ? "NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN"
        : "NEXT_PUBLIC_POSTHOG_HOST";
      console.warn(
        `${missing} variable required by PostHog is missing or un-configured, this causes events to be silently missed. This error stops appearing once ${missing} is configured`,
      );
    }
    return client;
  }

  client = new PostHog(projectToken, {
    host,
    enableExceptionAutocapture: true,
    flushAt: 1,
    flushInterval: 0,
    requestTimeout: 2000,
    fetchRetryCount: 0,
  });
  return client;
}

export async function captureServerEvent({
  request,
  distinctId,
  event,
  properties,
}: {
  request: Request;
  distinctId: string;
  event: string;
  properties?: Record<string, boolean | number | string>;
}) {
  try {
    const posthog = getPostHogClient();
    if (!posthog) return;
    const sessionId = request.headers.get("x-posthog-session-id");
    posthog.capture({
      distinctId,
      event,
      properties: {
        ...properties,
        ...(sessionId ? { $session_id: sessionId } : {}),
      },
    });
    await posthog.flush().catch(() => {});
  } catch {
    // Analytics must not interrupt the completed application action.
  }
}
