"use client";

import { InstallActions } from "./install-guide";
import { useInstall } from "./pwa-provider";
import styles from "./pwa-onboarding.module.css";

export function InstallEntry() {
  const install = useInstall();
  if (!install.ready || !install.mobile || install.inApp || install.standalone)
    return null;
  return (
    <details className={styles.entry}>
      <summary>홈 화면에 추가하기</summary>
      <InstallActions />
    </details>
  );
}
