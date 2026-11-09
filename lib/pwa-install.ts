import { captureDeviceEventOnce } from "./device-analytics";

export function deviceEnvironment() {
  const ios =
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const standalone =
    matchMedia("(display-mode: standalone)").matches ||
    matchMedia("(display-mode: fullscreen)").matches ||
    Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
  const version = navigator.userAgent.match(/OS (\d+)[_.](\d+)/);
  const oldIOS =
    ios &&
    version &&
    (Number(version[1]) < 16 ||
      (Number(version[1]) === 16 && Number(version[2]) < 4));
  return {
    ios,
    standalone,
    oldIOS: Boolean(oldIOS),
    mobile: ios || /Android/i.test(navigator.userAgent),
    inApp: /KAKAOTALK|Instagram|FBAN|FBAV|; wv\)/i.test(navigator.userAgent),
    secure: window.isSecureContext,
  };
}

export interface InstallPrompt extends Event {
  prompt(): Promise<unknown>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export type InstallState = ReturnType<typeof deviceEnvironment> & {
  ready: boolean;
  prompt: InstallPrompt | null;
  installed: boolean;
};

const initial: InstallState = {
  ios: false,
  standalone: false,
  oldIOS: false,
  mobile: false,
  inApp: false,
  secure: false,
  ready: false,
  prompt: null,
  installed: false,
};
let snapshot = initial;
const listeners = new Set<() => void>();
function update(value: Partial<InstallState>) {
  const next = { ...snapshot, ...value };
  if (
    Object.keys(next).every(
      (key) =>
        next[key as keyof InstallState] === snapshot[key as keyof InstallState],
    )
  )
    return;
  snapshot = next;
  listeners.forEach((listener) => listener());
}
export const installSnapshot = () => snapshot;
export const serverInstallSnapshot = () => initial;
export function subscribeInstall(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

// Attach once in the root, before the authenticated workspace loads.
export function observeInstall() {
  const refresh = () => {
    const environment = deviceEnvironment();
    update({ ...environment, ready: true });
    if (environment.standalone)
      void captureDeviceEventOnce("pwa_first_open", {
        detection_method: "standalone_launch",
        platform: environment.ios ? "ios" : "other",
      });
  };
  const beforeInstall = (event: Event) => {
    event.preventDefault();
    update({ prompt: event as InstallPrompt });
  };
  const installed = () => {
    update({ installed: true, prompt: null });
    void captureDeviceEventOnce("pwa_installed", {
      detection_method: "appinstalled",
    });
  };
  const media = matchMedia("(display-mode: standalone)");
  const fullscreen = matchMedia("(display-mode: fullscreen)");
  window.addEventListener("beforeinstallprompt", beforeInstall);
  window.addEventListener("appinstalled", installed);
  window.addEventListener("focus", refresh);
  window.addEventListener("pageshow", refresh);
  media.addEventListener("change", refresh);
  fullscreen.addEventListener("change", refresh);
  refresh();
  return () => {
    window.removeEventListener("beforeinstallprompt", beforeInstall);
    window.removeEventListener("appinstalled", installed);
    window.removeEventListener("focus", refresh);
    window.removeEventListener("pageshow", refresh);
    media.removeEventListener("change", refresh);
    fullscreen.removeEventListener("change", refresh);
  };
}

export async function promptInstall() {
  const event = snapshot.prompt;
  if (!event)
    throw new Error(
      "설치 메뉴를 준비하지 못했어요. 브라우저 메뉴에서 설치해 주세요.",
    );
  // Consume before invoking: a second click must never reuse this event.
  update({ prompt: null });
  await event.prompt();
  const { outcome } = await event.userChoice;
  return outcome;
}
