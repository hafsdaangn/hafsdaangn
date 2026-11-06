"use client";

import Link from "next/link";
import { ArrowLeft, Bell } from "lucide-react";
import { useApp } from "./provider";
import { PageHeading } from "./ui";
import { usePushDevice } from "./push-device-provider";
import { PostNotificationSettings } from "./post-notification-settings";
import { ChatNotificationSettings } from "./chat-notification-settings";
import styles from "./notification-settings.module.css";

export function PushSettings() {
  const { state, base } = useApp();
  const push = usePushDevice();
  if (!state) return null;
  const granted = push.permission === "granted";
  const checking = push.permission === "loading" || push.status === "loading";
  const message =
    push.permission === "install"
      ? "홈 화면에 추가한 합스당근 아이콘으로 열어 알림을 허용해 주세요. iOS·iPadOS 16.4 이상이 필요해요."
      : push.permission === "in-app"
        ? "인앱 브라우저에서는 알림을 설정하지 않아요. 외부 브라우저로 열어 주세요."
        : push.permission === "insecure"
          ? "알림을 사용하려면 보안 연결(HTTPS)로 접속해 주세요."
          : push.permission === "old-ios"
            ? "iOS·iPadOS 16.4 이상으로 업데이트하면 웹 푸시 알림을 사용할 수 있어요."
            : push.permission === "unsupported"
              ? "이 브라우저는 웹 푸시 알림을 지원하지 않아요. 지원하는 최신 브라우저에서 열어 주세요."
              : push.permission === "denied"
                ? "알림이 차단되어 있어요. 기기 또는 브라우저 설정에서 합스당근의 알림을 허용해 주세요."
                : checking
                  ? "브라우저의 알림 허용 상태를 확인하고 있어요."
                  : push.status === "unconfigured"
                    ? "알림 기능을 준비하고 있어요."
                    : granted
                      ? "이 기기에서 알림이 허용되어 있어요."
                      : "알림을 허용하면 새 채팅과 구독한 새 글을 알려드려요.";
  return (
    <section className="notification-page page-width">
      <Link className="notification-back" href={`${base}/me`}>
        <ArrowLeft size={18} />내 정보
      </Link>
      <PageHeading title="알림 설정" />
      <div className={styles.stack}>
        <section
          className={`push-settings ${styles.card}`}
          aria-labelledby="notification-permission-title"
        >
          <div className={styles.heading}>
            <div className="push-settings-title">
              <Bell size={18} aria-hidden="true" />
              <h2 id="notification-permission-title">알림 허용</h2>
            </div>
          </div>
          <p>{message}</p>
          {push.error && (
            <div className={styles.feedback} role="alert">
              <p>{push.error}</p>
              <button
                type="button"
                className="button secondary"
                disabled={push.busy}
                onClick={() => void push.allow()}
              >
                다시 시도
              </button>
            </div>
          )}
          {push.permission === "default" && push.status === "ready" && (
            <div className={styles.actions}>
              <button
                type="button"
                className="button primary"
                disabled={push.busy}
                onClick={() => void push.allow()}
              >
                {push.busy ? "설정 중" : "알림 허용"}
              </button>
            </div>
          )}
        </section>
        <ChatNotificationSettings key={`chat-${state.viewer.id}`} />
        <PostNotificationSettings key={state.viewer.id} />
      </div>
    </section>
  );
}
