import { OUT_OF_SIGHT, type Spot } from "./line";

// How a figure outside the gate gets from where it is to where the line says
// it should be: at a walking pace, quicker when it is far off (the Draw sends
// everyone across the plaza at once), turning to face the way it goes. Pure
// maths, run once a frame for every figure.

/** Walking pace, in metres a second, and how much faster a figure goes when far from its place. */
export const PACE = 1.4;
const HURRY = 1.6;
export const TOP_PACE = 8;

/** Closer than this, a figure is there. */
const THERE = 0.02;

/** A figure's place, the way it faces and whether it is on the move. */
export interface Walker {
  x: number;
  z: number;
  fx: number;
  fz: number;
  walking: boolean;
}

/**
 * Moves a walker on by `seconds` towards a spot, at `pace` or quicker when
 * far off. With `jump` it is put there at once, as reduced motion asks.
 */
export function step(walker: Walker, to: Spot, seconds: number, pace: number, jump: boolean): void {
  const dx = to.x - walker.x;
  const dz = to.z - walker.z;
  const distance = Math.hypot(dx, dz);
  if (jump) {
    Object.assign(walker, { x: to.x, z: to.z, fx: to.fx, fz: to.fz, walking: false });
    return;
  }
  let faceX = to.fx;
  let faceZ = to.fz;
  if (distance < THERE) {
    walker.x = to.x;
    walker.z = to.z;
    walker.walking = false;
  } else {
    const speed = Math.min(TOP_PACE, Math.max(pace, distance * HURRY));
    const move = Math.min(distance, speed * seconds);
    walker.x += (dx / distance) * move;
    walker.z += (dz / distance) * move;
    // Still walking only if this frame did not bring them there.
    walker.walking = distance - move > THERE;
    // On the move a figure faces where it is going; standing, the way its spot faces.
    if (walker.walking) {
      faceX = dx / distance;
      faceZ = dz / distance;
    }
  }
  // Turn a little each frame, never in one snap.
  const turn = Math.min(1, seconds * 8);
  const fx = walker.fx + (faceX - walker.fx) * turn;
  const fz = walker.fz + (faceZ - walker.fz) * turn;
  const length = Math.hypot(fx, fz);
  if (length > 1e-6) {
    walker.fx = fx / length;
    walker.fz = fz / length;
  } else {
    walker.fx = faceX;
    walker.fz = faceZ;
  }
}

/** Where a figure starts fading into the light of the way in. */
const FADE_FROM = 1.4;

/** How far into the light of the way in a figure at depth `z` has faded: 0 outside, 1 gone. */
export function fadeAt(z: number): number {
  return Math.min(1, Math.max(0, (FADE_FROM - z) / (FADE_FROM - OUT_OF_SIGHT)));
}
