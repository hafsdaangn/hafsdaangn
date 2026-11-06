import { deviceEnvironment } from "./pwa-install";

export const permissionChange = "push-permission-change";

export function devicePermission() {
  const { ios, standalone, oldIOS, secure, inApp } = deviceEnvironment();
  if (inApp) return "in-app";
  if (!secure) return "insecure";
  if (oldIOS) return "old-ios";
  if (ios && !standalone) return "install";
  if (
    !("serviceWorker" in navigator) ||
    !("PushManager" in window) ||
    !("Notification" in window)
  )
    return "unsupported";
  return Notification.permission;
}

export function subscribePermission(onChange: () => void) {
  let active = true;
  let status: PermissionStatus | undefined;
  window.addEventListener("focus", onChange);
  window.addEventListener(permissionChange, onChange);
  document.addEventListener("visibilitychange", onChange);
  const media = matchMedia("(display-mode: standalone)");
  const fullscreen = matchMedia("(display-mode: fullscreen)");
  media.addEventListener("change", onChange);
  fullscreen.addEventListener("change", onChange);
  // Permissions API support varies, so focus/visibility remain the fallback.
  if (navigator.permissions) {
    void navigator.permissions.query({ name: "notifications" }).then(
      (permission) => {
        if (!active) return;
        status = permission;
        status.addEventListener("change", onChange);
        onChange();
      },
      () => {},
    );
  }
  return () => {
    active = false;
    status?.removeEventListener("change", onChange);
    window.removeEventListener("focus", onChange);
    window.removeEventListener(permissionChange, onChange);
    document.removeEventListener("visibilitychange", onChange);
    media.removeEventListener("change", onChange);
    fullscreen.removeEventListener("change", onChange);
  };
}

export function serverPermission() {
  return "loading" as const;
}
