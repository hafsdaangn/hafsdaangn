"use client";

import { useEffect, useRef, useState } from "react";
import { promptInstall } from "@/lib/pwa-install";
import { useInstall } from "./pwa-provider";
import styles from "./pwa-onboarding.module.css";

export function IosInstallDialog({ onClose }: { onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className={`push-permission-dialog ${styles.dialog}`}
      aria-labelledby="ios-install-title"
      aria-describedby="ios-install-description"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <h2 id="ios-install-title">합스당근을 홈 화면에서 바로 열어보세요</h2>
      <p id="ios-install-description">
        iPhone·iPad에서는 합스당근을 홈 화면에 추가한 뒤, 설치한 앱으로 접속해야
        알림을 허용할 수 있어요.
      </p>
      <InstallActions dialog onLater={onClose} />
    </dialog>
  );
}

export function InstallActions({
  dialog = false,
  onLater,
  onInstalled,
}: {
  dialog?: boolean;
  onLater?: () => void;
  onInstalled?: () => void;
} = {}) {
  const install = useInstall();
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  async function installApp() {
    if (busy || !install.prompt) return;
    setBusy(true);
    setError("");
    try {
      const outcome = await promptInstall();
      setNotice(
        outcome === "accepted"
          ? "설치를 수락했어요."
          : "설치하지 않아도 계속 이용할 수 있어요.",
      );
      onInstalled?.();
    } catch {
      setError("설치를 시작하지 못했어요. 잠시 후 다시 시도해 주세요.");
    } finally {
      setBusy(false);
    }
  }
  if (
    !install.ready ||
    install.inApp ||
    !install.secure ||
    install.standalone ||
    install.installed ||
    (!install.ios && !install.prompt && !busy && !notice && !error)
  )
    return null;
  if (install.ios) {
    return (
      <div className={styles.guide}>
        <ol>
          <li>
            Safari에서 이 페이지를 열고 <strong>공유</strong> 버튼을 눌러주세요.
          </li>
          <li>
            열린 메뉴에서 <strong>홈 화면에 추가</strong>를 선택해주세요.
          </li>
          <li>
            홈 화면의 <strong>합스당근 아이콘</strong>으로 다시 열어주세요.
          </li>
        </ol>
        {dialog && (
          <div className={styles.actions}>
            <button type="button" className="button primary" onClick={onLater}>
              확인
            </button>
          </div>
        )}
      </div>
    );
  }
  return (
    <>
      {notice && <p role="status">{notice}</p>}
      {error && <p role="alert">{error}</p>}
      <div className={styles.actions}>
        {dialog && (
          <button
            type="button"
            className="button secondary"
            disabled={busy}
            onClick={onLater}
          >
            나중에
          </button>
        )}
        <button
          type="button"
          className="button primary"
          disabled={busy || !install.prompt}
          onClick={() => void installApp()}
        >
          앱 설치
        </button>
      </div>
    </>
  );
}
