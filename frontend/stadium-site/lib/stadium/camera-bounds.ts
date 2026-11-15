import type { Level } from "@/lib/domain/types";
import { PITCH_CENTRE } from "./camera";
import { FACADE_HEIGHT, LEVEL_PROFILE, locate, OUTER_DEPTH, ROOF_INNER_DEPTH } from "./layout";

// Where the camera may be. The stadium is solid: the camera stays in the air
// a fan could be in, above the terraces and clear of the roof and the outer
// wall, and never under the ground. Pure numbers; the camera rig asks these
// questions every frame.

type Vec3 = [number, number, number];

/** How many Rows each Level has. The terraces have one step per Row. */
export type Rows = Record<Level, number>;

const LEVELS: Level[] = ["LOWER", "CLUB", "UPPER"];

/** The roof ring, as the bowl sweeps it: from above the outer wall in to its inner edge. */
const ROOF = { outerDepth: OUTER_DEPTH + 4, bottom: FACADE_HEIGHT + 2.5, top: FACADE_HEIGHT + 6 };

/**
 * Outside the stadium the camera stays above the trees, the lamps and the
 * footbridges, so it can look at the stadium over them but never ends up
 * inside one.
 */
export const OUTSIDE_FLOOR = 22;

/**
 * Closer to the middle of the pitch than this, the camera has come in to the
 * stadium: the bowl fills the view. From here in it may only be in the air
 * over the stadium, so tilting down leads into the bowl and never down the
 * outside of the wall. Further out it is looking at the stadium from outside
 * and may be anywhere in the open, down to the height of the trees. At this
 * distance the whole outer wall still fits the view.
 */
export const STADIUM_COME_IN = 200;

/**
 * The air over the stadium widens with height, like a funnel standing on the
 * roof: this many metres further out for every metre above it.
 */
const FUNNEL = 2.5;

/**
 * The lowest the stadium view tilts, as an angle above level, in radians. It
 * looks at a point 10 m over the pitch, so the further back it stands, the
 * higher this keeps it: always over the rooftops of the city, never among them.
 */
export const STADIUM_LOWEST_TILT = 0.08;

/**
 * The closest the stadium view comes to the middle of the pitch. Close
 * enough that a camera in the bowl can always come in over the grass: side
 * on, the stands start 42 m from the middle, so a larger limit would leave a
 * low camera with nowhere to go but out.
 */
export const STADIUM_MIN_DISTANCE = 30;

/** How far past the opening view the stadium view can pull back. */
const PULL_BACK = 1.5;

/** The furthest the stadium view pulls back, given the distance the opening view stands at. */
export function stadiumMaxDistance(openingDistance: number): number {
  return openingDistance * PULL_BACK;
}

/** Height of the highest concrete at a depth, seen from above: the steps, the walls behind them, the pitch. */
export function standTop(rows: Rows, depth: number): number {
  if (depth < 0) return 0;
  let top = LEVEL_PROFILE.LOWER.startHeight;
  let backDepth = 0;
  for (const level of LEVELS) {
    const { startDepth, startHeight, tread, riser } = LEVEL_PROFILE[level];
    if (depth < startDepth) return top;
    backDepth = startDepth + rows[level] * tread;
    const row = Math.min(rows[level] - 1, Math.floor((depth - startDepth) / tread));
    // Behind the last Row there is a low wall.
    top = startHeight + row * riser + (depth >= backDepth ? 1.1 : 0);
  }
  if (depth <= backDepth) return top;
  // Behind the upper Level the wall climbs to the top of the facade.
  const climb = Math.min(1, (depth - backDepth) / (OUTER_DEPTH - backDepth));
  return top + (FACADE_HEIGHT - top) * climb;
}

export interface Clearance {
  /** How far the camera keeps from every surface, in metres. */
  margin: number;
  /** True keeps the camera inside the bowl: not above the roof and not outside the wall. */
  inside?: boolean;
  /**
   * The stadium view's rule: closer to the middle of the pitch than this,
   * the camera may only be in the air over the stadium.
   */
  comeIn?: number;
}

/** How far a point is from the middle of the pitch, where the stadium view looks. */
function fromPitch([x, y, z]: Vec3): number {
  return Math.hypot(x - PITCH_CENTRE[0], y - PITCH_CENTRE[1], z - PITCH_CENTRE[2]);
}

/** True when a point is not in or too near anything solid: the ground, the terraces, the roof, the wall. */
function inOpenAir(rows: Rows, [x, y, z]: Vec3, margin: number, inside: boolean): boolean {
  if (y < margin) return false;
  const { depth } = locate(x, z);

  // Outside the building, above the trees.
  if (depth >= ROOF.outerDepth + margin) return !inside && y >= OUTSIDE_FLOOR;

  // Over the pitch and the open part of the stands. The concrete rises
  // towards the back, so the step a margin further out is the one to clear.
  const overConcrete = y >= standTop(rows, depth + margin) + margin;
  if (depth <= ROOF_INNER_DEPTH - margin) return overConcrete;

  // In line with the roof and the outer wall: above the roof, or under it.
  if (y >= ROOF.top + margin) return !inside;
  return depth <= OUTER_DEPTH - margin && y <= ROOF.bottom - margin && overConcrete;
}

/**
 * True for the air over the stadium: over the pitch and the open roof at any
 * height, among the stands under the roof, and above the roof in a funnel
 * that widens with height.
 */
export function overTheStadium([x, y, z]: Vec3, margin: number): boolean {
  const { depth } = locate(x, z);
  if (depth <= ROOF_INNER_DEPTH) return true;
  if (y <= ROOF.top) return depth <= OUTER_DEPTH;
  const above = y - (ROOF.top + margin);
  return above >= 0 && depth <= ROOF.outerDepth + above * FUNNEL;
}

/** True where the camera may be: in open air, with room to spare, and where its view allows. */
export function isClear(rows: Rows, point: Vec3, { margin, inside = false, comeIn }: Clearance): boolean {
  if (!inOpenAir(rows, point, margin, inside)) return false;
  if (comeIn === undefined || fromPitch(point) >= comeIn) return true;
  return overTheStadium(point, margin);
}

/** How finely a line of sight is searched, in metres. */
const SEARCH_STEP = 0.5;
const SEARCH_REACH = 200;

/**
 * Where the camera ends up when it asks to be at `position`, looking at
 * `target`. This is what makes the stadium solid.
 *
 * `was` is the last clear place the camera stood. From that distance it moves
 * along its new line of sight towards the distance it asked for, and stops at
 * the last clear point before anything in the way: zooming into a wall ends
 * at the wall, however fast the zoom.
 *
 * If turning has swung the line of sight into something, the camera takes the
 * nearest clear distance on its own side. One that has come in to the stadium
 * moves in towards the pitch, so tilting down over the roof brings it down
 * into the bowl, looking across at the far stand; it is never put down
 * outside the wall. One outside backs away, and is never pulled through the
 * stand. The way from one to the other is to zoom, in or out over the roof.
 *
 * Null means there is no place for it on that line, and the camera should
 * stay where it was.
 */
export function holdClear(
  rows: Rows,
  target: Vec3,
  position: Vec3,
  was: Vec3,
  clearance: Clearance,
  min: number,
  max: number,
): Vec3 | null {
  const dx = position[0] - target[0];
  const dy = position[1] - target[1];
  const dz = position[2] - target[2];
  const distance = Math.hypot(dx, dy, dz);
  if (distance === 0) return null;
  const at = (d: number): Vec3 => [
    target[0] + (dx / distance) * d,
    target[1] + (dy / distance) * d,
    target[2] + (dz / distance) * d,
  ];
  const within = (d: number) => Math.min(max, Math.max(min, d));
  const clear = (d: number) => isClear(rows, at(d), clearance);
  // A Block's camera is always in the bowl; the stadium view's has come in when it is close.
  const cameIn = clearance.comeIn === undefined || fromPitch(was) < clearance.comeIn;

  const before = within(Math.hypot(was[0] - target[0], was[1] - target[1], was[2] - target[2]));
  let start = before;
  if (!clear(start)) {
    const way = cameIn ? -1 : 1;
    let found: number | null = null;
    for (let step = 1; step * SEARCH_STEP <= SEARCH_REACH && found === null; step++) {
      const d = start + way * step * SEARCH_STEP;
      if (d < min || d > max) break;
      if (clear(d)) found = d;
    }
    if (found === null) return null;
    start = found;
  }

  // Only the zoom the camera asked for is added on: a turn that moved it in does not move it back out.
  const wanted = within(start + within(distance) - before);
  const steps = Math.ceil(Math.abs(wanted - start) / SEARCH_STEP);
  let held = start;
  for (let i = 1; i <= steps; i++) {
    const d = start + ((wanted - start) * i) / steps;
    if (!clear(d)) break;
    held = d;
  }
  return at(held);
}

/** A point on a flight: a straight line from `from` to `to`, raised by `lift` in the middle. */
export function flightPoint(from: Vec3, to: Vec3, lift: number, k: number): Vec3 {
  return [
    from[0] + (to[0] - from[0]) * k,
    from[1] + (to[1] - from[1]) * k + lift * Math.sin(Math.PI * k),
    from[2] + (to[2] - from[2]) * k,
  ];
}

const LIFTS = [0, 12, 25, 40, 60, 85, 115, 150];
const FLIGHT_SAMPLES = 48;
/** A flight may start and end close to a surface: a seat is one. */
const NEAR_END = 6;

/**
 * How high a flight has to arc so the camera goes over the roof and the
 * stands, not through them. The smallest of a few heights that clears the
 * way; the ends are left out, since a seat is right on the concrete.
 */
export function flightLift(rows: Rows, from: Vec3, to: Vec3): number {
  const clearance = { margin: 1 };
  for (const lift of LIFTS) {
    let blocked = false;
    for (let i = 1; i < FLIGHT_SAMPLES && !blocked; i++) {
      const point = flightPoint(from, to, lift, i / FLIGHT_SAMPLES);
      const fromStart = Math.hypot(point[0] - from[0], point[1] - from[1], point[2] - from[2]);
      const fromEnd = Math.hypot(point[0] - to[0], point[1] - to[1], point[2] - to[2]);
      if (fromStart < NEAR_END || fromEnd < NEAR_END) continue;
      blocked = !isClear(rows, point, clearance);
    }
    if (!blocked) return lift;
  }
  return LIFTS[LIFTS.length - 1];
}
