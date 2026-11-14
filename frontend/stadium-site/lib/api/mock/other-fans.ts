import { formatSeatId, parseSeatId, seatOffset } from "@/lib/domain/seat-id";
import type { Block, SeatDelta, SeatState } from "@/lib/domain/types";

// The other Fans of the mock. While this Fan looks at the stadium, others
// hold seats and a little later either buy them or let them go, so the
// Match stream has something to say. They follow the same rules as everyone:
// a Hold is 1 to 4 available seats together in one Row, and a seat that is
// held or sold cannot be taken. No timers here: `stepOtherFans` is told the
// time and works out what happened since it was last called.

/** New Holds by other Fans each second, across the whole stadium. */
export const OTHER_HOLDS_PER_SECOND = 6;
/** The part of their Holds that ends in a sale. The rest are let go. */
export const BUY_SHARE = 0.7;
/** How long another Fan takes to pay or give up: between these two. */
export const DECIDE_MIN_MS = 5_000;
export const DECIDE_MAX_MS = 40_000;
/** After a pause, such as a sleeping tab, they make up for no more than this. */
export const CATCH_UP_MS = 3_000;

/** How many seats a Hold has. Pairs are the most common. */
const GROUP_SIZES = [1, 2, 2, 2, 3, 4];
/** How many Rows a Fan looks at before giving up on finding seats together. */
const TRIES = 4;

export interface OtherFans {
  /** The Blocks they have changed so far: that Block's Seat States with their Holds and sales in. */
  blocks: Record<string, string>;
  /** Their Holds that are still running. */
  holds: { seatIds: string[]; until: number }[];
  /** When they last acted. */
  at: number;
}

export const noOtherFans = (now: number): OtherFans => ({ blocks: {}, holds: [], at: now });

export interface OtherFansStep {
  blocks: Block[];
  /** Seat States before any other Fan acted, by Block id. */
  base: Record<string, string>;
  /** The seats this Fan holds or has bought. Nobody else can take them. */
  mine: ReadonlySet<string>;
  now: number;
  /** A number from 0 up to, not including, 1. */
  random: () => number;
}

/**
 * Lets the other Fans act up to `now` and returns what changed, in the
 * order it happened: seats let go, seats sold, then seats newly held.
 * `others` is updated in place.
 */
export function stepOtherFans(
  others: OtherFans,
  { blocks, base, mine, now, random }: OtherFansStep,
): SeatDelta[] {
  const byId = new Map(blocks.map((block) => [block.id, block]));
  const read = (blockId: string) => others.blocks[blockId] ?? base[blockId];
  const changed: Record<SeatState, string[]> = { A: [], S: [], H: [] };

  const write = (seatId: string, state: SeatState) => {
    const ref = parseSeatId(seatId)!;
    const offset = seatOffset(byId.get(ref.blockId)!, ref.row, ref.seat);
    const states = read(ref.blockId);
    others.blocks[ref.blockId] = states.slice(0, offset) + state + states.slice(offset + 1);
    changed[state].push(seatId);
  };

  const elapsed = Math.min(Math.max(0, now - others.at), CATCH_UP_MS);
  others.at = now;

  // Holds that are due end one of two ways.
  others.holds = others.holds.filter((hold) => {
    if (hold.until > now) return true;
    const state = random() < BUY_SHARE ? "S" : "A";
    for (const seatId of hold.seatIds) write(seatId, state);
    return false;
  });

  // New Holds. The part of a Hold left over is settled by chance, so the
  // rate is right on average however often this is called.
  const due = (OTHER_HOLDS_PER_SECOND * elapsed) / 1000;
  const count = Math.floor(due) + (random() < due % 1 ? 1 : 0);
  for (let i = 0; i < count; i++) {
    const seatIds = seatsTogether(blocks, read, mine, random);
    if (!seatIds) continue;
    for (const seatId of seatIds) write(seatId, "H");
    others.holds.push({
      seatIds,
      until: now + DECIDE_MIN_MS + random() * (DECIDE_MAX_MS - DECIDE_MIN_MS),
    });
  }

  return (["A", "S", "H"] as const)
    .filter((state) => changed[state].length > 0)
    .map((state) => ({ state, seatIds: changed[state] }));
}

/** Available seats next to each other in some Row, or null when a few tries find none. */
function seatsTogether(
  blocks: Block[],
  read: (blockId: string) => string,
  mine: ReadonlySet<string>,
  random: () => number,
): string[] | null {
  const size = GROUP_SIZES[Math.floor(random() * GROUP_SIZES.length)];
  const run = "A".repeat(size);
  for (let attempt = 0; attempt < TRIES; attempt++) {
    const block = blocks[Math.floor(random() * blocks.length)];
    const row = Math.floor(random() * block.rowSeats.length);
    const seats = block.rowSeats[row];
    const rowStart = seatOffset(block, row + 1, 1);
    const rowStates = read(block.id).slice(rowStart, rowStart + seats);
    // Start looking somewhere along the Row, then from its beginning.
    let first = rowStates.indexOf(run, Math.floor(random() * seats));
    if (first < 0) first = rowStates.indexOf(run);
    if (first < 0) continue;
    const seatIds = Array.from({ length: size }, (_, i) =>
      formatSeatId({ blockId: block.id, row: row + 1, seat: first + 1 + i }),
    );
    // This Fan's seats are not in the states read here, so check them apart.
    if (seatIds.some((seatId) => mine.has(seatId))) continue;
    return seatIds;
  }
  return null;
}
