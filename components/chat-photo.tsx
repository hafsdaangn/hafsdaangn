"use client";

import { useEffect, useRef, useState } from "react";
import { LoaderCircle, RotateCw, X } from "lucide-react";

export function ChatPhoto({ src, alt }: { src: string; alt: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        className="chat-photo-trigger ph-no-capture"
        aria-label={`${alt} 크게 보기`}
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
      >
        <img src={src} alt={alt} loading="lazy" decoding="async" />
      </button>
      {open && (
        <PhotoDialog src={src} alt={alt} onClose={() => setOpen(false)} />
      )}
    </>
  );
}

function PhotoDialog({
  src,
  alt,
  onClose,
}: {
  src: string;
  alt: string;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">(
    "loading",
  );
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    const trigger = document.activeElement;
    const previousOverflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    element.showModal();
    return () => {
      element.close();
      document.documentElement.style.overflow = previousOverflow;
      if (trigger instanceof HTMLElement && trigger.isConnected)
        trigger.focus({ preventScroll: true });
    };
  }, []);

  return (
    <dialog
      ref={dialog}
      className="chat-photo-dialog"
      aria-label="채팅 사진 보기"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClose={(event) => {
        // Strict Mode closes and reopens the dialog while replaying Effects.
        // Its queued close event must not dismiss the newly reopened viewer.
        if (!event.currentTarget.open) onClose();
      }}
    >
      <header className="chat-photo-toolbar">
        <span>사진 보기</span>
        <div>
          <button
            type="button"
            className="icon-button"
            aria-label="사진 닫기"
            autoFocus
            onClick={onClose}
          >
            <X size={24} />
          </button>
        </div>
      </header>
      <div className="chat-photo-stage" aria-busy={status === "loading"}>
        {status === "error" ? (
          <div className="chat-photo-feedback" role="alert">
            <p>사진을 불러오지 못했어요.</p>
            <button
              type="button"
              onClick={() => {
                setStatus("loading");
                setAttempt((value) => value + 1);
              }}
            >
              <RotateCw size={17} /> 다시 시도
            </button>
          </div>
        ) : (
          <>
            {status === "loading" && (
              <div
                className="chat-photo-loading"
                role="status"
                aria-label="사진 불러오는 중"
              >
                <LoaderCircle className="spin" size={28} />
              </div>
            )}
            <div className="chat-photo-canvas ph-no-capture">
              <img
                key={attempt}
                src={src}
                alt={alt}
                onLoad={() => setStatus("ready")}
                onError={() => setStatus("error")}
                draggable={false}
              />
            </div>
          </>
        )}
      </div>
    </dialog>
  );
}
