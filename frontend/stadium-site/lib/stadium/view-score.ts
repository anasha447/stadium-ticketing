import type { Block } from "@/lib/domain/types";
import { EYE_HEIGHT } from "./camera";
import { PITCH, seatPlace } from "./layout";

// How good the view from a seat is, as a number out of 100. It is a guide,
// made from three things a Fan would feel in the seat: how far the pitch is,
// how high they sit above it, and whether they see it from the side or from
// behind a goal. Pure maths, no Three.js.

export interface SeatView {
  /** 0 to 100, higher is better. */
  score: number;
  /** Metres from the seat to the nearest edge of the pitch. */
  toPitch: number;
}

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

/** Sitting about this many degrees above the centre spot shows the whole pitch well. */
const BEST_ELEVATION = 18;

export function seatView(block: Block, row: number, seat: number): SeatView {
  const { x, y, z } = seatPlace(block, row, seat);
  const eye = y + EYE_HEIGHT;
  const flat = Math.hypot(x, z);

  // Distance: the closest seats are about 45 m from the centre spot, the
  // furthest about 135 m.
  const distance = clamp01(1 - (flat - 45) / 90);

  // Height: too low and the near touchline hides play, too high and it is far away.
  const elevation = (Math.atan2(eye, flat) * 180) / Math.PI;
  const height = clamp01(1 - Math.abs(elevation - BEST_ELEVATION) / 22);

  // Angle: side-on at the halfway line is best, straight behind a goal is worst.
  const sideOn = Math.abs(x) / flat;
  const angle = 0.35 + 0.65 * sideOn;

  // Distance counts most: a high seat can have a fine angle and still be far away.
  const score = Math.round(100 * (0.5 * distance + 0.2 * height + 0.3 * angle));

  const pastTouchline = Math.max(Math.abs(x) - PITCH.width / 2, 0);
  const pastGoalLine = Math.max(Math.abs(z) - PITCH.length / 2, 0);
  return { score, toPitch: Math.round(Math.hypot(pastTouchline, pastGoalLine)) };
}
