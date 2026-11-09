"use client";

import * as Sentry from "@sentry/nextjs";
import posthog from "posthog-js";
import { useEffect } from "react";

export default function GlobalError({
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
    <html lang="ko">
      <body>
        <h1>화면을 불러오지 못했어요</h1>
        <p>잠시 후 다시 시도해 주세요.</p>
        <button onClick={retry}>다시 시도</button>
      </body>
    </html>
  );
}
