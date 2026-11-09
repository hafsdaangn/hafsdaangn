import { SeverityNumber } from "@opentelemetry/api-logs";
import { OTLPLogExporter } from "@opentelemetry/exporter-logs-otlp-http";
import { resourceFromAttributes } from "@opentelemetry/resources";
import {
  BatchLogRecordProcessor,
  LoggerProvider,
} from "@opentelemetry/sdk-logs";

const projectToken = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;
const host = process.env.NEXT_PUBLIC_POSTHOG_HOST;
const posthogLogsConfigured = Boolean(projectToken && host);

if (!posthogLogsConfigured && process.env.NODE_ENV !== "production") {
  const missing = !projectToken
    ? "NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN"
    : "NEXT_PUBLIC_POSTHOG_HOST";
  console.warn(
    `${missing} variable required by PostHog is missing or un-configured, this causes events to be silently missed. This error stops appearing once ${missing} is configured`,
  );
}

export const posthogLoggerProvider = posthogLogsConfigured
  ? new LoggerProvider({
      resource: resourceFromAttributes({ "service.name": "hafsdaangn" }),
      processors: [
        new BatchLogRecordProcessor({
          exporter: new OTLPLogExporter({
            url: `${host!.replace(/\/$/, "")}/i/v1/logs`,
            timeoutMillis: 2000,
            headers: {
              Authorization: `Bearer ${projectToken!}`,
              "Content-Type": "application/json",
            },
          }),
        }),
      ],
    })
  : null;

export const posthogLogger =
  posthogLoggerProvider?.getLogger("hafsdaangn.posthog");

export function emitPostHogLog(
  body: string,
  attributes: Record<string, string>,
) {
  posthogLogger?.emit({
    body,
    severityNumber: SeverityNumber.INFO,
    attributes,
  });
}

export function flushPostHogLogs() {
  return (
    posthogLoggerProvider?.forceFlush().catch(() => {}) ?? Promise.resolve()
  );
}

export async function register() {
  if (
    process.env.NEXT_RUNTIME === "nodejs" &&
    process.env.NEXT_PHASE !== "phase-production-build"
  ) {
    const { appEnvironment } = await import("./lib/environment");
    appEnvironment();
    const { configured } = await import("./lib/supabase/server");
    if (configured()) {
      const { ensureAuthPolicy } = await import("./lib/auth-policy");
      try {
        await ensureAuthPolicy();
      } catch (error) {
        // Login and member requests retry and remain blocked until policy sync succeeds.
        console.error(
          "[auth-policy]",
          error instanceof Error ? error.message : "로그인 정책 동기화 실패",
        );
      }
    }
  }
}
