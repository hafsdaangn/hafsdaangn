"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import styles from "./notification-settings.module.css";
import {
  defaultPostNotifications,
  postNotificationSchema,
  type PostNotificationSetting,
} from "@/lib/post-notifications";

async function preferences(method: string, body?: PostNotificationSetting) {
  const response = await fetch("/api/push/preferences", {
    method,
    cache: "no-store",
    headers: { "Content-Type": "application/json" },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const data = await response.json();
  if (!response.ok)
    throw new Error(data.error || "알림 설정을 저장하지 못했어요.");
  return data;
}

export function PostNotificationSettings() {
  const [settings, setSettings] = useState<PostNotificationSetting[]>(
    defaultPostNotifications,
  );
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let active = true;
    void preferences("GET")
      .then((data) => {
        if (active) {
          setSettings(data);
          setLoaded(true);
          setError("");
        }
      })
      .catch((e: Error) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [revision]);
  return (
    <section className={styles.stack} aria-label="게시글 알림">
      {!loaded && !error && (
        <p className={styles.hint} role="status">
          설정을 불러오고 있어요.
        </p>
      )}
      {error && (
        <div className={styles.feedback} role="alert">
          <p>{error}</p>
          <button
            type="button"
            className="button secondary"
            onClick={() => {
              setError("");
              setRevision((value) => value + 1);
            }}
          >
            다시 불러오기
          </button>
        </div>
      )}
      {loaded &&
        settings.map((setting) => (
          <SectionSetting
            key={setting.section}
            setting={setting}
            loaded={loaded}
            onSaved={(next) =>
              setSettings((current) =>
                current.map((item) =>
                  item.section === next.section ? next : item,
                ),
              )
            }
          />
        ))}
    </section>
  );
}

function SectionSetting({
  setting,
  loaded,
  onSaved,
}: {
  setting: PostNotificationSetting;
  loaded: boolean;
  onSaved: (setting: PostNotificationSetting) => void;
}) {
  const label = setting.section === "giveaway" ? "나눔" : "분실물";
  const [keyword, setKeyword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function save(next: PostNotificationSetting) {
    if (busy) return;
    setError("");
    const parsed = postNotificationSchema.safeParse(next);
    if (!parsed.success) {
      setError(parsed.error.issues[0].message);
      return;
    }
    setBusy(true);
    try {
      onSaved(await preferences("PUT", parsed.data));
      setKeyword("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section
      className={`push-settings ${styles.card}`}
      aria-labelledby={`${setting.section}-heading`}
    >
      <h2 id={`${setting.section}-heading`}>{label} 알림</h2>
      <fieldset className={styles.modes} disabled={!loaded || busy}>
        {(
          [
            ["off", "끄기"],
            ["all", "모든 새 글"],
            ["keywords", "키워드 일치 글만"],
          ] as const
        ).map(([mode, text]) => (
          <label key={mode} className={styles.mode}>
            <input
              type="radio"
              name={setting.section + "-mode"}
              value={mode}
              checked={setting.mode === mode}
              onChange={() => void save({ ...setting, mode })}
            />
            <span>{text}</span>
          </label>
        ))}
      </fieldset>
      {setting.mode === "keywords" && (
        <>
          <form
            className="notification-keyword-form"
            onSubmit={(event) => {
              event.preventDefault();
              void save({
                ...setting,
                keywords: [...setting.keywords, keyword],
              });
            }}
          >
            <label htmlFor={`${setting.section}-keyword`}>키워드 구독</label>
            <p>
              제목이나 본문에 등록한 키워드 중 하나라도 포함되면 알려드려요.
              최대 20개, 각 30자까지 등록할 수 있어요.
            </p>
            <div className="notification-keyword-input">
              <input
                id={`${setting.section}-keyword`}
                value={keyword}
                onChange={(event) => setKeyword(event.target.value)}
                maxLength={30}
                placeholder={
                  "키워드 입력"
                }
                disabled={!loaded || busy}
              />
              <button
                type="submit"
                className="button secondary"
                disabled={
                  !loaded ||
                  busy ||
                  !keyword.trim() ||
                  setting.keywords.length >= 20
                }
              >
                추가
              </button>
            </div>
          </form>
          <ul
            className="notification-keywords"
            aria-label={`${label} 구독 키워드`}
          >
            {setting.keywords.map((word) => (
              <li key={word}>
                <span>{word}</span>
                <button
                  type="button"
                  disabled={busy}
                  aria-label={`${label} 키워드 ${word} 삭제`}
                  onClick={() =>
                    void save({
                      ...setting,
                      keywords: setting.keywords.filter(
                        (item) => item !== word,
                      ),
                    })
                  }
                >
                  <X size={14} />
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
      {error && (
        <div className={styles.feedback} role="alert">
          <p>{error}</p>
        </div>
      )}
    </section>
  );
}
