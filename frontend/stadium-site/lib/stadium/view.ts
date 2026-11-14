import { seatOffset } from "@/lib/domain/seat-id";
import type { Block } from "@/lib/domain/types";

// Where the Fan is looking: the whole stadium, one Block, or one seat.
// Also the rules for stepping from seat to seat. Pure, no Three.js.

export type View =
  | { kind: "stadium" }
  | { kind: "block"; blockId: string }
  | { kind: "seat"; blockId: string; row: number; seat: number };

export type ViewAction =
  | { type: "openBlock"; blockId: string }
  | { type: "sit"; blockId: string; row: number; seat: number }
  /** One step out: seat to Block, Block to stadium. */
  | { type: "back" }
  /** All the way out, from anywhere. */
  | { type: "stadium" };

export const STADIUM: View = { kind: "stadium" };

export function viewReducer(view: View, action: ViewAction): View {
  switch (action.type) {
    case "openBlock":
      return { kind: "block", blockId: action.blockId };
    case "sit":
      return { kind: "seat", blockId: action.blockId, row: action.row, seat: action.seat };
    case "back":
      if (view.kind === "seat") return { kind: "block", blockId: view.blockId };
      return STADIUM;
    case "stadium":
      return STADIUM;
  }
}

/** True when the Block's state string says the seat is available. */
export function isAvailable(block: Block, states: string, row: number, seat: number): boolean {
  const offset = seatOffset(block, row, seat);
  return offset >= 0 && states[offset] === "A";
}

export function availableCount(states: string): number {
  let count = 0;
  for (const state of states) if (state === "A") count++;
  return count;
}

/** The next available seat along the Row, to the left (-1) or right (+1). */
export function nextAvailableSeat(
  block: Block,
  states: string,
  row: number,
  seat: number,
  step: -1 | 1,
): number | null {
  const seats = block.rowSeats[row - 1];
  for (let s = seat + step; s >= 1 && s <= seats; s += step) {
    if (isAvailable(block, states, row, s)) return s;
  }
  return null;
}

/**
 * The nearest Row in front (-1) or behind (+1) that has an available seat,
 * and the available seat in it that is closest to straight ahead or behind.
 */
export function nextAvailableRow(
  block: Block,
  states: string,
  row: number,
  seat: number,
  step: -1 | 1,
): { row: number; seat: number } | null {
  // Rows differ in length, so compare places across the Block, not numbers.
  const across = (seat - 0.5) / block.rowSeats[row - 1];
  for (let r = row + step; r >= 1 && r <= block.rowSeats.length; r += step) {
    const seats = block.rowSeats[r - 1];
    let best: number | null = null;
    let bestGap = Infinity;
    for (let s = 1; s <= seats; s++) {
      if (!isAvailable(block, states, r, s)) continue;
      const gap = Math.abs((s - 0.5) / seats - across);
      if (gap < bestGap) {
        bestGap = gap;
        best = s;
      }
    }
    if (best !== null) return { row: r, seat: best };
  }
  return null;
}
