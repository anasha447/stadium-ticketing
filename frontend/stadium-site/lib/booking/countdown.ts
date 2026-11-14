// The Hold countdown. It is always worked out from the Hold's own expiry
// time and the clock, never from "when the timer started", so a reload, a
// slow tab or a sleeping laptop cannot make it lie.

export type CountdownTone = "calm" | "warn" | "danger";

export interface Countdown {
  /** Whole seconds left, never below zero. */
  seconds: number;
  /** "7:59" */
  text: string;
  /** Calm, then warn under a minute, then danger under 15 seconds. */
  tone: CountdownTone;
  expired: boolean;
}

export function countdown(expiresAt: string, now: number): Countdown {
  const seconds = Math.max(0, Math.ceil((Date.parse(expiresAt) - now) / 1000));
  return {
    seconds,
    text: `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`,
    tone: seconds < 15 ? "danger" : seconds < 60 ? "warn" : "calm",
    expired: seconds === 0,
  };
}
