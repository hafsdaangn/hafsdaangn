"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import { kakaoExternalBrowserUrl } from "@/lib/external-browser";
import styles from "./external-browser.module.css";

function subscribe(onChange: () => void) {
  window.addEventListener("popstate", onChange);
  window.addEventListener("hashchange", onChange);
  return () => {
    window.removeEventListener("popstate", onChange);
    window.removeEventListener("hashchange", onChange);
  };
}

function browserSnapshot() {
  return kakaoExternalBrowserUrl(navigator.userAgent, window.location.href);
}

function serverSnapshot() {
  return null;
}

export function ExternalBrowser() {
  // Recheck the current address after client-side route changes as well.
  usePathname();
  const href = useSyncExternalStore(subscribe, browserSnapshot, serverSnapshot);
  const attempted = useRef(false);

  useEffect(() => {
    if (!href || attempted.current) return;
    attempted.current = true;
    try {
      window.location.assign(href);
    } catch {
      // A native app can reject automatic launches. Keep the manual link visible.
    }
  }, [href]);

  if (!href) return null;

  return (
    <aside className={styles.notice} aria-label="외부 브라우저 안내">
      <p>
        카카오톡 내부 브라우저에서는 로그인과 알림이 제한될 수 있어요.
        외부 브라우저에서 이용해 주세요.
      </p>
      <a className="button primary" href={href}>
        외부 브라우저로 열기
      </a>
      <p className={styles.hint}>
        자동으로 열리지 않으면 버튼을 눌러 주세요. 그래도 열리지 않으면 카카오톡
        메뉴에서 ‘다른 브라우저로 열기’를 선택하거나 주소를 복사해 브라우저에서
        열어 주세요.
      </p>
    </aside>
  );
}
