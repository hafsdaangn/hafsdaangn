"use client";

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import {
  devicePermission,
  permissionChange,
  serverPermission,
  subscribePermission,
} from "@/lib/push-permission";
import {
  connectPush,
  preparePush,
  PushSetupError,
  type PreparedPush,
} from "@/lib/push-client";

type Status = "loading" | "ready" | "connected" | "unconfigured" | "error";
type Model = {
  permission: ReturnType<typeof devicePermission> | "loading";
  status: Status;
  busy: boolean;
  error: string;
  allow: () => Promise<boolean>;
  refresh: () => void;
};
const Context = createContext<Model | null>(null);
export function usePushDevice() {
  const value = useContext(Context);
  if (!value) throw new Error("알림 설정을 불러오지 못했어요.");
  return value;
}

export function PushDeviceProvider({
  userId,
  children,
}: {
  userId?: string;
  children: ReactNode;
}) {
  const permission = useSyncExternalStore(
    subscribePermission,
    devicePermission,
    serverPermission,
  );
  const eligible = permission === "default" || permission === "granted";
  const prepared = useRef<PreparedPush | null>(null);
  const working = useRef(false);
  const generation = useRef(0);
  const lastSync = useRef(-1);
  const [status, setStatus] = useState<Status>("loading");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    if (permission !== "granted") lastSync.current = -1;
    if (!userId || !eligible || working.current) return;
    if (permission === "granted" && lastSync.current === revision) return;
    const id = ++generation.current;
    let active = true;
    const current = () => active && generation.current === id;
    async function initialize() {
      if (!current()) return;
      setStatus("loading");
      setError("");
      try {
        const result = await preparePush();
        if (!current()) return;
        prepared.current = result;
        if (!result.config.configured || !result.key) {
          setStatus("unconfigured");
          return;
        }
        if (Notification.permission === "granted") {
          // Permission is the only device-level choice. Always synchronize the
          // subscription with the signed-in account, including after logout,
          // expiration, or the old device-off preference.
          await connectPush(result);
          if (!current()) return;
          lastSync.current = revision;
          setStatus("connected");
        } else setStatus("ready");
      } catch {
        if (current()) {
          setError(
            "알림 설정을 적용하지 못했어요. 잠시 후 다시 시도해 주세요.",
          );
          setStatus("error");
        }
      }
    }
    void Promise.resolve().then(initialize);
    return () => {
      active = false;
    };
  }, [userId, eligible, permission, revision]);

  useEffect(() => {
    const check = () => {
      if (!working.current && document.visibilityState === "visible")
        setRevision((value) => value + 1);
    };
    window.addEventListener("focus", check);
    document.addEventListener("visibilitychange", check);
    window.addEventListener("online", check);
    return () => {
      window.removeEventListener("focus", check);
      document.removeEventListener("visibilitychange", check);
      window.removeEventListener("online", check);
    };
  }, []);

  async function allow() {
    const ready = prepared.current;
    if (
      working.current ||
      !userId ||
      !eligible ||
      (status !== "ready" && status !== "error")
    )
      return false;
    if (!ready) {
      setRevision((value) => value + 1);
      return false;
    }
    working.current = true;
    ++generation.current;
    setBusy(true);
    setError("");
    try {
      // subscribe() must start directly inside the permission button's click.
      await connectPush(ready);
      setStatus("connected");
      return true;
    } catch (e) {
      setError(
        Notification.permission === "denied"
          ? "알림이 차단됐어요. 기기 또는 브라우저의 알림 설정에서 허용해 주세요."
          : e instanceof PushSetupError
            ? e.message
            : Notification.permission === "default"
              ? "아직 알림이 허용되지 않았어요. 원할 때 다시 허용해 주세요."
              : "알림 설정을 적용하지 못했어요. 잠시 후 다시 시도해 주세요.",
      );
      setStatus(Notification.permission === "default" ? "ready" : "error");
      return false;
    } finally {
      // Do not duplicate this request when the permission store updates. A
      // failed save is retried explicitly or on the next focus/online event.
      if (Notification.permission === "granted") lastSync.current = revision;
      working.current = false;
      setBusy(false);
      window.dispatchEvent(new Event(permissionChange));
    }
  }

  return (
    <Context.Provider
      value={{
        permission,
        status,
        busy,
        error,
        allow,
        refresh: () => {
          if (!working.current) setRevision((value) => value + 1);
        },
      }}
    >
      {children}
    </Context.Provider>
  );
}
