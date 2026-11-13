import type { Side } from "./types";

// How the Blocks go around the bowl. Shared by the Seat Map generator and the
// 3D layout, so the two can never disagree about where a Block is.

export const BLOCKS_PER_LEVEL = 40;

// Clockwise from the south-west corner, seen from above: 12 Blocks along the
// west side, 8 behind the north goal, 12 along the east side, 8 behind the
// south goal. Each side also owns half of the corner at each of its ends.
// 12 and 8 keep seats about the same distance apart all the way round.
export const SIDES: { side: Side; blocks: number }[] = [
  { side: "WEST", blocks: 12 },
  { side: "NORTH", blocks: 8 },
  { side: "EAST", blocks: 12 },
  { side: "SOUTH", blocks: 8 },
];

export interface SidePlace {
  side: Side;
  /** 0 to 3, the index into SIDES. */
  sideIndex: number;
  /** How far along that side the position is, counted in Blocks. */
  index: number;
  /** How many Blocks the side has. */
  length: number;
}

/** The side a Block position (0 to 39) is on. Fractions are allowed. */
export function sideOf(position: number): SidePlace {
  let start = 0;
  for (let sideIndex = 0; sideIndex < SIDES.length; sideIndex++) {
    const { side, blocks } = SIDES[sideIndex];
    if (position < start + blocks) {
      return { side, sideIndex, index: position - start, length: blocks };
    }
    start += blocks;
  }
  throw new RangeError(`No Block at position ${position}`);
}
