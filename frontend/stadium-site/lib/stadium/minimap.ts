import { BLOCKS_PER_LEVEL } from "@/lib/domain/stadium";
import type { Block, Level } from "@/lib/domain/types";
import { AISLE_SHARE, LEVEL_PROFILE, OUTER_DEPTH, ringPoint } from "./layout";

// The stadium seen from straight above, for the mini-map: one outline per
// Block, in the same metres as the 3D model. Pure maths, no Three.js.

/** The area the map shows: the whole bowl with a little margin. */
export const MAP_BOUNDS = {
  halfWidth: 34 + 8 + OUTER_DEPTH + 4,
  halfHeight: 52.5 + 10 + OUTER_DEPTH + 4,
};

/** Points along each curved edge. Enough for corners to look round at map size. */
const EDGE_POINTS = 4;

/**
 * The outline of a Block as an SVG path, in map coordinates: x to the east,
 * y to the south, so north is up.
 */
export function blockOutline(block: Block): string {
  const { startDepth, tread } = LEVEL_PROFILE[block.level];
  const front = startDepth;
  const back = startDepth + block.rowSeats.length * tread;
  const from = block.position + AISLE_SHARE / 2;
  const to = block.position + 1 - AISLE_SHARE / 2;

  const points: string[] = [];
  const add = (position: number, depth: number) => {
    const { x, z } = ringPoint(position, depth);
    points.push(`${x.toFixed(1)} ${z.toFixed(1)}`);
  };
  // Along the front edge, then back along the rear edge.
  for (let i = 0; i <= EDGE_POINTS; i++) add(from + ((to - from) * i) / EDGE_POINTS, front);
  for (let i = EDGE_POINTS; i >= 0; i--) add(from + ((to - from) * i) / EDGE_POINTS, back);
  return `M${points.join("L")}Z`;
}

/** The Levels from the pitch outwards. */
const LEVEL_ORDER: Level[] = ["LOWER", "CLUB", "UPPER"];

/** The keys that move round the mini-map. */
export type MapKey = "ArrowLeft" | "ArrowRight" | "ArrowUp" | "ArrowDown";

/**
 * Where an arrow key goes from a Block on the mini-map. Right goes clockwise
 * round the ring and left the other way, wrapping at the end. Up goes one
 * Level out, away from the pitch, and down one Level in, keeping the same
 * place round the ring; at the outer or inner Level it stays put.
 */
export function mapStep(blocks: Block[], fromId: string, key: MapKey): string {
  const from = blocks.find((block) => block.id === fromId);
  if (!from) return fromId;
  let level = from.level;
  let position = from.position;
  if (key === "ArrowRight" || key === "ArrowLeft") {
    position = (position + (key === "ArrowRight" ? 1 : -1) + BLOCKS_PER_LEVEL) % BLOCKS_PER_LEVEL;
  } else {
    const index = LEVEL_ORDER.indexOf(level) + (key === "ArrowUp" ? 1 : -1);
    if (index < 0 || index >= LEVEL_ORDER.length) return fromId;
    level = LEVEL_ORDER[index];
  }
  return blocks.find((block) => block.level === level && block.position === position)?.id ?? fromId;
}
