"use client";

import { useEffect, useSyncExternalStore, type ReactNode } from "react";
import {
  installSnapshot,
  observeInstall,
  serverInstallSnapshot,
  subscribeInstall,
} from "@/lib/pwa-install";

export function PwaProvider({ children }: { children: ReactNode }) {
  useEffect(observeInstall, []);
  return children;
}

export function useInstall() {
  return useSyncExternalStore(
    subscribeInstall,
    installSnapshot,
    serverInstallSnapshot,
  );
}
