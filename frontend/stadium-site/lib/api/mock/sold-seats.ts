import type { Block, SeatCounts } from "@/lib/domain/types";
import { blockSeatCount } from "@/lib/domain/seat-id";
import { generateSeatMap } from "./seat-map";

// Decides which seats were already sold before this Fan arrived.
// Sold seats come in clumps, the way real crowds buy, and some Blocks are
// fuller than others. Seeded by the Match, so it is the same on every load
// and the same on the server and in the browser.

/** A repeatable pseudo-random number in [0, 1) for a seed and a grid point. */
function hash(seed: number, x: number, y: number): number {
  let h = Math.imul(seed ^ 0x9e3779b9, 0x85ebca6b);
  h = Math.imul(h ^ (x + 0x7f4a7c15), 0xc2b2ae35);
  h = Math.imul(h ^ (y + 0x165667b1), 0x27d4eb2f);
  h ^= h >>> 15;
  h = Math.imul(h, 0x2c1b3c6d);
  h ^= h >>> 12;
  return (h >>> 0) / 4294967296;
}

const smooth = (t: number) => t * t * (3 - 2 * t);

/** Smooth noise: nearby points get similar values, which makes the clumps. */
function noise(seed: number, x: number, y: number): number {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const tx = smooth(x - x0);
  const ty = smooth(y - y0);
  const top = hash(seed, x0, y0) * (1 - tx) + hash(seed, x0 + 1, y0) * tx;
  const bottom = hash(seed, x0, y0 + 1) * (1 - tx) + hash(seed, x0 + 1, y0 + 1) * tx;
  return top * (1 - ty) + bottom * ty;
}

// A clump is roughly this many seats wide and this many Rows deep.
const CLUMP_SEATS = 5;
const CLUMP_ROWS = 3;

function soldInBlock(seed: number, block: Block, blockIndex: number, share: number): string {
  // Each Block leans fuller or emptier than the average.
  const lean = (hash(seed, blockIndex, -1) - 0.5) * 0.3;
  const threshold = share + lean;
  let states = "";
  block.rowSeats.forEach((seats, row) => {
    for (let seat = 0; seat < seats; seat++) {
      const value = noise(
        seed + blockIndex * 7919,
        seat / CLUMP_SEATS,
        row / CLUMP_ROWS,
      );
      states += value < threshold ? "S" : "A";
    }
  });
  return states;
}

export interface SoldSeats {
  /** Per Block: "S" for sold, "A" for available, one character per seat. */
  blocks: Record<string, string>;
  counts: Record<string, SeatCounts>;
}

const cache = new Map<string, SoldSeats>();

/** `share` is the part of the stadium already sold, 0 to 1. */
export function soldSeats(matchId: number, share: number): SoldSeats {
  const key = `${matchId}:${share}`;
  const cached = cache.get(key);
  if (cached) return cached;

  const result: SoldSeats = { blocks: {}, counts: {} };
  generateSeatMap(matchId).blocks.forEach((block, index) => {
    const states =
      share <= 0
        ? "A".repeat(blockSeatCount(block))
        : soldInBlock(matchId, block, index, share);
    let sold = 0;
    for (const state of states) if (state === "S") sold++;
    result.blocks[block.id] = states;
    result.counts[block.id] = { available: states.length - sold, held: 0, sold };
  });
  cache.set(key, result);
  return result;
}
