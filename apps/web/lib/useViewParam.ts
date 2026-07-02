"use client";

// Tab state that participates in browser history: switching tabs pushes a
// `?view=` entry, so the Back button walks back through tabs before leaving
// the page (instead of skipping straight to the previous page).
import { useCallback, useEffect, useRef, useState } from "react";

export function useViewParam<T extends string>(
  defaultView: T,
  allowed: readonly T[]
): [T, (v: T) => void] {
  const [view, setViewState] = useState<T>(defaultView);
  const allowedRef = useRef(allowed);
  allowedRef.current = allowed;

  useEffect(() => {
    const read = () => {
      const v = new URLSearchParams(window.location.search).get("view");
      setViewState(
        v && (allowedRef.current as readonly string[]).includes(v)
          ? (v as T)
          : defaultView
      );
    };
    read(); // honour ?view= deep links
    window.addEventListener("popstate", read);
    return () => window.removeEventListener("popstate", read);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultView]);

  const setView = useCallback(
    (v: T) => {
      if (typeof window === "undefined") return;
      setViewState(v);
      const url = new URL(window.location.href);
      if (v === defaultView) url.searchParams.delete("view");
      else url.searchParams.set("view", v);
      window.history.pushState({}, "", url);
    },
    [defaultView]
  );

  return [view, setView];
}
