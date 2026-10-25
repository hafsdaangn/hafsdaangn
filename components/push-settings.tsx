"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Bell } from "lucide-react";
import { useApp } from "./provider";
import { PageHeading } from "./ui";

type Config = {
  configured: boolean;
  publicKey: string | null;
  subscribed: boolean;
};
async function request<T>(method: string, body?: unknown): Promise<T> {
  const response = await fetch("/api/push", {
    method,
    cache: "no-store",
    headers: { "Content-Type": "application/json" },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const result = await response.json();
  if (!response.ok)
    throw new Error(result.error || "알림 설정을 저장하지 못했어요.");
  return result;
}
function applicationKey(value: string) {
  const raw = atob(
    value.replace(/-/g, "+").replace(/_/g, "/") +
      "=".repeat((4 - (value.length % 4)) % 4),
  );
  return Uint8Array.from(raw, (character) => character.charCodeAt(0));
}

export function PushSettings() {
  const { state, base } = useApp();
  const userId = state?.viewer.id;
  const [config, setConfig] = useState<Config | null>(null);
  const [mode, setMode] = useState("loading");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  useEffect(() => {
    if (!userId) return;
    let active = true;
    async function initialize() {
      const ios =
        /iPad|iPhone|iPod/.test(navigator.userAgent) ||
        (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
      const standalone =
        matchMedia("(display-mode: standalone)").matches ||
        (navigator as Navigator & { standalone?: boolean }).standalone;
      if (ios && !standalone) {
        if (active) setMode("install");
        return;
      }
      if (
        !("serviceWorker" in navigator) ||
        !("PushManager" in window) ||
        !("Notification" in window)
      ) {
        if (active) setMode("unsupported");
        return;
      }
      const settings = await request<Config>("GET");
      if (!active) return;
      setConfig(settings);
      if (!settings.configured) {
        setMode("unconfigured");
        return;
      }
      const registration = await navigator.serviceWorker.register("/sw.js", {
        scope: "/",
        updateViaCache: "none",
      });
      const subscription = await registration.pushManager.getSubscription();
      if (!active) return;
      if (
        Notification.permission === "granted" &&
        subscription &&
        settings.subscribed
      ) {
        // Refresh the subscription and bind it to the currently signed-in member.
        await request("POST", subscription.toJSON());
        if (active) setMode("enabled");
      } else
        setMode(
          Notification.permission === "denied"
            ? "denied"
            : Notification.permission === "granted"
              ? "ready"
              : "off",
        );
    }
    void initialize().catch((e: Error) => {
      if (active) {
        setError(e.message);
        setMode("error");
      }
    });
    return () => {
      active = false;
    };
  }, [userId]);

  async function initializeDevice() {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      // Request permission directly from the user's click for iOS.
      const permission = await Notification.requestPermission();
      setMode(
        permission === "granted"
          ? "ready"
          : permission === "denied"
            ? "denied"
            : "off",
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function toggle() {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      if (mode === "enabled") {
        await request("DELETE");
        setMode("ready");
        const registration = await navigator.serviceWorker.getRegistration("/");
        await (
          await registration?.pushManager.getSubscription()
        )?.unsubscribe();
      } else {
        if (Notification.permission !== "granted") {
          setMode(Notification.permission === "denied" ? "denied" : "off");
          return;
        }
        const registration = await navigator.serviceWorker.ready;
        const subscription =
          (await registration.pushManager.getSubscription()) ||
          (await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: applicationKey(config!.publicKey!),
          }));
        await request("POST", subscription.toJSON());
        setMode("enabled");
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function testNotification() {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const registration = await navigator.serviceWorker.getRegistration("/");
      if (!registration || Notification.permission !== "granted")
        throw new Error("먼저 이 브라우저의 알림을 허용해 주세요.");
      await registration.showNotification("합스당근 알림 테스트", {
        body: "이 알림이 보이면 브라우저의 알림 표시가 동작하고 있어요.",
        icon: "/icons/push-192.png",
        tag: `notification-test-${Date.now()}`,
        data: { url: "/app/chats" },
      });
      setNotice(
        "테스트 알림을 요청했어요. 보이지 않으면 브라우저와 기기의 알림 설정을 확인해 주세요.",
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (!userId) return null;
  const ready = mode === "ready" || mode === "enabled";
  return (
    <section className="notification-page page-width">
      <Link className="notification-back" href={`${base}/me`}>
        <ArrowLeft size={18} />내 정보
      </Link>
      <PageHeading title="알림 설정" />
      <p className="section-subtitle">
        알림 설정은 기기와 브라우저마다 적용돼요.
      </p>
      <div className="push-settings">
        <div className="push-settings-title">
          <Bell size={17} />
          <h2>이 기기에서 알림 받기</h2>
        </div>
        <p>
          {mode === "loading"
            ? "알림 설정을 확인하고 있어요."
            : mode === "install"
              ? "iPhone은 Safari 공유 메뉴에서 ‘홈 화면에 추가’한 뒤, 추가된 아이콘으로 열어 알림을 켜주세요. iOS 16.4 이상에서 사용할 수 있어요."
              : mode === "unsupported"
                ? "이 브라우저에서는 알림을 지원하지 않아요. 최신 Safari 또는 Chrome 브라우저에서 열어주세요."
                : mode === "unconfigured"
                  ? "채팅 알림 기능을 준비하고 있어요."
                  : mode === "denied"
                    ? "알림이 차단되어 있어요. 기기 또는 브라우저 설정에서 이 사이트의 알림을 허용한 뒤 다시 열어주세요."
                    : ready
                      ? "이 기기의 알림 권한이 허용되어 있어요."
                      : mode === "error"
                        ? "알림 설정을 불러오지 못했어요. 다시 확인해 주세요."
                        : "브라우저의 알림 권한을 허용하면 이 기기에서 알림을 받을 수 있어요."}
        </p>
        {mode === "off" && (
          <button
            type="button"
            className="push-toggle"
            disabled={busy}
            onClick={() => void initializeDevice()}
          >
            {busy ? "설정 중…" : "이 기기 알림 허용하기"}
          </button>
        )}
        {mode === "error" && (
          <button
            type="button"
            className="push-toggle"
            onClick={() => window.location.reload()}
          >
            다시 확인
          </button>
        )}
        {ready && (
          <button
            type="button"
            className="push-toggle"
            disabled={busy}
            onClick={() => void testNotification()}
          >
            테스트 알림
          </button>
        )}
      </div>
      <div className="push-settings">
        <div className="notification-setting-row">
          <div>
            <h2 id="chat-notifications-label">채팅 알림</h2>
            <p id="chat-notifications-description">
              {mode === "enabled"
                ? "새 채팅이 오면 이 기기로 알려드려요."
                : ready
                  ? "채팅 알림이 꺼져 있어요."
                  : "먼저 이 기기의 알림 권한을 허용해 주세요."}
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={mode === "enabled"}
            aria-labelledby="chat-notifications-label"
            aria-describedby="chat-notifications-description"
            className="notification-switch"
            disabled={busy || !ready}
            onClick={() => void toggle()}
          >
            <span />
          </button>
        </div>
      </div>
      {notice && <p role="status">{notice}</p>}
      {error && <p role="alert">{error}</p>}
    </section>
  );
}
