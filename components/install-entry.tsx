"use client";

import { usePathname } from "next/navigation";
import { useState } from "react";
import { useInstall } from "./pwa-provider";
import { InstallActions, IosInstallDialog } from "./install-guide";
import styles from "./pwa-onboarding.module.css";

export function InstallEntry({ landing = false }: { landing?: boolean }) {
  const pathname = usePathname();
  const install = useInstall();
  const [open, setOpen] = useState(false);
  if (
    (pathname === "/" && !landing) ||
    !install.ready ||
    !install.secure ||
    install.inApp ||
    install.standalone ||
    install.installed ||
    (!install.ios && !install.prompt)
  )
    return null;
  const className = landing ? styles.landingEntry : styles.entry;
  if (install.ios)
    return (
      <>
        <div className={className}>
          <button
            type="button"
            className="button primary"
            onClick={() => setOpen(true)}
          >
            앱 설치
          </button>
        </div>
        {open && <IosInstallDialog onClose={() => setOpen(false)} />}
      </>
    );
  return (
    <div className={className}>
      <InstallActions />
    </div>
  );
}
