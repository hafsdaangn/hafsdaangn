"use client";

import { useEffect, useState } from "react";
import styles from "./notification-settings.module.css";

export function ChatNotificationSettings() {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  async function request(method: string, value?: boolean) {
    const response = await fetch("/api/push/chat", {
      method,
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      ...(value === undefined
        ? {}
        : { body: JSON.stringify({ enabled: value }) }),
    });
    const data = await response.json();
    if (!response.ok)
      throw new Error(data.error || "채팅 알림 설정을 저장하지 못했어요.");
    return data.enabled as boolean;
  }
  useEffect(() => {
    let active = true;
    void request("GET")
      .then((value) => {
        if (active) {
          setEnabled(value);
          setError("");
        }
      })
      .catch((e: Error) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [revision]);
  async function toggle() {
    if (busy || enabled === null) return;
    setBusy(true);
    setError("");
    try {
      const next = await request("PUT", !enabled);
      setEnabled(next);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section
      className={`push-settings ${styles.card}`}
      aria-labelledby="chat-setting-title"
    >
      <div className="notification-setting-row">
        <div>
          <h2 id="chat-setting-title">채팅 알림</h2>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={enabled === true}
          aria-labelledby="chat-setting-title"
          aria-describedby="chat-setting-description"
          className="notification-switch"
          disabled={enabled === null || busy}
          onClick={() => void toggle()}
        >
          <span />
        </button>
      </div>
      {enabled === null && !error && (
        <p className={styles.hint} role="status">
          설정을 불러오고 있어요.
        </p>
      )}
      {error && (
        <div className={styles.feedback} role="alert">
          <p>{error}</p>
          {enabled === null && (
            <button
              type="button"
              className="button secondary"
              onClick={() => setRevision((value) => value + 1)}
            >
              다시 불러오기
            </button>
          )}
        </div>
      )}
    </section>
  );
}
