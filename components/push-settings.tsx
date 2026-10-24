"use client";

import { useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { useApp } from "./provider";

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
  const { state } = useApp();
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
      if (Notification.permission === "granted" && subscription) {
        // Refresh the subscription and bind it to the currently signed-in member.
        await request("POST", subscription.toJSON());
        if (active) setMode("enabled");
      } else setMode(Notification.permission === "denied" ? "denied" : "off");
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

  async function toggle() {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      if (mode === "enabled") {
        await request("DELETE");
        const registration = await navigator.serviceWorker.getRegistration("/");
        await (
          await registration?.pushManager.getSubscription()
        )?.unsubscribe();
        setMode("off");
      } else {
        // Keep this request directly inside the user's click handler for iOS.
        const permission = await Notification.requestPermission();
        if (permission !== "granted") {
          setMode(permission === "denied" ? "denied" : "off");
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

  if (!userId || mode === "loading") return null;
  return (
    <div className="push-settings">
      <div className="push-settings-title">
        <Bell size={17} />
        <strong>채팅 알림</strong>
      </div>
      <p>
        {mode === "install"
          ? "iPhone은 Safari 공유 메뉴에서 ‘홈 화면에 추가’한 뒤, 추가된 아이콘으로 열어 알림을 켜주세요. iOS 16.4 이상에서 사용할 수 있어요."
          : mode === "unsupported"
            ? "이 브라우저에서는 알림을 지원하지 않아요. 최신 Safari 또는 Chrome에서 열어주세요."
            : mode === "unconfigured"
              ? "채팅 알림 기능을 준비하고 있어요."
              : mode === "denied"
                ? "알림이 차단되어 있어요. 기기 또는 브라우저 설정에서 이 사이트의 알림을 허용한 뒤 다시 열어주세요."
                : mode === "enabled"
                  ? "이 기기로 새 채팅 알림을 받고 있어요."
                  : "사이트를 닫아도 새 채팅이 오면 알려드려요."}
      </p>
      {["off", "enabled"].includes(mode) && (
        <button
          type="button"
          className="push-toggle"
          disabled={busy}
          onClick={() => void toggle()}
        >
          {busy
            ? "설정 중…"
            : mode === "enabled"
              ? "이 기기 알림 끄기"
              : "채팅 알림 받기"}
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
      {mode === "enabled" && (
        <button
          type="button"
          className="push-toggle"
          disabled={busy}
          onClick={() => void testNotification()}
        >
          테스트 알림
        </button>
      )}
      {notice && <p role="status">{notice}</p>}
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
