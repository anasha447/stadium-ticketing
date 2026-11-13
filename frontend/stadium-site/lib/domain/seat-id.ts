import type { Block } from "./types";

// A seat id is "<block>-R<row>-<seat>", e.g. "214-R07-12".
// Rows and seats count from 1.

export interface SeatRef {
  blockId: string;
  row: number;
  seat: number;
}

const SEAT_ID = /^([123]\d{2})-R(\d{2})-(\d{2})$/;

const pad2 = (n: number) => String(n).padStart(2, "0");

export function formatSeatId({ blockId, row, seat }: SeatRef): string {
  return `${blockId}-R${pad2(row)}-${pad2(seat)}`;
}

export function parseSeatId(seatId: string): SeatRef | null {
  const match = SEAT_ID.exec(seatId);
  if (!match) return null;
  return { blockId: match[1], row: Number(match[2]), seat: Number(match[3]) };
}

export function blockSeatCount(block: Block): number {
  return block.rowSeats.reduce((sum, seats) => sum + seats, 0);
}

/**
 * Where a seat sits in its Block's state string (see SeatStates), or -1 if
 * the Block has no such Row or seat.
 */
export function seatOffset(block: Block, row: number, seat: number): number {
  if (row < 1 || row > block.rowSeats.length) return -1;
  if (seat < 1 || seat > block.rowSeats[row - 1]) return -1;
  let offset = 0;
  for (let r = 0; r < row - 1; r++) offset += block.rowSeats[r];
  return offset + seat - 1;
}

/** True when the seats are next to each other in one Row of one Block. */
export function areAdjacent(seats: SeatRef[]): boolean {
  if (seats.length === 0) return false;
  const [first] = seats;
  if (seats.some((s) => s.blockId !== first.blockId || s.row !== first.row)) {
    return false;
  }
  const numbers = seats.map((s) => s.seat).sort((a, b) => a - b);
  return numbers.every((n, i) => i === 0 || n === numbers[i - 1] + 1);
}
