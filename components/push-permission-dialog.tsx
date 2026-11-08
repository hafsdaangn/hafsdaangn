"use client";

import { useEffect, useRef, useState } from "react";
import { Bell, Download } from "lucide-react";
import {
  snooze,
  snoozed,
  iosInstallGuideSeen,
  markIosInstallGuideSeen,
} from "@/lib/push-client";
import { useApp } from "./provider";
import { useInstall } from "./pwa-provider";
import { usePushDevice } from "./push-device-provider";
import { InstallActions } from "./install-guide";
import styles from "./pwa-onboarding.module.css";

type Step = "install" | "push" | "success" | null;

export function PushPermissionDialog({
  eligible = true,
}: {
  eligible?: boolean;
}) {
  const { state } = useApp();
  return state && eligible ? (
    <PermissionPrompt key={state.viewer.id} userId={state.viewer.id} />
  ) : null;
}

function PermissionPrompt({ userId }: { userId: string }) {
  const install = useInstall();
  const push = usePushDevice();
  const dialog = useRef<HTMLDialogElement>(null);
  const ended = useRef(false);
  const [step, setStep] = useState<Step>(null);
  const canPush = push.permission === "default" && push.status === "ready";

  useEffect(() => {
    if (
      step ||
      ended.current ||
      !install.ready ||
      install.inApp ||
      !install.secure
    )
      return;
    const addApp =
      install.mobile &&
      (install.ios || Boolean(install.prompt)) &&
      !install.standalone &&
      !install.installed &&
      (install.ios
        ? !iosInstallGuideSeen(userId)
        : !snoozed(userId, "install"));
    const next = addApp
      ? "install"
      : canPush && !snoozed(userId, "push")
        ? "push"
        : null;
    if (!next) return;
    // Do not interrupt someone already typing while device checks finish.
    if (
      !install.ios &&
      document.activeElement?.matches("input, textarea, [contenteditable=true]")
    )
      return;
    let active = true;
    queueMicrotask(() => {
      if (active) setStep(next);
    });
    return () => {
      active = false;
    };
  }, [step, userId, install, canPush]);

  useEffect(() => {
    if (!step) return;
    const element = dialog.current;
    element?.showModal();
    if (step === "install" && install.ios && element?.open)
      markIosInstallGuideSeen(userId);
    return () => element?.close();
  }, [step, install.ios, userId]);

  function close() {
    if (push.busy) return;
    if (step === "push" || (step === "install" && !install.ios))
      snooze(userId, step);
    ended.current = true;
    dialog.current?.close();
    setStep(null);
  }

  async function connect() {
    if (await push.allow()) setStep("success");
  }

  if (!step) return null;
  const adding = step === "install";
  return (
    <dialog
      ref={dialog}
      className={`push-permission-dialog ${styles.dialog}`}
      aria-labelledby="push-permission-title"
      aria-describedby="push-permission-description"
      onCancel={(event) => {
        event.preventDefault();
        close();
      }}
    >
      {adding ? (
        <Download
          className="push-permission-icon"
          size={28}
          aria-hidden="true"
        />
      ) : (
        <Bell className="push-permission-icon" size={28} aria-hidden="true" />
      )}
      <h2 id="push-permission-title">
        {adding
          ? "합스당근을 홈 화면에서 바로 열어보세요"
          : step === "success"
            ? "알림을 설정했어요"
            : "알림을 설정할까요?"}
      </h2>
      <p id="push-permission-description">
        {adding
          ? "앱으로 추가하면 홈 화면의 아이콘으로 합스당근에 바로 접속할 수 있어요."
          : step === "success"
            ? "알림 설정에 따라 새 채팅과 새 글을 알려드려요."
            : "나눔·분실물의 새 글과 새 채팅 알림을 받기 위해 기기에서 알림을 허용해주세요. 설정은 나중에도 내 정보 → 알림 설정에서 변경할 수 있어요. "}
      </p>
      {adding && <InstallActions dialog onLater={close} onInstalled={close} />}
      {!adding && step !== "success" && (
        <>
          {push.permission === "denied" && (
            <p>
              알림이 차단되어 있어요. 기기 또는 브라우저 설정에서 합스당근의
              알림을 허용해 주세요.
            </p>
          )}
          {push.error && (
            <p className="error-notice" role="alert">
              {push.error}
            </p>
          )}
          {push.status === "loading" && (
            <p role="status">알림 설정을 준비하고 있어요.</p>
          )}
          {push.status === "unconfigured" && (
            <p>
              알림 기능을 준비하고 있어요. 나중에 알림 설정에서 다시 확인해
              주세요.
            </p>
          )}
        </>
      )}
      {!adding && (
        <div className={styles.actions}>
          {step === "success" ? (
            <button type="button" className="button primary" onClick={close}>
              시작하기
            </button>
          ) : (
            <>
              <button
                type="button"
                className="button secondary"
                disabled={push.busy}
                onClick={close}
              >
                나중에
              </button>
              <button
                type="button"
                className="button primary"
                disabled={
                  push.busy ||
                  !(
                    canPush ||
                    (push.permission === "granted" && push.status === "error")
                  )
                }
                onClick={() => void connect()}
              >
                {push.busy
                  ? "설정 중"
                  : push.permission === "granted"
                    ? "다시 시도"
                    : "알림 허용"}
              </button>
            </>
          )}
        </div>
      )}
    </dialog>
  );
}
