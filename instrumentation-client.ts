import posthog from "posthog-js";
import * as Sentry from "@sentry/nextjs";
import { sentryOptions } from "./lib/sentry-options";

Sentry.init(sentryOptions);

const projectToken = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;
const host = process.env.NEXT_PUBLIC_POSTHOG_HOST;

if (projectToken && host) {
  posthog.init(projectToken, {
    api_host: host,
    tracing_headers: [window.location.hostname],
    defaults: "2026-01-30",
    capture_exceptions: true,
    session_recording: {
      maskAllInputs: true,
      maskTextSelector: ".ph-mask",
      maskTextFn: (text) => text.replace(/\S/g, "*"),
      // Chat content also travels in API request/response bodies.
      recordBody: false,
    },
  });
} else if (process.env.NODE_ENV === "development") {
  const missingVariable = projectToken
    ? "NEXT_PUBLIC_POSTHOG_HOST"
    : "NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN";

  throw new Error(
    `${missingVariable} variable required by PostHog is missing or un-configured, this causes events to be silently missed. This error stops appearing once ${missingVariable} is configured`,
  );
}

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
