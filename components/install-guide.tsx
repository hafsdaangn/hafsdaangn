"use client";

import { useState } from "react";
import { promptInstall } from "@/lib/pwa-install";
import { useInstall } from "./pwa-provider";
import styles from "./pwa-onboarding.module.css";

export function InstallGuide({
  installationOnly = false,
}: {
  installationOnly?: boolean;
}) {
  const { ios } = useInstall();
  return (
    <div className={styles.guide}>
      <ol>
        {ios ? (
          <>
            <li>
              Safari 등 지원 브라우저의 <strong>공유</strong> 메뉴를 열어
              주세요. 메뉴 위치는 브라우저 설정에 따라 달라요.
            </li>
            <li>
              <strong>홈 화면에 추가</strong>를 선택해 주세요. 보이지 않으면
              공유 메뉴의 동작 편집에서 찾아 주세요.
            </li>
            <li>
              <strong>웹 앱으로 열기</strong>가 보이면 켜 둔 채{" "}
              <strong>추가</strong>를 눌러 주세요.
            </li>
            <li>
              홈 화면의 <strong>합스당근 아이콘</strong>으로 다시 열어 주세요.
            </li>
          </>
        ) : (
          <>
            <li>Chrome 등 지원 브라우저의 메뉴를 열어 주세요.</li>
            <li>
              <strong>앱 설치</strong> 또는 <strong>홈 화면에 추가</strong>를
              선택하고 설치를 확인해 주세요.
            </li>
            <li>
              홈 화면의 <strong>합스당근 아이콘</strong>으로 열어 주세요.
            </li>
          </>
        )}
      </ol>
      {ios && !installationOnly && (
        <p>
          iOS·iPadOS 16.4 이상에서 웹 앱으로 열면 채팅 알림을 켤 수 있어요.
          로그인이 필요하면 다시 로그인해 주세요.
        </p>
      )}
    </div>
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
  const [guide, setGuide] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  async function installApp() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const outcome = await promptInstall();
      setNotice(
        outcome === "accepted"
          ? "설치를 수락했어요. 설치가 끝나면 홈 화면 아이콘으로 열어 주세요."
          : "설치하지 않아도 계속 이용할 수 있어요.",
      );
      if (outcome === "accepted") onInstalled?.();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  if (!install.ready) return <p role="status">설치 환경을 확인하고 있어요.</p>;
  if (install.inApp)
    return (
      <p>
        외부 브라우저에서 열어 설치해 주세요. 카카오톡에서는 위의 외부 브라우저
        열기 버튼을 이용할 수 있어요.
      </p>
    );
  if (!install.secure)
    return <p>보안 연결(HTTPS)로 접속한 뒤 설치해 주세요.</p>;
  if (install.standalone || install.installed)
    return (
      <p role="status">
        {install.standalone
          ? "합스당근 웹 앱으로 이용 중이에요."
          : "설치가 완료됐어요. 홈 화면 아이콘으로 열어 주세요."}
      </p>
    );
  if (dialog)
    return (
      <>
        {guide && <InstallGuide installationOnly />}
        {notice && <p role="status">{notice}</p>}
        {error && <p role="alert">{error}</p>}
        <div className={styles.actions}>
          <button
            type="button"
            className="button secondary"
            disabled={busy}
            onClick={onLater}
          >
            나중에
          </button>
          <button
            type="button"
            className="button primary"
            disabled={busy}
            onClick={() => {
              if (install.ios || !install.prompt) setGuide(true);
              else void installApp();
            }}
          >
            앱 설치
          </button>
        </div>
      </>
    );
  return (
    <>
      <div className={styles.actions}>
        {!install.ios && install.prompt && (
          <button
            type="button"
            className="button primary"
            disabled={busy}
            onClick={() => void installApp()}
          >
            {busy ? "설치 확인 중…" : "앱 설치"}
          </button>
        )}
        <button
          type="button"
          className="button secondary"
          aria-expanded={guide}
          onClick={() => setGuide(!guide)}
        >
          {guide ? "방법 접기" : "추가 방법 보기"}
        </button>
      </div>
      {guide && <InstallGuide />}
      {notice && <p role="status">{notice}</p>}
      {error && <p role="alert">{error}</p>}
    </>
  );
}
