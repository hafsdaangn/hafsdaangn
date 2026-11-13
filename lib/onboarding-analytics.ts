import { captureUserEventOnce } from "./device-analytics";

export type OnboardingProgress = {
  platform: "ios" | "android" | "other";
  standalone: boolean;
  installed: boolean;
  permission: string;
  connected: boolean;
  inApp: boolean;
  secure: boolean;
};

// Separate user milestones from legacy device events. A shared browser must
// not suppress another account, and standalone sessions can have new storage.
// PostHog funnels should count unique identified users, never raw event totals.
export async function captureOnboardingProgress(
  userId: string,
  progress: OnboardingProgress,
) {
  const installed = progress.installed || progress.standalone;
  const properties = {
    platform: progress.platform,
    display_mode: progress.standalone ? "standalone" : "browser",
    in_app_browser: progress.inApp,
    secure_context: progress.secure,
    measurement_version: 1,
  };
  const started = await captureUserEventOnce(userId, "onboarding_started", {
    ...properties,
    installed_at_start: installed,
    permission_at_start: progress.permission,
    connected_at_start: progress.connected,
  });
  if (!started) return;
  if (installed) {
    await captureUserEventOnce(userId, "pwa_install_completed", {
      ...properties,
      detection_method: progress.standalone
        ? "standalone_launch"
        : "appinstalled",
      $set_once: { has_installed_pwa: true },
    });
  }
  if (progress.permission === "granted") {
    await captureUserEventOnce(userId, "push_permission_granted", properties);
    if (progress.connected) {
      await captureUserEventOnce(userId, "push_setup_completed", {
        ...properties,
        $set_once: { has_enabled_push: true },
      });
    }
  }
}
