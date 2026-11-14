import { parseSeatId, seatOffset } from "@/lib/domain/seat-id";
import type { Block, SeatCounts, SeatDelta } from "@/lib/domain/types";

// Keeps the Seat States the page holds in step with the Match stream.
// The page reads a snapshot (one string per Block) and then the stream sends
// changes; these functions put the changes into the snapshot. Pure, no React.

/**
 * Applies seat changes, in the order given, to Seat States by Block id.
 * A Block the page has not read yet is skipped: its snapshot will already
 * have the change. Returns `states` itself when nothing ended up different,
 * so nothing is redrawn for no reason.
 */
export function applyDeltas(
  states: Record<string, string>,
  deltas: SeatDelta[],
  blocks: ReadonlyMap<string, Block>,
): Record<string, string> {
  const edited = new Map<string, string[]>();
  for (const delta of deltas) {
    for (const seatId of delta.seatIds) {
      const ref = parseSeatId(seatId);
      const block = ref && blocks.get(ref.blockId);
      if (!ref || !block || states[block.id] === undefined) continue;
      const offset = seatOffset(block, ref.row, ref.seat);
      if (offset < 0) continue;
      let seats = edited.get(block.id);
      if (!seats) edited.set(block.id, (seats = states[block.id].split("")));
      seats[offset] = delta.state;
    }
  }

  let next = states;
  for (const [blockId, seats] of edited) {
    const after = seats.join("");
    if (after === states[blockId]) continue;
    if (next === states) next = { ...states };
    next[blockId] = after;
  }
  return next;
}

/** Of `seatIds`, the ones these changes left held or sold. */
export function takenSeats(deltas: SeatDelta[], seatIds: string[]): string[] {
  const wanted = new Set(seatIds);
  const last = new Map<string, string>();
  for (const delta of deltas) {
    for (const seatId of delta.seatIds) {
      if (wanted.has(seatId)) last.set(seatId, delta.state);
    }
  }
  return seatIds.filter((seatId) => last.has(seatId) && last.get(seatId) !== "A");
}

/** How many seats of each Block are available, held and sold. */
export function countSeats(states: Record<string, string>): Record<string, SeatCounts> {
  const counts: Record<string, SeatCounts> = {};
  for (const [blockId, seats] of Object.entries(states)) {
    const count = { available: 0, held: 0, sold: 0 };
    for (const seat of seats) {
      if (seat === "A") count.available++;
      else if (seat === "H") count.held++;
      else count.sold++;
    }
    counts[blockId] = count;
  }
  return counts;
}
