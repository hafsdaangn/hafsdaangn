"use client";

import type { ReactNode } from "react";
import { useInstall } from "./pwa-provider";

export function LandingLogin({
  ready,
  children,
}: {
  ready: boolean;
  children: ReactNode;
}) {
  const install = useInstall();
  return (
    <a
      className={`button google-button ${install.standalone ? "primary" : "secondary"} ${!ready ? "not-ready" : ""}`}
      href="/auth/login"
    >
      {children}
    </a>
  );
}
