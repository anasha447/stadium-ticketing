import { BLOCKS_PER_LEVEL, sideOf, SIDES } from "@/lib/domain/stadium";
import type { Block, Level } from "@/lib/domain/types";

// Where everything in the stadium is, in metres. Pure maths, no Three.js, so
// the terraces, the seats and the camera all work from the same numbers.
//
// Axes: x runs west (-) to east (+), z runs north (-) to south (+), y is up.
// The pitch lies along z, so the goals are at the north and south ends and
// the long sides are west and east.

export const PITCH = { length: 105, width: 68 };

// The front of the lower Level follows a rounded rectangle around the pitch:
// 8 m back from the touchlines, 10 m back from the goal lines.
const FRONT_HALF_X = PITCH.width / 2 + 8;
const FRONT_HALF_Z = PITCH.length / 2 + 10;
const FRONT_CORNER_RADIUS = 18;

// Centres of the four corner arcs. They stay put as the bowl widens; only
// the radius grows with depth.
const CX = FRONT_HALF_X - FRONT_CORNER_RADIUS;
const CZ = FRONT_HALF_Z - FRONT_CORNER_RADIUS;
const CORNERS = [
  { x: -CX, z: CZ }, // south-west
  { x: -CX, z: -CZ }, // north-west
  { x: CX, z: -CZ }, // north-east
  { x: CX, z: CZ }, // south-east
];

export interface LevelProfile {
  /** How far behind the front of the bowl the first Row starts. */
  startDepth: number;
  /** Height of the first Row. */
  startHeight: number;
  /** Depth of one Row. */
  tread: number;
  /** How much each Row rises above the one in front. */
  riser: number;
}

// The upper Level is the steepest, as in the reference photos.
export const LEVEL_PROFILE: Record<Level, LevelProfile> = {
  LOWER: { startDepth: 0, startHeight: 1.2, tread: 0.8, riser: 0.36 },
  CLUB: { startDepth: 21.5, startHeight: 11.6, tread: 0.85, riser: 0.48 },
  UPPER: { startDepth: 34, startHeight: 20.5, tread: 0.8, riser: 0.62 },
};

/** Depth of the outer wall, measured like every other depth. */
export const OUTER_DEPTH = 59;
export const FACADE_HEIGHT = 42;

/** Part of a Block's width left empty at each edge, which makes the aisles. */
export const AISLE_SHARE = 0.06;

export interface RingPoint {
  x: number;
  z: number;
  /** Unit vector pointing away from the pitch. */
  nx: number;
  nz: number;
}

/**
 * A point on the bowl. `position` counts Blocks around the ring (0 to 40,
 * fractions allowed, clockwise from the south-west corner); `depth` is how
 * far back from the front of the lower Level.
 *
 * Each side is its straight plus half a corner at each end, and positions
 * are spread evenly along that path at the given depth. So Blocks get a
 * little wider towards the back, the way a real bowl opens up.
 */
export function ringPoint(position: number, depth: number): RingPoint {
  const wrapped = ((position % BLOCKS_PER_LEVEL) + BLOCKS_PER_LEVEL) % BLOCKS_PER_LEVEL;
  const { sideIndex, index, length } = sideOf(wrapped);
  const from = CORNERS[sideIndex];
  const to = CORNERS[(sideIndex + 1) % 4];

  const radius = FRONT_CORNER_RADIUS + depth;
  const halfCorner = (Math.PI / 4) * radius;
  const straight = Math.hypot(to.x - from.x, to.z - from.z);
  const along = (index / length) * (2 * halfCorner + straight);

  // Angle of the middle of this side's first corner: south-west is 135°.
  const startAngle = (3 * Math.PI) / 4 + (Math.PI / 2) * sideIndex;

  if (along < halfCorner) {
    return onArc(from, radius, startAngle + along / radius);
  }
  if (along <= halfCorner + straight) {
    const t = (along - halfCorner) / straight;
    const angle = startAngle + Math.PI / 4;
    const nx = Math.cos(angle);
    const nz = Math.sin(angle);
    return {
      x: from.x + (to.x - from.x) * t + nx * radius,
      z: from.z + (to.z - from.z) * t + nz * radius,
      nx,
      nz,
    };
  }
  const past = along - halfCorner - straight;
  return onArc(to, radius, startAngle + Math.PI / 4 + past / radius);
}

function onArc(centre: { x: number; z: number }, radius: number, angle: number): RingPoint {
  const nx = Math.cos(angle);
  const nz = Math.sin(angle);
  return { x: centre.x + nx * radius, z: centre.z + nz * radius, nx, nz };
}

/** How wide one Block is, in metres, at a given depth. Wider towards the back. */
export function blockWidth(position: number, depth: number): number {
  const { sideIndex, length } = sideOf(position);
  const from = CORNERS[sideIndex];
  const to = CORNERS[(sideIndex + 1) % 4];
  const halfCorner = (Math.PI / 4) * (FRONT_CORNER_RADIUS + depth);
  return (2 * halfCorner + Math.hypot(to.x - from.x, to.z - from.z)) / length;
}

/** How far along the slope one Row is from the next, in metres. */
export function rowPitch(level: Level): number {
  const { tread, riser } = LEVEL_PROFILE[level];
  return Math.hypot(tread, riser);
}

/** Where a seat is across its Block, 0 at one aisle and 1 at the other. */
export function seatAcross(block: Block, row: number, seat: number): number {
  const seats = block.rowSeats[row - 1];
  return AISLE_SHARE + ((seat - 0.5) / seats) * (1 - 2 * AISLE_SHARE);
}

/** Depth and height of the middle of a Row. Rows count from 1 at the front. */
export function rowPlace(level: Level, row: number): { depth: number; y: number } {
  const { startDepth, startHeight, tread, riser } = LEVEL_PROFILE[level];
  return {
    depth: startDepth + (row - 0.5) * tread,
    y: startHeight + (row - 1) * riser,
  };
}

export interface SeatPlace extends RingPoint {
  y: number;
}

/**
 * Where a seat is. Seats count from 1, left to right as you face the pitch
 * from behind the Block... which is clockwise around the bowl.
 */
export function seatPlace(block: Block, row: number, seat: number): SeatPlace {
  const { depth, y } = rowPlace(block.level, row);
  return { ...ringPoint(block.position + seatAcross(block, row, seat), depth), y };
}

/** The middle of a Block, for aiming a camera at it. */
export function blockCentre(block: Block): SeatPlace {
  const middleRow = (block.rowSeats.length + 1) / 2;
  const { depth, y } = rowPlace(block.level, middleRow);
  return { ...ringPoint(block.position + 0.5, depth), y };
}

/** How many Blocks each side has, in ring order. */
export const SIDE_BLOCKS = SIDES.map((side) => side.blocks);
