"use client";
import * as Sentry from "@sentry/nextjs";
import posthog from "posthog-js";
import { useEffect } from "react";

export default function ErrorPage({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
    posthog.captureException(error);
  }, [error]);

  return (
    <div className="loading-page">
      <h1>화면을 불러오지 못했어요</h1>
      <p>잠시 후 다시 시도해 주세요.</p>
      <button className="button primary" onClick={retry}>
        다시 시도
      </button>
    </div>
  );
}
