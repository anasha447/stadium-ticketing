import type { Level } from "@/lib/domain/types";
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

/** The closest the stadium view comes to the middle of the pitch. */
export const STADIUM_MIN_DISTANCE = 70;

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
}

/** True when a point is in open air, with room to spare. */
export function isClear(rows: Rows, [x, y, z]: Vec3, { margin, inside = false }: Clearance): boolean {
  if (y < margin) return false;
  const { depth } = locate(x, z);

  // Outside the building.
  if (depth >= ROOF.outerDepth + margin) return !inside && y >= OUTSIDE_FLOOR;

  // Over the pitch and the open part of the stands. The concrete rises
  // towards the back, so the step a margin further out is the one to clear.
  const overConcrete = y >= standTop(rows, depth + margin) + margin;
  if (depth <= ROOF_INNER_DEPTH - margin) return overConcrete;

  // In line with the roof and the outer wall: above the roof, or under it.
  if (y >= ROOF.top + margin) return !inside;
  return depth <= OUTER_DEPTH - margin && y <= ROOF.bottom - margin && overConcrete;
}

/** How finely a line of sight is searched, in metres. */
const SEARCH_STEP = 0.5;
const SEARCH_REACH = 120;

/**
 * Where the camera ends up when it asks to be at `position`, looking at
 * `target`. This is what makes the stadium solid.
 *
 * The camera was `cameFrom` metres from the target a moment ago. It moves
 * along its new line of sight from that distance towards the one it asked
 * for and stops at the last clear point before anything solid, so zooming
 * into a wall ends at the wall, however fast the zoom. If turning has swung
 * the line of sight into something solid, the camera takes the nearest clear
 * distance on the new line. Null means the whole line is blocked, and the
 * camera should stay where it was.
 */
export function holdClear(
  rows: Rows,
  target: Vec3,
  position: Vec3,
  cameFrom: number,
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

  let start = within(cameFrom);
  if (!clear(start)) {
    let found: number | null = null;
    for (let step = 1; step * SEARCH_STEP <= SEARCH_REACH && found === null; step++) {
      for (const d of [start + step * SEARCH_STEP, start - step * SEARCH_STEP]) {
        if (d >= min && d <= max && clear(d)) {
          found = d;
          break;
        }
      }
    }
    if (found === null) return null;
    start = found;
  }

  const wanted = within(distance);
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
