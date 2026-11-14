import { formatSeatId, seatOffset } from "@/lib/domain/seat-id";
import type { Block } from "@/lib/domain/types";

// The seats a Fan has chosen but not yet held: "Your seats". Up to four,
// the size of a Hold. Pure functions over a plain list; nothing here talks
// to the backend or works out a price.

export const MAX_SEATS = 4;

export interface ChosenSeat {
  blockId: string;
  row: number;
  seat: number;
}

export const seatIdOf = (seat: ChosenSeat) => formatSeatId(seat);

export const sameSeat = (a: ChosenSeat, b: ChosenSeat) =>
  a.blockId === b.blockId && a.row === b.row && a.seat === b.seat;

export const isChosen = (chosen: ChosenSeat[], seat: ChosenSeat) =>
  chosen.some((other) => sameSeat(other, seat));

export const isFull = (chosen: ChosenSeat[]) => chosen.length >= MAX_SEATS;

/** Adds a seat. Choosing a seat twice, or a fifth seat, changes nothing. */
export function addSeat(chosen: ChosenSeat[], seat: ChosenSeat): ChosenSeat[] {
  if (isChosen(chosen, seat) || isFull(chosen)) return chosen;
  return [...chosen, seat];
}

export function removeSeat(chosen: ChosenSeat[], seat: ChosenSeat): ChosenSeat[] {
  return chosen.filter((other) => !sameSeat(other, seat));
}

/** Drops the seats with these ids, as when the backend says they were taken. */
export function removeSeatIds(chosen: ChosenSeat[], seatIds: string[]): ChosenSeat[] {
  return chosen.filter((seat) => !seatIds.includes(seatIdOf(seat)));
}

/**
 * Neighbouring available seats in one Row, for "pick seats together": the
 * run of `count` seats nearest the middle of the Block, or null if no Row
 * has that many together. A suggestion only; the Hold decides.
 */
export function seatsTogether(block: Block, states: string, count: number): ChosenSeat[] | null {
  const rows = block.rowSeats.length;
  let best: { row: number; start: number; distance: number } | null = null;

  for (let row = 1; row <= rows; row++) {
    const seats = block.rowSeats[row - 1];
    const offset = seatOffset(block, row, 1);
    for (let start = 1; start + count - 1 <= seats; start++) {
      let free = true;
      for (let s = 0; s < count && free; s++) {
        free = states[offset + start - 1 + s] === "A";
      }
      if (!free) continue;
      // How far the middle of this run is from the middle of the Block,
      // counting a Row as about one and a half seats.
      const across = start + (count - 1) / 2 - (seats + 1) / 2;
      const deep = (row - (rows + 1) / 2) * 1.5;
      const distance = Math.hypot(across, deep);
      if (!best || distance < best.distance) best = { row, start, distance };
    }
  }

  if (!best) return null;
  const { row, start } = best;
  return Array.from({ length: count }, (_, i) => ({ blockId: block.id, row, seat: start + i }));
}
