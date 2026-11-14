"use client";

import { useSyncExternalStore } from "react";

/**
 * The time now, in milliseconds, refreshed once a second. For countdowns:
 * read the clock, never count ticks, so a sleeping tab cannot fall behind.
 * Before the page is live in the browser it returns 0.
 */
export function useNow(): number {
  return useSyncExternalStore(
    (onTick) => {
      const timer = setInterval(onTick, 1000);
      return () => clearInterval(timer);
    },
    // Rounded to the second so the value only changes when a tick is due.
    () => Math.floor(Date.now() / 1000) * 1000,
    () => 0,
  );
}
