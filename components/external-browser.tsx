"use client";

import { type ReactNode, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import { kakaoExternalBrowserUrl } from "@/lib/external-browser";
import { Brand } from "./brand";
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

export function ExternalBrowser({ children }: { children: ReactNode }) {
  // Recheck the current address after client-side route changes as well.
  usePathname();
  const href = useSyncExternalStore(subscribe, browserSnapshot, serverSnapshot);
  if (!href) return children;

  return (
    <div className="landing">
      <main className="landing-main">
        <div className="landing-copy">
          <h1>
            <Brand full />
          </h1>
          <aside className={styles.notice} aria-label="외부 브라우저 안내">
            <p>
              카카오톡 내부 브라우저에서는 기능이 제한돼요. 외부 브라우저에서
              이용해 주세요.
            </p>
            <a className="button primary" href={href}>
              외부 브라우저로 열기
            </a>
          </aside>
        </div>
      </main>
    </div>
  );
}
