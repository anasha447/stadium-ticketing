import { blockSeatCount } from "@/lib/domain/seat-id";
import type { Block } from "@/lib/domain/types";
import type { ColorToken } from "@/lib/design/tokens";
import { PITCH } from "./layout";
import type { SeatInstances } from "./seats";

// Who is sitting where: one fan for every sold seat. A fan uses the seat's
// own transform, so they can never sit beside their seat. No Three.js here.

/** Shirt colours. Home fans wear the first two, the visiting end the last two. */
export const FAN_SHIRTS: ColorToken[] = ["seatBlau", "seatGrana", "sceneKitAway", "flood50"];

export interface FanInstances {
  count: number;
  /** 16 numbers per fan: the transform of the seat they sit on. */
  matrices: Float32Array;
  /** One index into FAN_SHIRTS per fan. */
  shirts: Uint8Array;
}

/** A steady coin flip per seat, so a fan keeps their shirt between redraws. */
function coin(seatIndex: number): 0 | 1 {
  let h = Math.imul(seatIndex + 1, 0x9e3779b1);
  h ^= h >>> 15;
  return ((h >>> 3) & 1) as 0 | 1;
}

/**
 * The visiting fans have the south end: every seat beyond the south goal
 * line. Everyone else is a home fan.
 */
export function isVisitingEnd(z: number): boolean {
  return z > PITCH.length / 2;
}

/** Fans in Blocks closer than this to the open Block are drawn in full. */
export const NEAR_METRES = 45;

/** The middle of a Block, taken from its first and last seat. */
function blockCentre(block: Block, seats: SeatInstances): [number, number, number] {
  const first = seats.blockStart[block.id] * 16;
  const last = first + (blockSeatCount(block) - 1) * 16;
  const m = seats.matrices;
  return [
    (m[first + 12] + m[last + 12]) / 2,
    (m[first + 13] + m[last + 13]) / 2,
    (m[first + 14] + m[last + 14]) / 2,
  ];
}

/** The Blocks around `blockId`, itself included: the ones a Fan sitting there sees close up. */
export function blocksNear(blocks: Block[], seats: SeatInstances, blockId: string): Set<string> {
  const near = new Set<string>();
  const open = blocks.find((block) => block.id === blockId);
  if (!open) return near;
  const [x, y, z] = blockCentre(open, seats);
  for (const block of blocks) {
    const [bx, by, bz] = blockCentre(block, seats);
    if (Math.hypot(bx - x, by - y, bz - z) < NEAR_METRES) near.add(block.id);
  }
  return near;
}

/**
 * Builds the fans from Seat States. `states` has one string per Block, one
 * character per seat; a Block that is missing has no fans yet. Only the
 * Blocks that `only` accepts are included.
 */
export function buildFans(
  blocks: Block[],
  seats: SeatInstances,
  states: Record<string, string>,
  only: (blockId: string) => boolean = () => true,
): FanInstances {
  let count = 0;
  for (const block of blocks) {
    const blockStates = states[block.id];
    if (!blockStates || !only(block.id)) continue;
    for (let i = 0; i < blockStates.length; i++) if (blockStates[i] === "S") count++;
  }

  const matrices = new Float32Array(count * 16);
  const shirts = new Uint8Array(count);
  let fan = 0;
  for (const block of blocks) {
    const blockStates = states[block.id];
    if (!blockStates || !only(block.id)) continue;
    const start = seats.blockStart[block.id];
    const size = Math.min(blockSeatCount(block), blockStates.length);
    for (let i = 0; i < size; i++) {
      if (blockStates[i] !== "S") continue;
      const seat = start + i;
      const from = seat * 16;
      matrices.set(seats.matrices.subarray(from, from + 16), fan * 16);
      // Number 14 of a transform is where the seat is along z.
      shirts[fan] = (isVisitingEnd(seats.matrices[from + 14]) ? 2 : 0) + coin(seat);
      fan++;
    }
  }
  return { count, matrices, shirts };
}
