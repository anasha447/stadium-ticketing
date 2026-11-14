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

// --- From a point back to a seat -------------------------------------------

export interface RingPlace {
  /** Ring position, 0 to 40, as in ringPoint. */
  position: number;
  depth: number;
}

const SIDE_START = SIDES.map((_, i) => SIDES.slice(0, i).reduce((sum, s) => sum + s.blocks, 0));

/** The reverse of ringPoint: which ring position and depth a ground point is at. */
export function locate(x: number, z: number): RingPlace {
  const overX = Math.abs(x) - CX;
  const overZ = Math.abs(z) - CZ;

  let sideIndex: number;
  let radius: number;
  let along: number;

  if (overX > 0 && overZ > 0) {
    // Beside a corner: measure round the arc from the middle of the corner.
    const corner = x < 0 ? (z > 0 ? 0 : 1) : z < 0 ? 2 : 3;
    const centre = CORNERS[corner];
    radius = Math.hypot(x - centre.x, z - centre.z);
    const middle = (3 * Math.PI) / 4 + (Math.PI / 2) * corner;
    const angle = Math.atan2(z - centre.z, x - centre.x);
    // Bring the difference into -180°..180°.
    const past = Math.atan2(Math.sin(angle - middle), Math.cos(angle - middle));
    if (past >= 0) {
      sideIndex = corner;
      along = past * radius;
    } else {
      sideIndex = (corner + 3) % 4;
      const from = CORNERS[sideIndex];
      const straight = Math.hypot(centre.x - from.x, centre.z - from.z);
      along = (Math.PI / 4) * radius + straight + (Math.PI / 4 + past) * radius;
    }
  } else {
    // Beside a straight: west or east if it is further out sideways.
    sideIndex = overX > overZ ? (x < 0 ? 0 : 2) : z < 0 ? 1 : 3;
    const from = CORNERS[sideIndex];
    const to = CORNERS[(sideIndex + 1) % 4];
    const straight = Math.hypot(to.x - from.x, to.z - from.z);
    const outward = (3 * Math.PI) / 4 + (Math.PI / 2) * sideIndex + Math.PI / 4;
    radius = (x - from.x) * Math.cos(outward) + (z - from.z) * Math.sin(outward);
    const t = ((x - from.x) * (to.x - from.x) + (z - from.z) * (to.z - from.z)) / straight ** 2;
    along = (Math.PI / 4) * radius + t * straight;
  }

  const from = CORNERS[sideIndex];
  const to = CORNERS[(sideIndex + 1) % 4];
  const total = (Math.PI / 2) * radius + Math.hypot(to.x - from.x, to.z - from.z);
  return {
    position: SIDE_START[sideIndex] + (along / total) * SIDES[sideIndex].blocks,
    depth: radius - FRONT_CORNER_RADIUS,
  };
}

export interface SeatRefInBlock {
  block: Block;
  row: number;
  seat: number;
}

/** How far outside a Level's Rows a point may be and still count as that Level. */
const LEVEL_REACH = 2.5;

/** The seat nearest to a ground point, or null if the point is not on a stand. */
export function seatAtPoint(blocks: Block[], x: number, z: number): SeatRefInBlock | null {
  const { position, depth } = locate(x, z);
  if (position < 0 || position >= BLOCKS_PER_LEVEL) return null;

  let best: { level: Level; miss: number } | null = null;
  for (const level of Object.keys(LEVEL_PROFILE) as Level[]) {
    const rows = blocks.find((b) => b.level === level)?.rowSeats.length ?? 0;
    const { startDepth, tread } = LEVEL_PROFILE[level];
    const miss = Math.max(startDepth - depth, depth - (startDepth + rows * tread), 0);
    if (miss <= LEVEL_REACH && (!best || miss < best.miss)) best = { level, miss };
  }
  if (!best) return null;

  const block = blocks.find(
    (b) => b.level === best.level && b.position === Math.floor(position),
  );
  if (!block) return null;

  const { startDepth, tread } = LEVEL_PROFILE[block.level];
  const rows = block.rowSeats.length;
  const row = Math.min(rows, Math.max(1, Math.floor((depth - startDepth) / tread) + 1));
  const seats = block.rowSeats[row - 1];
  const across = (position - block.position - AISLE_SHARE) / (1 - 2 * AISLE_SHARE);
  const seat = Math.min(seats, Math.max(1, Math.floor(across * seats) + 1));
  return { block, row, seat };
}

/**
 * The seat a line of sight is really aimed at. A click lands on the concrete
 * behind or below a seat, so this looks at the seats around the first guess
 * and picks the one the line passes closest to.
 */
export function seatOnRay(
  guess: SeatRefInBlock,
  origin: [number, number, number],
  direction: [number, number, number],
): SeatRefInBlock {
  const { block } = guess;
  let best = guess;
  let bestMiss = Infinity;
  for (let row = guess.row - 2; row <= guess.row + 1; row++) {
    if (row < 1 || row > block.rowSeats.length) continue;
    // Rows differ in length, so carry the place across the Block, not the number.
    const across = (guess.seat - 0.5) / block.rowSeats[guess.row - 1];
    const middle = Math.floor(across * block.rowSeats[row - 1]) + 1;
    for (let seat = middle - 1; seat <= middle + 1; seat++) {
      if (seat < 1 || seat > block.rowSeats[row - 1]) continue;
      const place = seatPlace(block, row, seat);
      // Distance from the middle of the seat's backrest to the line.
      const px = place.x - origin[0];
      const py = place.y + 0.55 - origin[1];
      const pz = place.z - origin[2];
      const t = px * direction[0] + py * direction[1] + pz * direction[2];
      const miss = Math.hypot(
        px - direction[0] * t,
        py - direction[1] * t,
        pz - direction[2] * t,
      );
      if (miss < bestMiss) {
        bestMiss = miss;
        best = { block, row, seat };
      }
    }
  }
  return best;
}
