"use client";

import Link from "next/link";
import type { ComponentProps } from "react";

// Every /app screen is rendered by the same client-side Workspace. Updating
// history lets Next's pathname/search hooks switch screens without an RSC trip.
export function navigateApp(href: string, replace = false, scroll = true) {
  window.history[replace ? "replaceState" : "pushState"](null, "", href);
  if (scroll) window.scrollTo(0, 0);
}

export default function AppLink({
  onClick,
  ...props
}: ComponentProps<typeof Link>) {
  const internal =
    typeof props.href === "string" && /^\/app(?:\/|\?|$)/.test(props.href);
  return (
    <Link
      {...props}
      prefetch={internal ? false : props.prefetch}
      onClick={(event) => {
        onClick?.(event);
        if (
          !internal ||
          event.defaultPrevented ||
          event.button !== 0 ||
          event.metaKey ||
          event.ctrlKey ||
          event.shiftKey ||
          event.altKey ||
          (props.target && props.target !== "_self") ||
          props.download
        )
          return;
        event.preventDefault();
        navigateApp(
          props.href as string,
          props.replace,
          props.scroll !== false,
        );
      }}
    />
  );
}
