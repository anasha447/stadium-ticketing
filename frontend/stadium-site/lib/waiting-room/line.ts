import type { WaitingRoomStatus } from "@/lib/domain/types";

// The Waiting Room as a line of Fans outside a gate. The gate is at the
// origin and faces +z; the plaza runs out in front of it. Before the Draw the
// Fans stand about on the plaza; at the Draw they line up, and the line
// winds out from the turnstiles. Each figure in the line stands for several
// Fans, so a line of a few dozen figures can show a Waiting Room of
// thousands. Pure maths, no drawing.

/** Figures in the line. */
export const LINE_FIGURES = 48;

/** Metres from one figure to the next along the line. */
export const SPACING = 0.9;

/** Where the line starts: the middle turnstile, this far out from the gate. */
export const LINE_FRONT = 3;

/** How far the line swings to each side, and the length of one swing, in metres. */
const SWING = 2.4;
const SWING_LENGTH = 16;

/** A figure who has gone this far into the gate is out of sight. */
export const OUT_OF_SIGHT = -4;

export interface Spot {
  x: number;
  z: number;
  /** The way the figure faces: a unit vector along the ground. */
  fx: number;
  fz: number;
}

/**
 * The place in the line `slot` figures back from the front. Slot 0 is at the
 * turnstile. A negative slot has gone through: it walks straight on into the
 * gate, so -1 is just past the turnstile.
 */
export function linePoint(slot: number): Spot {
  if (slot < 0) return { x: 0, z: LINE_FRONT + slot * SPACING, fx: 0, fz: -1 };
  return lineSpots()[Math.min(slot, LINE_FIGURES - 1)];
}

/** The curve the line follows, `d` metres out from the front. */
function curve(d: number): { x: number; z: number } {
  // The first few metres run straight at the turnstile, then the line swings.
  const ease = Math.min(1, d / 6);
  return { x: SWING * Math.sin((d / SWING_LENGTH) * Math.PI * 2) * ease * ease, z: LINE_FRONT + d };
}

let spots: Spot[] | null = null;

/**
 * Every slot of the line, worked out once. The curve is walked in small
 * steps and a figure is put down every SPACING metres walked, so the gaps
 * stay even where the line swings as well as where it runs straight.
 */
function lineSpots(): Spot[] {
  if (spots) return spots;
  const out: Spot[] = [];
  const STEP = 0.01;
  let walked = 0;
  let prev = curve(0);
  for (let d = STEP; out.length < LINE_FIGURES; d += STEP) {
    const here = curve(d);
    const step = Math.hypot(here.x - prev.x, here.z - prev.z);
    if (out.length === 0 || walked + step >= out.length * SPACING) {
      const point = out.length === 0 ? curve(0) : here;
      // Facing back along the curve, towards the figure ahead.
      const back = curve(Math.max(0, d - 0.2));
      const dx = out.length === 0 ? 0 : back.x - point.x;
      const dz = out.length === 0 ? -1 : back.z - point.z;
      const length = Math.hypot(dx, dz);
      out.push({ ...point, fx: dx / length, fz: dz / length });
    }
    walked += step;
    prev = here;
  }
  spots = out;
  return out;
}

/** A repeatable number in [0, 1) for a figure and a purpose. */
function scatter(index: number, salt: number): number {
  const value = Math.sin(index * 127.1 + salt * 311.7) * 43758.5453;
  return value - Math.floor(value);
}

/**
 * Before the Draw: where a figure stands on the plaza, in no order, facing
 * roughly towards the gate. Nobody stands on the turnstiles.
 */
export function crowdSpot(index: number): Spot {
  const x = (scatter(index, 1) - 0.5) * 30;
  const z = 7 + scatter(index, 2) * 30;
  const turn = (scatter(index, 3) - 0.5) * 1.6;
  const toGate = Math.atan2(-x, -z) + turn;
  return { x, z, fx: Math.sin(toGate), fz: Math.cos(toGate) };
}

/** How many Fans one figure stands for, so the whole Waiting Room fits in the line. */
export function fansPerFigure(waiting: number): number {
  return Math.max(1, Math.ceil(waiting / LINE_FIGURES));
}

/** The slot of a Fan at `position` (1 is next). */
export function slotOf(position: number, perFigure: number): number {
  return Math.floor((Math.max(1, position) - 1) / perFigure);
}

/** What the scene should show. */
export type Arrangement =
  | { kind: "crowd" }
  | {
      kind: "line";
      /** The figure that is this Fan. Fixed at the Draw. */
      fan: number;
      /** Figures that have gone through the gate since the Draw. */
      gone: number;
    };

/**
 * The line for a status. `fan` is the figure this Fan was given at the Draw,
 * if the screen saw one; arriving already admitted, they are at the front.
 * An admitted Fan waits at the turnstile: walking through is the scene's
 * last move, not a place in the line.
 */
export function arrange(status: WaitingRoomStatus | undefined, fan: number | null): Arrangement {
  if (status?.phase === "QUEUED") {
    const perFigure = fansPerFigure(status.waiting);
    const mine = slotOf(status.drawnPosition, perFigure);
    return { kind: "line", fan: mine, gone: mine - slotOf(status.position, perFigure) };
  }
  if (status?.phase === "ADMITTED") {
    const mine = fan ?? 0;
    return { kind: "line", fan: mine, gone: mine };
  }
  return { kind: "crowd" };
}

/** Where figure `index` should be for an arrangement, and whether it shows. */
export function figureSpot(index: number, arrangement: Arrangement): Spot {
  if (arrangement.kind === "crowd") return crowdSpot(index);
  return linePoint(index - arrangement.gone);
}

/** The other figures. This Fan is a figure of their own, so the others are one fewer than the line. */
export const OTHERS = LINE_FIGURES - 1;

/** Where this Fan walks to when they go in: well down the passage. */
export const INSIDE: Spot = { x: 0, z: -7, fx: 0, fz: -1 };

/** Where the other figure `k` should be: in the line, everyone but this Fan, in order. */
export function otherSpot(k: number, arrangement: Arrangement): Spot {
  if (arrangement.kind === "crowd") return crowdSpot(k);
  return figureSpot(k < arrangement.fan ? k : k + 1, arrangement);
}

/** Where this Fan should be. Before the Draw they stand in the crowd like anyone else. */
export function fanSpot(arrangement: Arrangement, entering: boolean): Spot {
  if (entering) return INSIDE;
  if (arrangement.kind === "crowd") return crowdSpot(OTHERS);
  return figureSpot(arrangement.fan, arrangement);
}

/** True while a figure at this spot can still be seen: it has not gone far into the gate. */
export function inSight(spot: Spot): boolean {
  return spot.z > OUT_OF_SIGHT;
}

/**
 * Fans let in so far, as the gate board shows it. Admission goes in Draw
 * order, so everyone ahead of this Fan has gone in, and nobody behind.
 * Null when there is nothing true to count yet.
 */
export function fansAdmitted(status: WaitingRoomStatus | undefined): number | null {
  if (status?.phase === "QUEUED") return status.drawnPosition - status.position;
  if (status?.phase === "ADMITTED") return status.drawnPosition;
  return null;
}

type Vec3 = [number, number, number];

/** The gate as the camera must keep it: the piers, the turnstiles and the board above. */
export const GATE_BOX: Vec3[] = [
  [-8.5, 0, 0],
  [8.5, 0, 0],
  [-8.5, 17.6, 0],
  [8.5, 17.6, 0],
  [-8.5, 0, LINE_FRONT],
  [8.5, 0, LINE_FRONT],
];

/** The camera looks from in front, a little to the right and above: about 25° down. */
const LOOK_FROM: Vec3 = (() => {
  const v: Vec3 = [0.45, 0.52, 1];
  const length = Math.hypot(...v);
  return [v[0] / length, v[1] / length, v[2] / length];
})();

/** The height over this Fan's feet the camera keeps in frame: their head and the marker. */
export const FAN_TOP = 3.2;

export interface Framing {
  position: Vec3;
  target: Vec3;
}

/**
 * Where the camera goes to keep both the gate and this Fan in frame. It
 * takes the smallest sphere round them both and backs off until that sphere
 * fits the narrower side of the view, so it works for a wide screen and a
 * phone alike. `fov` is the vertical field of view in degrees.
 */
export function framing(fan: { x: number; z: number }, aspect: number, fov: number): Framing {
  const points: Vec3[] = [...GATE_BOX, [fan.x, 0, fan.z], [fan.x, FAN_TOP, fan.z]];
  const centre: Vec3 = [0, 0, 0];
  for (const point of points) for (let i = 0; i < 3; i++) centre[i] += point[i] / points.length;
  let radius = 0;
  for (const [x, y, z] of points) {
    radius = Math.max(radius, Math.hypot(x - centre[0], y - centre[1], z - centre[2]));
  }
  const vertical = (fov * Math.PI) / 180;
  const horizontal = 2 * Math.atan(Math.tan(vertical / 2) * aspect);
  const distance = radius / Math.sin(Math.min(vertical, horizontal) / 2);
  return {
    position: [
      centre[0] + LOOK_FROM[0] * distance,
      centre[1] + LOOK_FROM[1] * distance,
      centre[2] + LOOK_FROM[2] * distance,
    ],
    target: centre,
  };
}
