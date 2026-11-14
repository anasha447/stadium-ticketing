"use client";

import { useSyncExternalStore } from "react";

/** True while the media query matches. False on the server. Updates if it changes. */
function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const list = window.matchMedia(query);
      list.addEventListener("change", onChange);
      return () => list.removeEventListener("change", onChange);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}

/** True when the Fan's device asks for less motion. Updates if they change it. */
export function usePrefersReducedMotion(): boolean {
  return useMediaQuery("(prefers-reduced-motion: reduce)");
}

/** True when the Fan points with a finger rather than a mouse, so the words can say "tap". */
export function useTouchScreen(): boolean {
  return useMediaQuery("(pointer: coarse)");
}
